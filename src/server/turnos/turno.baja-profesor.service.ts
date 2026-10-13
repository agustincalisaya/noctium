import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ahora } from "@/server/shared/reloj";
import { bloquear } from "@/server/shared/bloquear";
import { despuesDelCommit, type Tx } from "@/server/shared/transaccion";
import type { ActorDominio } from "@/server/shared/historial";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { obtenerOpcionProfesorActivo, profesorActivoDictaMateria, estaDentroDeHorarioAtencion } from "@/server/profesores/profesor.publico";
import { sqlVigenteEn, estadoSegunOcupacion } from "@/server/turnos/inscripcion.vigencia";
import { horaLocal, turnoSigueVigente } from "@/server/turnos/turno.validaciones";
import { horaDeMinutos, intervaloTurno, profesoresConTurnoSuperpuesto } from "@/server/turnos/turno.disponibilidad";
import { cancelarTurnoEnTransaccion } from "@/server/turnos/turno.cancelacion.service";
import { emitirEventoTurno } from "@/server/turnos/turno.service";
import { esConflictoDeReserva, recursoEnConflicto } from "@/server/turnos/turno.reserva-error";

function corte(momento: Date) {
  const local = horaLocal(momento);
  return Prisma.sql`CAST(${`${local.fecha} ${local.hora}`} AS timestamp)`;
}
const estados = Prisma.sql`('DISPONIBLE', 'COMPLETO')`;
function futuras(profesorId: string, momento: Date) {
  return Prisma.sql`t."profesorId" = ${profesorId} AND (t."fechaTurno" + t."horaInicioTurno") > ${corte(momento)}`;
}

export async function contarTurnosFuturosDeProfesor(profesorId: string, db: Tx = prisma) {
  const [fila] = await db.$queryRaw<{ confirmados: bigint; pendientes: bigint }[]>(Prisma.sql`
    SELECT count(*) FILTER (WHERE t."estadoTurno" IN ${estados}) AS confirmados,
      count(*) FILTER (WHERE t."estadoTurno" = 'PENDIENTE') AS pendientes
    FROM turnos t WHERE ${futuras(profesorId, ahora())}`);
  return { confirmados: Number(fila?.confirmados ?? 0), pendientes: Number(fila?.pendientes ?? 0) };
}

export async function profesorTieneClasesPasadas(profesorId: string, db: Tx = prisma) {
  const [fila] = await db.$queryRaw<{ existe: boolean }[]>(Prisma.sql`
    SELECT EXISTS (SELECT 1 FROM turnos t WHERE t."profesorId" = ${profesorId}
      AND t."estadoTurno" <> 'PENDIENTE' AND (t."fechaTurno" + t."horaInicioTurno") <= ${corte(ahora())}) AS existe`);
  return Boolean(fila?.existe);
}

export async function obtenerTurnosBasicos(turnoIds: string[], db: Tx = prisma) {
  const filas = await db.turno.findMany({ where: { idTurno: { in: turnoIds } }, select: {
    idTurno: true, materiaId: true, profesorId: true, estadoTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true,
  } });
  return filas.map((t) => ({ turno_id: t.idTurno, materia_id: t.materiaId, profesor_id: t.profesorId, estado: t.estadoTurno,
    fecha: t.fechaTurno.toISOString().slice(0, 10), hora_inicio: t.horaInicioTurno.toISOString().slice(11, 16),
    hora_fin: horaDeMinutos(intervaloTurno(t).fin) }));
}

type FilaFutura = {
  idTurno: string; materiaId: string; fechaTurno: Date; horaInicioTurno: Date;
  duracionMinutosTurno: number; cupoMaximoTurno: number | null; estadoTurno: "DISPONIBLE" | "COMPLETO"; inscriptos: bigint;
};
export async function listarTurnosFuturosDeProfesor(profesorId: string, query: { materiaId?: string; pagina: number; porPagina: number }, db: Tx = prisma) {
  const momento = ahora();
  const filtro = Prisma.sql`${futuras(profesorId, momento)} AND t."estadoTurno" IN ${estados}`;
  const porMateria = await db.$queryRaw<{ materia_id: string; cantidad: bigint }[]>(Prisma.sql`
    SELECT t."materiaId" AS materia_id, count(*) AS cantidad FROM turnos t WHERE ${filtro} GROUP BY t."materiaId"`);
  const materias = porMateria.map((m) => ({ materia_id: m.materia_id, cantidad: Number(m.cantidad) }));
  const total = materias.filter((m) => !query.materiaId || m.materia_id === query.materiaId).reduce((sum, m) => sum + m.cantidad, 0);
  const filtrado = Prisma.sql`${filtro} ${query.materiaId ? Prisma.sql`AND t."materiaId" = ${query.materiaId}` : Prisma.empty}`;
  const leer = (limit: number, offset: number) => db.$queryRaw<FilaFutura[]>(Prisma.sql`
    SELECT t."idTurno", t."materiaId", t."fechaTurno", t."horaInicioTurno", t."duracionMinutosTurno", t."cupoMaximoTurno", t."estadoTurno",
      (SELECT count(*) FROM turno_alumno ta WHERE ta."turnoId" = t."idTurno" AND ${sqlVigenteEn("ta", momento)}) AS inscriptos
    FROM turnos t WHERE ${filtrado} ORDER BY t."fechaTurno", t."horaInicioTurno", t."idTurno" LIMIT ${limit} OFFSET ${offset}`);
  const [filas, seleccion] = await Promise.all([leer(query.porPagina, (query.pagina - 1) * query.porPagina), leer(500, 0)]);
  const serializar = (fila: FilaFutura) => ({ turno_id: fila.idTurno, materia_id: fila.materiaId,
      fecha: fila.fechaTurno.toISOString().slice(0, 10), hora_inicio: fila.horaInicioTurno.toISOString().slice(11, 16),
      hora_fin: horaDeMinutos(intervaloTurno(fila).fin), inscriptos: Number(fila.inscriptos),
      alumnos_inscriptos: `${fila.inscriptos}/${fila.cupoMaximoTurno ?? 0}`,
      estado: estadoSegunOcupacion(fila.estadoTurno, Number(fila.inscriptos), fila.cupoMaximoTurno) as "DISPONIBLE" | "COMPLETO" });
  return {
    items: filas.map(serializar),
    total, materias, seleccion: { items: seleccion.map(serializar),
      total, total_inscriptos: seleccion.reduce((s, t) => s + Number(t.inscriptos), 0), truncada: total > 500 },
  };
}

export type ResultadoCambioProfesor = "SE_PUEDE" | "FUERA_DE_HORARIO" | "OCUPADO" | "NO_DISPONIBLE";
export async function evaluarCambioDeProfesor(profesorDestinoId: string, turnoIds: string[], db: Tx = prisma) {
  const filas = await db.turno.findMany({ where: { idTurno: { in: turnoIds } } });
  const porId = new Map(filas.map((t) => [t.idTurno, t]));
  const momento = ahora();
  const resultados: { turno_id: string; resultado: ResultadoCambioProfesor }[] = [];
  for (const id of turnoIds) {
    const t = porId.get(id);
    let resultado: ResultadoCambioProfesor = "NO_DISPONIBLE";
    if (t && ["DISPONIBLE", "COMPLETO"].includes(t.estadoTurno) && turnoSigueVigente(t.fechaTurno, t.horaInicioTurno, momento)) {
      const intervalo = intervaloTurno(t);
      resultado = !(await estaDentroDeHorarioAtencion(profesorDestinoId, t.fechaTurno, horaDeMinutos(intervalo.inicio), horaDeMinutos(intervalo.fin), db))
        ? "FUERA_DE_HORARIO" : (await profesoresConTurnoSuperpuesto(db, t, [profesorDestinoId])).has(profesorDestinoId) ? "OCUPADO" : "SE_PUEDE";
    }
    resultados.push({ turno_id: id, resultado });
  }
  return resultados;
}

export async function cancelarTurnoPorBajaDeProfesor(tx: Tx, input: { turnoId: string; profesorId: string; actor: ActorDominio }) {
  await bloquear(tx, { recursos: { profesores: [input.profesorId] }, clases: [input.turnoId] });
  if (!(await obtenerOpcionProfesorActivo(input.profesorId, tx))) throw new ErrorDeDominio("errores.profesor.inactivo");
  const t = await tx.turno.findUnique({ where: { idTurno: input.turnoId } });
  if (!t) throw new ErrorDeDominio("errores.turno.noEncontrado");
  if (t.profesorId !== input.profesorId) throw new ErrorDeDominio("errores.profesor.claseModificada");
  if (t.estadoTurno === "PENDIENTE") throw new ErrorDeDominio("errores.turno.pendiente");
  if (input.actor.tipo !== "USUARIO") throw new Error("La gestión de baja requiere un usuario");
  const usuarioId = input.actor.usuarioId;
  const resultado = await cancelarTurnoEnTransaccion(tx, input.turnoId, usuarioId);
  despuesDelCommit(tx, () => emitirEventoTurno("turno:cancelado", input.turnoId, usuarioId, {
    turno_id: input.turnoId, estado_anterior: resultado.turno.estadoTurno, profesor_id: t.profesorId,
    aula_id: t.aulaId, alumno_ids: resultado.alumnoIds, usuario_id: usuarioId,
  }));
  return { turno_id: input.turnoId, inscriptos: resultado.alumnoIds.length };
}

export async function cambiarProfesorDeTurno(tx: Tx, input: { turnoId: string; profesorOrigenId: string; profesorDestinoId: string; actor: ActorDominio }) {
  await bloquear(tx, { recursos: { profesores: [input.profesorOrigenId, input.profesorDestinoId] }, clases: [input.turnoId] });
  if (!(await obtenerOpcionProfesorActivo(input.profesorOrigenId, tx))) throw new ErrorDeDominio("errores.profesor.inactivo");
  const t = await tx.turno.findUnique({ where: { idTurno: input.turnoId } });
  if (!t) throw new ErrorDeDominio("errores.turno.noEncontrado");
  if (t.profesorId !== input.profesorOrigenId) throw new ErrorDeDominio("errores.profesor.claseModificada");
  if (t.estadoTurno === "CANCELADO") throw new ErrorDeDominio("errores.turno.cancelado");
  if (t.estadoTurno === "PENDIENTE") throw new ErrorDeDominio("errores.turno.pendiente");
  if (!turnoSigueVigente(t.fechaTurno, t.horaInicioTurno)) throw new ErrorDeDominio("errores.turno.vencido");
  if (!(await obtenerOpcionProfesorActivo(input.profesorDestinoId, tx))) throw new ErrorDeDominio("errores.profesor.inactivo");
  if (!(await profesorActivoDictaMateria(input.profesorDestinoId, t.materiaId, tx))) throw new ErrorDeDominio("errores.profesor.noDictaMateria");
  const [evaluacion] = await evaluarCambioDeProfesor(input.profesorDestinoId, [input.turnoId], tx);
  if (evaluacion.resultado === "FUERA_DE_HORARIO") throw new ErrorDeDominio("errores.profesor.fueraHorario");
  if (evaluacion.resultado === "OCUPADO") throw new ErrorDeDominio("errores.profesor.ocupado");
  if (evaluacion.resultado !== "SE_PUEDE") throw new ErrorDeDominio("errores.profesor.claseModificada");
  if (input.actor.tipo !== "USUARIO") throw new Error("La gestión de baja requiere un usuario");
  const usuarioId = input.actor.usuarioId;
  try {
    const r = await tx.turno.updateMany({ where: { idTurno: input.turnoId, profesorId: input.profesorOrigenId, estadoTurno: t.estadoTurno },
      data: { profesorId: input.profesorDestinoId, modificadoPorUsuarioId: usuarioId } });
    if (!r.count) throw new ErrorDeDominio("errores.profesor.claseModificada");
  } catch (error) {
    if (esConflictoDeReserva(error) && recursoEnConflicto(error) === "PROFESOR") throw new ErrorDeDominio("errores.profesor.ocupado");
    throw error;
  }
  despuesDelCommit(tx, () => emitirEventoTurno("turno:profesor_cambiado", input.turnoId, usuarioId, {
    turno_id: input.turnoId, profesor_anterior_id: input.profesorOrigenId, profesor_nuevo_id: input.profesorDestinoId, usuario_id: usuarioId,
  }));
  return { turno_id: input.turnoId };
}
