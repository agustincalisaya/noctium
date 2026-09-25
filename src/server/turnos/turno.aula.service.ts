import { prisma } from "@/lib/prisma";
import { verificarAulaActiva, listarAulasActivasParaTurno, hayAulasActivas, existeAula } from "@/server/aulas/aula.service";
import { verificarMateriaActiva } from "@/server/materias/materia.service";
import { ServiceError } from "@/server/shared/service-error";
import { emitirEventoTurno } from "./turno.service";
import { turnoSigueVigente } from "./turno.validaciones";
import { aulaConTurnoSuperpuesto } from "./turno.disponibilidad";
import { conflictoDeRecurso } from "./turno.reserva-error";
import type { AsignarAulaTurnoInput } from "./turno.schema";

function validarIntervalo(turno: { horaInicioTurno: Date; duracionMinutosTurno: number }) {
  const inicio = turno.horaInicioTurno.getUTCHours() * 60 + turno.horaInicioTurno.getUTCMinutes();
  if (!Number.isInteger(turno.duracionMinutosTurno) || turno.duracionMinutosTurno <= 0 || inicio + turno.duracionMinutosTurno > 1440) {
    throw new ServiceError("HORARIO_INVALIDO", "La fecha, hora o duración del turno no son válidas. Corregí su configuración");
  }
}

/**
 * Sin `turnoId` (alta, el turno todavía no existe) lista todas las aulas
 * activas: sin cupo previo, cualquiera sirve. Con `turnoId` exige PENDIENTE y
 * descarta las que no alcanzan a los alumnos ya cargados (§2.3 paso 3).
 */
export async function listarOpcionesAulaTurno(turnoId?: string) {
  let inscriptos = 0;
  if (turnoId) {
    const turno = await prisma.turno.findUnique({ where: { idTurno: turnoId }, select: { estadoTurno: true, _count: { select: { alumnos: true } } } });
    if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
    if (turno.estadoTurno !== "PENDIENTE") throw new ServiceError("TURNO_YA_DISPONIBLE", "El turno ya está confirmado");
    inscriptos = turno._count.alumnos;
  }
  if (!(await hayAulasActivas())) throw new ServiceError("SIN_AULAS_ACTIVAS", "No hay aulas activas registradas");
  return listarAulasActivasParaTurno(Math.max(1, inscriptos));
}

/**
 * HU-C-15 §2.3 (Revisión 3): asigna o reemplaza el aula de un turno PENDIENTE
 * y fija `cupoMaximoTurno` con su capacidad. El turno sigue PENDIENTE: la
 * confirmación ocurre al asignar profesor y alumnos (§2.2).
 */
export async function asignarAulaTurno(turnoId: string, input: AsignarAulaTurnoInput, usuarioId: string) {
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
      select: { idTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true, materiaId: true, _count: { select: { alumnos: true } } },
    });
    if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
    validarIntervalo(turno);
    if (!turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno)) throw new ServiceError("TURNO_VENCIDO", "El horario del turno ya pasó. Corregí su configuración");
    if (!(await verificarMateriaActiva(turno.materiaId, tx))) throw new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible");
    const aula = await verificarAulaActiva(input.aula_id, tx);
    if (!aula) {
      if (!(await hayAulasActivas(tx))) throw new ServiceError("SIN_AULAS_ACTIVAS", "No hay aulas activas registradas");
      if (await existeAula(input.aula_id, tx)) throw new ServiceError("AULA_INACTIVA", "El aula seleccionada no está activa");
      throw new ServiceError("AULA_NO_ENCONTRADA", "No se encontró el aula");
    }
    // Defensivo: en el flujo de la Revisión 3 un turno PENDIENTE no tiene
    // alumnos (se cargan al confirmar, §2.2); solo datos previos llegan acá.
    if (aula.capacidadAula < turno._count.alumnos) {
      throw new ServiceError("AULA_CAPACIDAD_INSUFICIENTE", "El aula elegida tiene menos capacidad que los alumnos ya inscriptos en este turno");
    }
    if (await aulaConTurnoSuperpuesto(tx, turno, input.aula_id)) throw conflictoDeRecurso("AULA");

    const actualizado = await tx.turno.updateMany({
      where: { idTurno: turnoId, estadoTurno: "PENDIENTE" },
      data: { aulaId: input.aula_id, cupoMaximoTurno: aula.capacidadAula, modificadoPorUsuarioId: usuarioId },
    });
    if (actualizado.count === 0) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");
    return { id: turnoId, aula_id: input.aula_id, cupo_maximo: aula.capacidadAula, estado: "PENDIENTE" as const };
  });

  await emitirEventoTurno("turno:aula_asignada", turnoId, usuarioId, { turno_id: turnoId, aula_id: input.aula_id, cupo_maximo: resultado.cupo_maximo, usuario_id: usuarioId });
  return resultado;
}
