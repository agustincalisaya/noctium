import { Prisma, type EstadoTurno } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ahora } from "@/server/shared/reloj";
import { estadoSegunOcupacion, filtroVigenteEn, inscripcionesVigentes, sqlVigenteEn } from "@/server/turnos/inscripcion.vigencia";
import { turnoNoHaComenzado, turnoSigueVigente } from "./turno.validaciones";

type Db = Prisma.TransactionClient;

export type EventoTurnoPendiente =
  | {
      tipoEvento: "turno:configurado";
      turnoId: string;
      payloadEvento: {
        turno_id: string; fecha: string; hora_inicio: string; hora_fin: string;
        duracion_min: number; materia_id: string; profesor_id: string;
        generacion_id: string; usuario_id: string;
      };
    }
  | {
      tipoEvento: "turno:aula_asignada";
      turnoId: string;
      payloadEvento: {
        turno_id: string; aula_id: string; cupo_maximo: number; usuario_id: string;
      };
    }
  | {
      tipoEvento: "turno:disponibilizado";
      turnoId: string;
      payloadEvento: {
        turno_id: string; fecha: string; hora_inicio: string; hora_fin: string;
        alumno_ids: string[]; profesor_id: string; aula_id: string; materia_id: string; usuario_id: string;
      };
    }
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

/** Alias previo, conservado para los consumidores existentes (Aulas). */
export type EventoTurno = EventoTurnoPendiente;

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
  cupoMaximoTurno: number | null;
};

function horaDeMinutos(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** El llamador conserva el bloqueo compartido hasta cerrar su transacción. */
export async function bloquearTurnoParaOperacion(turnoId: string, tx: Db): Promise<TurnoParaOperacion | null> {
  const [turno] = await tx.$queryRaw<FilaTurnoOperacion[]>`
    SELECT "idTurno", "estadoTurno", "fechaTurno", "horaInicioTurno",
           "duracionMinutosTurno", "materiaId", "profesorId", "aulaId", "cupoMaximoTurno"
    FROM "turnos" WHERE "idTurno" = ${turnoId} FOR SHARE
  `;
  if (!turno) return null;

  // Solo las inscripciones vigentes ahora (PR-0.md §2.0 y §2.2), por alumno.
  const alumnos = (await inscripcionesVigentes(tx, turnoId, ahora()))
    .map(({ alumnoId }) => alumnoId)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const inicio = turno.horaInicioTurno.getUTCHours() * 60 + turno.horaInicioTurno.getUTCMinutes();
  return {
    id: turno.idTurno,
    estado: estadoSegunOcupacion(turno.estadoTurno, alumnos.length, turno.cupoMaximoTurno),
    fecha: turno.fechaTurno.toISOString().slice(0, 10),
    hora_inicio: horaDeMinutos(inicio),
    hora_fin: horaDeMinutos(inicio + turno.duracionMinutosTurno),
    duracion_min: turno.duracionMinutosTurno,
    materia_id: turno.materiaId,
    profesor_id: turno.profesorId,
    aula_id: turno.aulaId,
    alumno_ids: alumnos,
    vencido: !turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno),
  };
}

export async function obtenerAlumnosInscriptosDeTurno(turnoId: string, db: Db = prisma): Promise<string[] | null> {
  const turno = await db.turno.findUnique({
    where: { idTurno: turnoId },
    select: { alumnos: { where: filtroVigenteEn(ahora()), select: { alumnoId: true }, orderBy: { alumnoId: "asc" } } },
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

/** Fila del modal «Ver turnos» de HU-D-07 (spec_modulo_C.md §2.15). */
export type TurnoFuturoDeMateria = {
  turno_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
  /** "inscriptos/cupo", mismo formato que `presentar()` del listado (HU-C-01). */
  alumnos_inscriptos: string;
  estado: "DISPONIBLE" | "COMPLETO";
};

type FilaTurnoFuturo = {
  idTurno: string;
  fechaTurno: Date;
  horaInicioTurno: Date;
  duracionMinutosTurno: number;
  cupoMaximoTurno: number | null;
  estadoTurno: "DISPONIBLE" | "COMPLETO";
  nombreAula: string | null;
  inscriptos: bigint;
};

/**
 * Turnos que bloquean quitarle la materia al profesor (HU-D-07 AC3): mismo
 * criterio de «futuro» y mismos estados que
 * `contarTurnosFuturosDeProfesorPorMateria()` (`confirmados`), así `total`
 * coincide con ese conteo. Orden por fecha, hora e id. Solo lectura.
 */
export async function listarTurnosFuturosDeProfesorPorMateria(
  profesorId: string,
  materiaId: string,
  { pagina, porPagina }: { pagina: number; porPagina: number },
  db: Db = prisma,
): Promise<{ items: TurnoFuturoDeMateria[]; total: number; pagina: number; por_pagina: number }> {
  const [conteo] = await db.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total
    FROM "turnos"
    WHERE "profesorId" = ${profesorId} AND "materiaId" = ${materiaId}
      AND "estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
      AND ("fechaTurno" + "horaInicioTurno") >
          date_trunc('minute', CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
  `;
  const total = Number(conteo?.total ?? 0);
  const filas = total === 0 ? [] : await db.$queryRaw<FilaTurnoFuturo[]>`
    SELECT t."idTurno", t."fechaTurno", t."horaInicioTurno", t."duracionMinutosTurno",
           t."cupoMaximoTurno", t."estadoTurno", a."nombreAula",
           (SELECT COUNT(*) FROM "turno_alumno" ta WHERE ta."turnoId" = t."idTurno" AND ${sqlVigenteEn("ta", ahora())}) AS inscriptos
    FROM "turnos" t
    LEFT JOIN "aulas" a ON a."idAula" = t."aulaId"
    WHERE t."profesorId" = ${profesorId} AND t."materiaId" = ${materiaId}
      AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
      AND (t."fechaTurno" + t."horaInicioTurno") >
          date_trunc('minute', CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
    ORDER BY t."fechaTurno", t."horaInicioTurno", t."idTurno"
    LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}
  `;
  return {
    items: filas.map((fila) => {
      const inicio = fila.horaInicioTurno.getUTCHours() * 60 + fila.horaInicioTurno.getUTCMinutes();
      const inscriptos = Number(fila.inscriptos);
      return {
        turno_id: fila.idTurno,
        fecha: fila.fechaTurno.toISOString().slice(0, 10),
        hora_inicio: horaDeMinutos(inicio),
        hora_fin: horaDeMinutos(inicio + fila.duracionMinutosTurno),
        aula: fila.nombreAula ?? "Sin asignar",
        alumnos_inscriptos: fila.cupoMaximoTurno === null ? "Sin asignar" : `${inscriptos}/${fila.cupoMaximoTurno}`,
        estado: estadoSegunOcupacion(fila.estadoTurno, inscriptos, fila.cupoMaximoTurno) as "DISPONIBLE" | "COMPLETO",
      };
    }),
    total,
    pagina,
    por_pagina: porPagina,
  };
}

type AjusteCupos =
  | { ok: true; turnos_actualizados: number; eventos: EventoTurnoPendiente[] }
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
  const ahora = new Date();
  const turnos = turnosBloqueados.filter((turno) =>
    turnoNoHaComenzado(turno.fechaTurno, turno.horaInicioTurno, ahora));
  if (turnos.length === 0) return { ok: true, turnos_actualizados: 0, eventos: [] };

  const inscripciones = await tx.turnoAlumno.findMany({
    where: { turnoId: { in: turnos.map(({ idTurno }) => idTurno) }, ...filtroVigenteEn(ahora) },
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

  const eventos: EventoTurnoPendiente[] = [];
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

/** El llamador la invoca después del COMMIT (Regla N.° 2, opción b); un único INSERT graba todos o ninguno. */
export async function emitirEventosTurno(eventos: EventoTurnoPendiente[], db: Db = prisma): Promise<void> {
  if (eventos.length === 0) return;
  await db.eventoTurno.createMany({
    data: eventos.map(({ tipoEvento, turnoId, payloadEvento }) => ({
      tipoEvento, turnoId, usuarioId: payloadEvento.usuario_id, payloadEvento,
    })),
  });
}

/**
 * Ocupación promedio por mes de los turnos dictados (spec_modulo_C.md §2.15,
 * consumida por spec_modulo_H.md §2.3). Promedia `inscriptos / cupo` de los
 * turnos DISPONIBLE/COMPLETO con cupo asignado, sin redondear (razón 0–1).
 * `desde`/`hasta` son meses AAAA-MM inclusivos y `fechaMaxima` (AAAA-MM-DD,
 * inclusiva) deja afuera los turnos que todavía no ocurrieron. Solo devuelve
 * los meses con turnos: los ceros los completa Indicadores.
 */
export async function promediarOcupacionTurnosPorMes(
  desde: string, hasta: string, fechaMaxima: string, db: Db = prisma,
): Promise<{ mes: string; promedio: number; turnos: number }[]> {
  const fin = new Date(`${hasta}-01T00:00:00.000Z`);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  const hastaExclusivo = fin.toISOString().slice(0, 10);
  const filas = await db.$queryRaw<{ mes: string; promedio: number; turnos: bigint }[]>`
    SELECT to_char(t."fechaTurno", 'YYYY-MM') AS mes,
      -- numeric: AVG sobre float8 depende del orden de suma y movía el redondeo en el borde .5.
      AVG(COALESCE(i.inscriptos, 0)::numeric / t."cupoMaximoTurno")::float8 AS promedio,
      COUNT(*) AS turnos
    FROM "turnos" t
    LEFT JOIN (
      SELECT ta."turnoId", COUNT(*) AS inscriptos FROM "turno_alumno" ta
      WHERE ${sqlVigenteEn("ta", ahora())} GROUP BY ta."turnoId"
    ) i ON i."turnoId" = t."idTurno"
    WHERE t."fechaTurno" >= CAST(${`${desde}-01`} AS date)
      AND t."fechaTurno" < CAST(${hastaExclusivo} AS date)
      AND t."fechaTurno" <= CAST(${fechaMaxima} AS date)
      AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
      AND t."cupoMaximoTurno" > 0
    GROUP BY to_char(t."fechaTurno", 'YYYY-MM')
    ORDER BY mes
  `;
  return filas.map(({ mes, promedio, turnos }) => ({ mes, promedio: Number(promedio), turnos: Number(turnos) }));
}

// ---------------------------------------------------------------------------
// Lecturas de clases para otros módulos (PR-0.md §2.9 y §2.13,
// spec_modulo_H.md §2.8.1, spec_modulo_D.md). Solo lectura, sin bloqueo.
// ---------------------------------------------------------------------------

type EstadoContable = Exclude<EstadoTurno, "PENDIENTE">;

/**
 * Clases por mes de su fecha y por estado (y por materia o profesor si se
 * pide), con la suma de sus duraciones. Solo DISPONIBLE, COMPLETO y
 * CANCELADO: PENDIENTE es un error de programación. Con `por: "profesor"` no
 * se cuentan las clases sin profesor. No depende de las inscripciones.
 */
export async function contarClasesPorMes(
  rango: { desde: string; hasta: string },
  opciones: { estados: EstadoContable[]; por?: "materia" | "profesor" },
  db: Db = prisma,
): Promise<{ mes: string; estado: EstadoContable; materia_id?: string; profesor_id?: string; cantidad: number; minutos: number }[]> {
  if (opciones.estados.length === 0) throw new Error("contarClasesPorMes: estados no puede ser vacía");
  if ((opciones.estados as string[]).includes("PENDIENTE")) throw new Error("contarClasesPorMes: PENDIENTE no se cuenta");
  if (!/^\d{4}-\d{2}$/.test(rango.desde) || !/^\d{4}-\d{2}$/.test(rango.hasta)) throw new Error("contarClasesPorMes: meses AAAA-MM");
  const fin = new Date(`${rango.hasta}-01T00:00:00.000Z`);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  const clave = opciones.por === "materia" ? Prisma.sql`t."materiaId"` : opciones.por === "profesor" ? Prisma.sql`t."profesorId"` : Prisma.sql`NULL::text`;
  const sinProfesor = opciones.por === "profesor" ? Prisma.sql`AND t."profesorId" IS NOT NULL` : Prisma.empty;
  const filas = await db.$queryRaw<{ mes: string; estado: EstadoContable; clave: string | null; cantidad: number; minutos: number }[]>(Prisma.sql`
    SELECT to_char(t."fechaTurno", 'YYYY-MM') AS mes, t."estadoTurno"::text AS estado, ${clave} AS clave,
      count(*)::int AS cantidad, COALESCE(sum(t."duracionMinutosTurno"), 0)::int AS minutos
    FROM "turnos" t
    WHERE t."estadoTurno"::text IN (${Prisma.join(opciones.estados)}) ${sinProfesor}
      AND t."fechaTurno" >= CAST(${`${rango.desde}-01`} AS date) AND t."fechaTurno" < CAST(${fin.toISOString().slice(0, 10)} AS date)
    GROUP BY 1, 2, 3
    ORDER BY 1, 2, ${clave} COLLATE "C"`);
  return filas.map((f) => ({
    mes: f.mes, estado: f.estado,
    ...(opciones.por === "materia" ? { materia_id: f.clave! } : {}),
    ...(opciones.por === "profesor" ? { profesor_id: f.clave! } : {}),
    cantidad: f.cantidad, minutos: f.minutos,
  }));
}

/**
 * Alcance del gerente en el flujo de baja de un profesor (HU-D-08, PR-0.md
 * §2.9, R3-PR0-D2): `true` si la clase pertenece al profesor indicado, sin
 * mirar estado ni fecha (que sea futura y esté Disponible o Completa lo exige
 * la función de C que la procesa).
 */
export async function gerentePuedeGestionarClaseDeBaja(turnoId: string, profesorId: string, db: Db = prisma): Promise<boolean> {
  const turno = await db.turno.findUnique({ where: { idTurno: turnoId }, select: { profesorId: true } });
  return turno?.profesorId === profesorId;
}
