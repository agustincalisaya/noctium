import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarAulaActiva, listarAulasActivasParaTurno, hayAulasActivas, existeAula } from "@/server/aulas/aula.service";
import { verificarAlumnoActivo } from "@/server/alumnos/alumno.service";
import { verificarMateriaActiva } from "@/server/materias/materia.service";
import { estaDentroDeHorarioAtencion, profesorActivoDictaMateria, intervalosSeSuperponen } from "@/server/profesores/profesor.service";
import { ServiceError } from "@/server/shared/service-error";
import { emitirEventoTurno } from "./turno.service";
import { turnoSigueVigente } from "./turno.validaciones";
import { alumnoEnConflicto, esConflictoDeReserva, recursoEnConflicto } from "./turno.reserva-error";
import type { AsignarAulaTurnoInput } from "./turno.schema";

const ESTADOS_CONFIRMADOS = ["DISPONIBLE", "COMPLETO"] as const;
const MENSAJES_CONFLICTO = {
  AULA: ["AULA_NO_DISPONIBLE", "El aula ya tiene un turno confirmado en ese horario"],
  PROFESOR: ["PROFESOR_NO_DISPONIBLE", "El profesor ya tiene un turno confirmado en ese horario"],
  ALUMNO: ["ALUMNO_NO_DISPONIBLE", "El alumno ya tiene un turno confirmado en ese horario"],
} as const;

function conflicto(tipo: keyof typeof MENSAJES_CONFLICTO, alumnoId?: string) {
  const [codigo, mensaje] = MENSAJES_CONFLICTO[tipo];
  return new ServiceError(codigo, mensaje, alumnoId ? { alumno_id: alumnoId } : undefined);
}

function intervalo(turno: { horaInicioTurno: Date; duracionMinutosTurno: number }) {
  const inicio = turno.horaInicioTurno.getUTCHours() * 60 + turno.horaInicioTurno.getUTCMinutes();
  const fin = inicio + turno.duracionMinutosTurno;
  if (!Number.isInteger(turno.duracionMinutosTurno) || turno.duracionMinutosTurno <= 0 || fin > 1440) {
    throw new ServiceError("HORARIO_INVALIDO", "La fecha, hora o duración del turno no son válidas. Corregí su configuración");
  }
  return { inicio, fin };
}

function hora(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

async function verificarSolapamiento(tx: Prisma.TransactionClient, turno: {
  idTurno: string; fechaTurno: Date; horaInicioTurno: Date; duracionMinutosTurno: number;
}, aulaId: string, profesorId: string | null, alumnos: string[]) {
  const actual = intervalo(turno);
  const otros = await tx.turno.findMany({
    where: {
      idTurno: { not: turno.idTurno }, fechaTurno: turno.fechaTurno,
      estadoTurno: { in: [...ESTADOS_CONFIRMADOS] },
      OR: [{ aulaId }, ...(profesorId ? [{ profesorId }] : []), ...(alumnos.length ? [{ alumnos: { some: { alumnoId: { in: alumnos } } } }] : [])],
    },
    select: { aulaId: true, profesorId: true, horaInicioTurno: true, duracionMinutosTurno: true,
      alumnos: { where: { alumnoId: { in: alumnos } }, select: { alumnoId: true } } },
  });
  for (const otro of otros) {
    if (!intervalosSeSuperponen(actual, intervalo(otro))) continue;
    if (otro.aulaId === aulaId) throw conflicto("AULA");
    if (profesorId && otro.profesorId === profesorId) throw conflicto("PROFESOR");
    if (otro.alumnos[0]) throw conflicto("ALUMNO", otro.alumnos[0].alumnoId);
  }
}

export async function listarOpcionesAulaTurno(turnoId: string) {
  const turno = await prisma.turno.findUnique({ where: { idTurno: turnoId }, select: { estadoTurno: true, cupoMaximoTurno: true } });
  if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
  if (turno.estadoTurno !== "PENDIENTE") throw new ServiceError("TURNO_YA_DISPONIBLE", "El turno ya está confirmado");
  if (!(await hayAulasActivas())) throw new ServiceError("SIN_AULAS_ACTIVAS", "No hay aulas activas registradas");
  return listarAulasActivasParaTurno(turno.cupoMaximoTurno);
}

export async function asignarAulaTurno(turnoId: string, input: AsignarAulaTurnoInput, usuarioId: string) {
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const version = await tx.turno.findUnique({ where: { idTurno: turnoId }, select: { estadoTurno: true, updatedAtTurno: true } });
      if (!version) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
      if (version.estadoTurno !== "PENDIENTE") throw new ServiceError("TURNO_YA_DISPONIBLE", "El turno ya está confirmado");
      const bloqueo = await tx.turno.updateMany({
        where: { idTurno: turnoId, estadoTurno: "PENDIENTE", updatedAtTurno: version.updatedAtTurno },
        data: { modificadoPorUsuarioId: usuarioId },
      });
      if (bloqueo.count !== 1) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");

      const turno = await tx.turno.findUnique({
        where: { idTurno: turnoId },
        select: { idTurno: true, estadoTurno: true, fechaTurno: true, horaInicioTurno: true,
          duracionMinutosTurno: true, materiaId: true, profesorId: true, cupoMaximoTurno: true,
          alumnos: { select: { alumnoId: true } } },
      });
      if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
      const periodo = intervalo(turno);
      if (!turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno)) throw new ServiceError("TURNO_VENCIDO", "El horario del turno ya pasó. Corregí su configuración");
      if (!(await verificarMateriaActiva(turno.materiaId, tx))) throw new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible");
      const aula = await verificarAulaActiva(input.aula_id, tx);
      if (!aula) {
        if (!(await hayAulasActivas(tx))) throw new ServiceError("SIN_AULAS_ACTIVAS", "No hay aulas activas registradas");
        if (await existeAula(input.aula_id, tx)) throw new ServiceError("AULA_INACTIVA", "El aula seleccionada no está activa");
        throw new ServiceError("AULA_NO_ENCONTRADA", "No se encontró el aula");
      }
      if (aula.capacidadAula < turno.cupoMaximoTurno) throw new ServiceError("AULA_CAPACIDAD_INSUFICIENTE", "La capacidad del aula es menor que el cupo máximo del turno");
      if (turno.alumnos.length > turno.cupoMaximoTurno) throw new ServiceError("CUPO_INSUFICIENTE", "El turno alcanzó su cupo máximo");

      const alumnoIds = turno.alumnos.map(({ alumnoId }) => alumnoId);
      const confirmar = Boolean(turno.profesorId && alumnoIds.length > 0);
      if (confirmar) {
        if (!(await profesorActivoDictaMateria(turno.profesorId!, turno.materiaId, tx))) throw new ServiceError("PROFESOR_NO_APTO", "El profesor no está activo o no dicta esta materia");
        if (!(await estaDentroDeHorarioAtencion(turno.profesorId!, turno.fechaTurno, hora(periodo.inicio), hora(periodo.fin), tx))) throw new ServiceError("PROFESOR_FUERA_DE_HORARIO", "El turno completo está fuera del horario de atención del profesor");
        for (const alumnoId of alumnoIds) {
          if (!(await verificarAlumnoActivo(alumnoId, tx))) throw new ServiceError("ALUMNO_NO_DISPONIBLE", "El alumno no existe o no está activo", { alumno_id: alumnoId });
        }
      }
      await verificarSolapamiento(tx, turno, input.aula_id, confirmar ? turno.profesorId : null, confirmar ? alumnoIds : []);
      if (!turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno)) throw new ServiceError("TURNO_VENCIDO", "El horario del turno ya pasó. Corregí su configuración");
      const estado = confirmar ? (alumnoIds.length === turno.cupoMaximoTurno ? "COMPLETO" : "DISPONIBLE") : "PENDIENTE";
      await tx.turno.update({ where: { idTurno: turnoId }, data: { aulaId: input.aula_id, estadoTurno: estado, modificadoPorUsuarioId: usuarioId } });
      // El UPDATE dispara reservas en PostgreSQL; una exclusión revierte toda la transacción.
      if (!turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno)) throw new ServiceError("TURNO_VENCIDO", "El horario del turno ya pasó. Corregí su configuración");
      return { id: turnoId, aula_id: input.aula_id, estado, mensaje: confirmar ? "Turno confirmado correctamente" : "Aula asignada correctamente", alumno_ids: alumnoIds, cupo: turno.cupoMaximoTurno };
    }, { timeout: 15_000 });

    await emitirEventoTurno("turno:aula_asignada", turnoId, usuarioId, { turno_id: turnoId, aula_id: input.aula_id, usuario_id: usuarioId });
    if (resultado.estado !== "PENDIENTE") {
      await emitirEventoTurno(resultado.estado === "COMPLETO" ? "turno:completado" : "turno:disponibilizado", turnoId, usuarioId, {
        turno_id: turnoId, alumno_ids: resultado.alumno_ids, cupo_maximo: resultado.cupo, aula_id: input.aula_id, usuario_id: usuarioId,
      });
    }
    return { id: resultado.id, aula_id: resultado.aula_id, estado: resultado.estado, mensaje: resultado.mensaje };
  } catch (error) {
    if (esConflictoDeReserva(error)) {
      const tipo = recursoEnConflicto(error);
      if (tipo) throw conflicto(tipo, tipo === "ALUMNO" ? alumnoEnConflicto(error) : undefined);
      throw new ServiceError("RECURSO_NO_DISPONIBLE", "Un recurso dejó de estar disponible. Volvé a intentar");
    }
    throw error;
  }
}
