import { prisma } from "@/lib/prisma";
import type { EstadoTurno, Prisma } from "@prisma/client";
import { ahora as relojAhora } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";
import { marcarVencidas, recalcularVencimientos } from "./inscripcion.service";
import { filtroVigenteEn, inscripcionesVigentes } from "./inscripcion.vigencia";
import { diaSemanaDeFecha, horaAMinutos, minutosAHora } from "@/lib/horario-atencion";
import { estaDentroDeHorarioAtencion, obtenerHorariosDeAtencion } from "@/server/profesores/profesor.publico";
import { ServiceError } from "@/server/shared/service-error";
import { alumnosConTurnoSuperpuesto, aulaConTurnoSuperpuesto, calcularTramosLibres, ESTADOS_AGENDADOS, horaDeMinutos, iniciosPosibles, intervaloTurno, profesoresConTurnoSuperpuesto } from "./turno.disponibilidad";
import { alumnoEnConflicto, esConflictoDeReserva, recursoEnConflicto } from "./turno.reserva-error";
import type { ReprogramarTurnoInput } from "./turno.schema";
import { emitirEventoTurno } from "./turno.service";
import { calcularTopeReprogramacion, horaLocal, parametrosConfiguracionTurno, turnoSigueVigente, validarDiaReprogramable, validarFechaHoraTurno } from "./turno.validaciones";

export type RecursoConflicto = "PROFESOR" | "AULA" | "ALUMNO";
export type ConflictoReprogramacion = { recurso: RecursoConflicto; id: string };

type FilaTurno = {
  idTurno: string;
  estadoTurno: EstadoTurno;
  fechaTurno: Date;
  horaInicioTurno: Date;
  duracionMinutosTurno: number;
  profesorId: string | null;
  aulaId: string | null;
};

const fechaIso = (fecha: Date) => fecha.toISOString().slice(0, 10);
const horaIso = (hora: Date) => hora.toISOString().slice(11, 16);
const horaFecha = (hora: string) => new Date(`1970-01-01T${hora}:00.000Z`);
const MENSAJE_CONFLICTO = "El profesor, el aula o algún alumno inscripto no están disponibles en ese horario";

/** Estados y vigencia admitidos para reprogramar (§2.11 pasos 1 y 2, R5-6). */
function verificarReprogramable(turno: FilaTurno | null): asserts turno is FilaTurno {
  if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
  if (turno.estadoTurno === "PENDIENTE") throw new ServiceError("TURNO_PENDIENTE", "Un turno pendiente se modifica desde su configuración");
  if (turno.estadoTurno === "CANCELADO") throw new ServiceError("TURNO_CANCELADO", "Un turno cancelado no se puede reprogramar");
  if (!turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno)) throw new ServiceError("TURNO_VENCIDO", "El horario del turno ya pasó: no se puede reprogramar");
}

/**
 * Triple validación de AC2 contra turnos DISPONIBLE/COMPLETO, excluyendo el
 * propio turno: profesor (horario de atención y superposición), aula y cada
 * alumno inscripto. Devuelve todos los conflictos, a lo sumo uno por recurso e id.
 */
async function conflictosDelHorario(db: Prisma.TransactionClient, turno: FilaTurno, fecha: Date, horaInicio: string, alumnoIds: string[]) {
  const candidato = { idTurno: turno.idTurno, fechaTurno: fecha, horaInicioTurno: horaFecha(horaInicio), duracionMinutosTurno: turno.duracionMinutosTurno };
  const intervalo = intervaloTurno(candidato);
  const conflictos: ConflictoReprogramacion[] = [];
  if (turno.profesorId) {
    const enHorario = await estaDentroDeHorarioAtencion(turno.profesorId, fecha, horaDeMinutos(intervalo.inicio), horaDeMinutos(intervalo.fin), db);
    const ocupado = (await profesoresConTurnoSuperpuesto(db, candidato, [turno.profesorId])).has(turno.profesorId);
    if (!enHorario || ocupado) conflictos.push({ recurso: "PROFESOR", id: turno.profesorId });
  }
  if (turno.aulaId && await aulaConTurnoSuperpuesto(db, candidato, turno.aulaId)) conflictos.push({ recurso: "AULA", id: turno.aulaId });
  for (const alumnoId of await alumnosConTurnoSuperpuesto(db, candidato, alumnoIds, relojAhora())) conflictos.push({ recurso: "ALUMNO", id: alumnoId });
  return conflictos;
}

function errorConflicto(conflictos: ConflictoReprogramacion[]) {
  return new ServiceError("REPROGRAMACION_CONFLICTO", MENSAJE_CONFLICTO, { conflictos });
}

/** Alumnos con inscripción vigente ahora (PR-0.md §2.2), por id. */
async function inscriptos(db: Prisma.TransactionClient, turnoId: string) {
  const filas = await inscripcionesVigentes(db, turnoId, relojAhora());
  return filas.map(({ alumnoId }) => alumnoId).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const SELECT_TURNO = {
  idTurno: true, estadoTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true, profesorId: true, aulaId: true,
} as const;

/**
 * HU-C-06 (endpoint de opciones acordado el 30/09/2026): horas de inicio
 * ofrecidas para `fecha`. Solo lectura y de buena fe: el PATCH revalida todo.
 * Franjas del profesor menos lo ocupado por el profesor, el aula y cada alumno
 * (sin el propio turno). `actual` marca la hora vigente solo en su propia fecha.
 */
export async function opcionesReprogramacion(id: string, fecha: Date) {
  const turno = await prisma.turno.findUnique({ where: { idTurno: id }, select: SELECT_TURNO });
  verificarReprogramable(turno);
  const parametros = await parametrosConfiguracionTurno();
  const ahora = new Date();
  const tope = calcularTopeReprogramacion(turno.fechaTurno, parametros, ahora);
  validarDiaReprogramable(fecha, tope, parametros, ahora);

  const alumnoIds = await inscriptos(prisma, id);
  const dia = diaSemanaDeFecha(fecha);
  const [horarios, ocupadosFilas] = await Promise.all([
    turno.profesorId ? obtenerHorariosDeAtencion(turno.profesorId) : Promise.resolve([]),
    prisma.turno.findMany({
      where: {
        idTurno: { not: id }, fechaTurno: fecha, estadoTurno: { in: ESTADOS_AGENDADOS },
        OR: [
          ...(turno.profesorId ? [{ profesorId: turno.profesorId }] : []),
          ...(turno.aulaId ? [{ aulaId: turno.aulaId }] : []),
          ...(alumnoIds.length ? [{ alumnos: { some: { alumnoId: { in: alumnoIds }, ...filtroVigenteEn(relojAhora()) } } }] : []),
        ],
      },
      select: { horaInicioTurno: true, duracionMinutosTurno: true },
    }),
  ]);
  const ocupados = ocupadosFilas.map(intervaloTurno);
  const apertura = horaAMinutos(parametros.apertura);
  const cierre = horaAMinutos(parametros.cierre);
  const local = horaLocal(ahora);
  const esHoy = fechaIso(fecha) === local.fecha;
  const minutos = new Set<number>();
  for (const horario of horarios.filter((franja) => franja.dia_semana === dia)) {
    const inicio = Math.max(horaAMinutos(horario.hora_inicio), apertura);
    const fin = Math.min(horaAMinutos(horario.hora_fin), cierre);
    if (inicio >= fin) continue;
    for (const tramo of calcularTramosLibres({ inicio, fin }, ocupados)) {
      for (const minuto of iniciosPosibles(tramo, turno.duracionMinutosTurno, parametros.granularidad_minutos)) {
        if (!esHoy || minuto > horaAMinutos(local.hora)) minutos.add(minuto);
      }
    }
  }
  const mismaFecha = fechaIso(fecha) === fechaIso(turno.fechaTurno);
  const horaActual = horaIso(turno.horaInicioTurno);
  return {
    fecha: fechaIso(fecha),
    duracion_min: turno.duracionMinutosTurno,
    tope_fecha: fechaIso(tope),
    inicios: [...minutos].sort((a, b) => a - b).map((minuto) => ({
      hora_inicio: minutosAHora(minuto),
      hora_fin: minutosAHora(minuto + turno.duracionMinutosTurno),
      actual: mismaFecha && minutosAHora(minuto) === horaActual,
    })),
  };
}

/**
 * HU-C-06 (spec_modulo_C.md §2.11): cambia solo fecha y hora de inicio de un
 * turno DISPONIBLE/COMPLETO vigente. Revalida todo dentro de la transacción
 * con la fila bloqueada; el trigger mueve las reservas y la exclusión GiST es
 * la defensa final (23P01 → REPROGRAMACION_CONFLICTO, con rollback). Estado,
 * duración, materia, profesor, aula, cupo, prioridad, inscripciones y pagos
 * no se escriben. Las reservas: antes de mover la clase se marcan las ya
 * vencidas (con su `venceEl` anterior) y después se recalcula el vencimiento
 * de las que siguen con el nuevo inicio (`recalcularVencimientos`, PR-0.md
 * §2.0). Evento `turno:reprogramado` después del COMMIT.
 */
export async function reprogramarTurno(id: string, input: ReprogramarTurnoInput, usuarioId: string) {
  let bloqueado: FilaTurno | null = null;
  let resultado: { turno: FilaTurno; horaFin: string };
  try {
    resultado = await transaccion(async (tx) => {
      const [turno] = await tx.$queryRaw<FilaTurno[]>`
        SELECT "idTurno", "estadoTurno", "fechaTurno", "horaInicioTurno", "duracionMinutosTurno", "profesorId", "aulaId"
        FROM "turnos" WHERE "idTurno" = ${id} FOR UPDATE
      `;
      verificarReprogramable(turno ?? null);
      bloqueado = turno;
      await marcarVencidas(tx, id);
      const parametros = await parametrosConfiguracionTurno();
      const tope = calcularTopeReprogramacion(turno.fechaTurno, parametros);
      const { hora_fin } = await validarFechaHoraTurno({ fecha: input.fecha, hora_inicio: input.hora_inicio, duracion_min: turno.duracionMinutosTurno }, { topeFecha: tope, parametros });

      const conflictos = await conflictosDelHorario(tx, turno, input.fecha, input.hora_inicio, await inscriptos(tx, id));
      if (conflictos.length) throw errorConflicto(conflictos);

      const actualizado = await tx.turno.updateMany({
        where: { idTurno: id, estadoTurno: { in: ESTADOS_AGENDADOS } },
        data: { fechaTurno: input.fecha, horaInicioTurno: horaFecha(input.hora_inicio), modificadoPorUsuarioId: usuarioId },
      });
      if (actualizado.count === 0) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");
      await recalcularVencimientos(tx, id);
      return { turno, horaFin: hora_fin };
    });
  } catch (error) {
    if (!esConflictoDeReserva(error)) throw error;
    // Defensa de motor (§3.4): otro turno tomó el recurso entre la validación y el UPDATE.
    const fila = bloqueado as FilaTurno | null;
    const recurso = recursoEnConflicto(error);
    const recursoId = recurso === "ALUMNO" ? alumnoEnConflicto(error) : recurso === "PROFESOR" ? fila?.profesorId : recurso === "AULA" ? fila?.aulaId : undefined;
    throw errorConflicto(recurso && recursoId ? [{ recurso, id: recursoId }] : []);
  }

  const { turno, horaFin } = resultado;
  await emitirEventoTurno("turno:reprogramado", id, usuarioId, {
    turno_id: id,
    fecha_anterior: fechaIso(turno.fechaTurno),
    hora_inicio_anterior: horaIso(turno.horaInicioTurno),
    fecha_nueva: fechaIso(input.fecha),
    hora_inicio_nueva: input.hora_inicio,
    hora_fin_nueva: horaFin,
    usuario_id: usuarioId,
  });
  return { id, fecha: fechaIso(input.fecha), hora_inicio: input.hora_inicio, hora_fin: horaFin, estado: turno.estadoTurno };
}
