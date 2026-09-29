import { Prisma, type EstadoTurno } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { turnoSigueVigente } from "./turno.validaciones";

type Db = Prisma.TransactionClient;

export type EventoTurno =
  | {
      tipoEvento: "turno:cupo_actualizado";
      turnoId: string;
      payloadEvento: {
        turno_id: string; aula_id: string; cupo_anterior: number | null;
        cupo_nuevo: number; usuario_id: string;
      };
    }
  | {
      tipoEvento: "turno:completado";
      turnoId: string;
      payloadEvento: {
        turno_id: string; alumno_ids: string[]; cupo_maximo: number; usuario_id: string;
      };
    }
  | {
      tipoEvento: "turno:disponible_nuevamente";
      turnoId: string;
      payloadEvento: {
        turno_id: string; alumno_id_liberado: null; usuario_id: string;
      };
    };

export type TurnoParaOperacion = {
  id: string;
  estado: EstadoTurno;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_min: number;
  materia_id: string;
  profesor_id: string | null;
  aula_id: string | null;
  alumno_ids: string[];
  vencido: boolean;
};

type FilaTurnoOperacion = {
  idTurno: string;
  estadoTurno: EstadoTurno;
  fechaTurno: Date;
  horaInicioTurno: Date;
  duracionMinutosTurno: number;
  materiaId: string;
  profesorId: string | null;
  aulaId: string | null;
};

function horaDeMinutos(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** El llamador conserva el bloqueo compartido hasta cerrar su transacción. */
export async function bloquearTurnoParaOperacion(turnoId: string, tx: Db): Promise<TurnoParaOperacion | null> {
  const [turno] = await tx.$queryRaw<FilaTurnoOperacion[]>`
    SELECT "idTurno", "estadoTurno", "fechaTurno", "horaInicioTurno",
           "duracionMinutosTurno", "materiaId", "profesorId", "aulaId"
    FROM "turnos" WHERE "idTurno" = ${turnoId} FOR SHARE
  `;
  if (!turno) return null;

  const alumnos = await tx.turnoAlumno.findMany({
    where: { turnoId }, select: { alumnoId: true }, orderBy: { alumnoId: "asc" },
  });
  const inicio = turno.horaInicioTurno.getUTCHours() * 60 + turno.horaInicioTurno.getUTCMinutes();
  return {
    id: turno.idTurno,
    estado: turno.estadoTurno,
    fecha: turno.fechaTurno.toISOString().slice(0, 10),
    hora_inicio: horaDeMinutos(inicio),
    hora_fin: horaDeMinutos(inicio + turno.duracionMinutosTurno),
    duracion_min: turno.duracionMinutosTurno,
    materia_id: turno.materiaId,
    profesor_id: turno.profesorId,
    aula_id: turno.aulaId,
    alumno_ids: alumnos.map(({ alumnoId }) => alumnoId),
    vencido: !turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno),
  };
}

export async function obtenerAlumnosInscriptosDeTurno(turnoId: string, db: Db = prisma): Promise<string[] | null> {
  const turno = await db.turno.findUnique({
    where: { idTurno: turnoId },
    select: { alumnos: { select: { alumnoId: true }, orderBy: { alumnoId: "asc" } } },
  });
  return turno?.alumnos.map(({ alumnoId }) => alumnoId) ?? null;
}

type ConteoProfesor = { confirmados: number; pendientes: number };

export async function contarTurnosFuturosDeProfesorPorMateria(
  profesorId: string, materiaId: string, db: Db = prisma,
): Promise<ConteoProfesor> {
  const [fila] = await db.$queryRaw<{ confirmados: bigint; pendientes: bigint }[]>`
    SELECT COUNT(*) FILTER (WHERE "estadoTurno" IN ('DISPONIBLE', 'COMPLETO')) AS confirmados,
           COUNT(*) FILTER (WHERE "estadoTurno" = 'PENDIENTE') AS pendientes
    FROM "turnos"
    WHERE "profesorId" = ${profesorId} AND "materiaId" = ${materiaId}
      AND ("fechaTurno" + "horaInicioTurno") >
          date_trunc('minute', CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
      AND "estadoTurno" IN ('PENDIENTE', 'DISPONIBLE', 'COMPLETO')
  `;
  return { confirmados: Number(fila?.confirmados ?? 0), pendientes: Number(fila?.pendientes ?? 0) };
}

type AjusteCupos =
  | { ok: true; turnos_actualizados: number; eventos: EventoTurno[] }
  | { ok: false; turnos_en_conflicto: string[]; max_inscriptos: number };

type FilaTurnoAula = {
  idTurno: string;
  estadoTurno: EstadoTurno;
  cupoMaximoTurno: number | null;
  fechaTurno: Date;
  horaInicioTurno: Date;
};

/** Solo modifica turnos dentro del tx recibido; el llamador emite los eventos tras el commit. */
export async function ajustarCuposPorCapacidadDeAula(
  aulaId: string, nuevaCapacidad: number, usuarioId: string, tx: Db,
): Promise<AjusteCupos> {
  const turnosBloqueados = await tx.$queryRaw<FilaTurnoAula[]>`
    SELECT "idTurno", "estadoTurno", "cupoMaximoTurno", "fechaTurno", "horaInicioTurno"
    FROM "turnos"
    WHERE "aulaId" = ${aulaId}
      AND "estadoTurno" IN ('PENDIENTE', 'DISPONIBLE', 'COMPLETO')
    ORDER BY "idTurno" FOR UPDATE
  `;
  const turnos = turnosBloqueados.filter((turno) =>
    turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno));
  if (turnos.length === 0) return { ok: true, turnos_actualizados: 0, eventos: [] };

  const inscripciones = await tx.turnoAlumno.findMany({
    where: { turnoId: { in: turnos.map(({ idTurno }) => idTurno) } },
    select: { turnoId: true, alumnoId: true },
    orderBy: [{ turnoId: "asc" }, { alumnoId: "asc" }],
  });
  const alumnosPorTurno = new Map<string, string[]>();
  for (const inscripcion of inscripciones) {
    const ids = alumnosPorTurno.get(inscripcion.turnoId) ?? [];
    ids.push(inscripcion.alumnoId);
    alumnosPorTurno.set(inscripcion.turnoId, ids);
  }

  const conflictos = turnos.filter((turno) => turno.estadoTurno !== "PENDIENTE"
    && (alumnosPorTurno.get(turno.idTurno)?.length ?? 0) > nuevaCapacidad);
  if (conflictos.length > 0) {
    return {
      ok: false,
      turnos_en_conflicto: [...conflictos]
        .sort((a, b) => a.fechaTurno.getTime() - b.fechaTurno.getTime()
          || a.horaInicioTurno.getTime() - b.horaInicioTurno.getTime()
          || a.idTurno.localeCompare(b.idTurno))
        .map(({ idTurno }) => idTurno),
      max_inscriptos: Math.max(...conflictos.map((turno) => alumnosPorTurno.get(turno.idTurno)!.length)),
    };
  }

  const eventos: EventoTurno[] = [];
  for (const turno of turnos) {
    const alumnoIds = alumnosPorTurno.get(turno.idTurno) ?? [];
    const nuevoEstado = turno.estadoTurno === "PENDIENTE"
      ? "PENDIENTE"
      : alumnoIds.length >= nuevaCapacidad ? "COMPLETO" : "DISPONIBLE";
    const actualizado = await tx.turno.updateMany({
      where: {
        idTurno: turno.idTurno,
        aulaId,
        estadoTurno: turno.estadoTurno,
        cupoMaximoTurno: turno.cupoMaximoTurno,
        fechaTurno: turno.fechaTurno,
        horaInicioTurno: turno.horaInicioTurno,
      },
      data: {
        cupoMaximoTurno: nuevaCapacidad,
        ...(nuevoEstado === turno.estadoTurno ? {} : { estadoTurno: nuevoEstado }),
        modificadoPorUsuarioId: usuarioId,
      },
    });
    if (actualizado.count !== 1) {
      throw new Error(`No se pudo actualizar el turno ${turno.idTurno}`);
    }
    eventos.push({
      tipoEvento: "turno:cupo_actualizado", turnoId: turno.idTurno,
      payloadEvento: {
        turno_id: turno.idTurno, aula_id: aulaId, cupo_anterior: turno.cupoMaximoTurno,
        cupo_nuevo: nuevaCapacidad, usuario_id: usuarioId,
      },
    });
    if (turno.estadoTurno === "DISPONIBLE" && nuevoEstado === "COMPLETO") {
      eventos.push({
        tipoEvento: "turno:completado", turnoId: turno.idTurno,
        payloadEvento: { turno_id: turno.idTurno, alumno_ids: alumnoIds, cupo_maximo: nuevaCapacidad, usuario_id: usuarioId },
      });
    } else if (turno.estadoTurno === "COMPLETO" && nuevoEstado === "DISPONIBLE") {
      eventos.push({
        tipoEvento: "turno:disponible_nuevamente", turnoId: turno.idTurno,
        payloadEvento: { turno_id: turno.idTurno, alumno_id_liberado: null, usuario_id: usuarioId },
      });
    }
  }
  return { ok: true, turnos_actualizados: turnos.length, eventos };
}

export async function contarTurnosPorMes(
  desde: string, hasta: string, db: Db = prisma,
): Promise<{ mes: string; cantidad: number }[]> {
  const fin = new Date(`${hasta}-01T00:00:00.000Z`);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  const hastaExclusivo = fin.toISOString().slice(0, 10);
  const filas = await db.$queryRaw<{ mes: string; cantidad: bigint }[]>`
    SELECT to_char("fechaTurno", 'YYYY-MM') AS mes, COUNT(*) AS cantidad
    FROM "turnos"
    WHERE "fechaTurno" >= CAST(${`${desde}-01`} AS date)
      AND "fechaTurno" < CAST(${hastaExclusivo} AS date)
      AND "estadoTurno" IN ('DISPONIBLE', 'COMPLETO', 'CANCELADO')
    GROUP BY to_char("fechaTurno", 'YYYY-MM')
    ORDER BY mes
  `;
  return filas.map(({ mes, cantidad }) => ({ mes, cantidad: Number(cantidad) }));
}
