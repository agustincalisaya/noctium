import { Prisma, type EstadoPagoInscripcion, type EstadoTurno, type VigenciaInscripcion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { construirFiltroBusquedaAlumno } from "@/server/alumnos/alumno.busqueda";
import { finDelDiaCentro, inicioDelDiaCentro, isoCentro } from "@/server/shared/fechas-centro";
import { ahora } from "@/server/shared/reloj";
import { esVigenteEn, sqlInstante, sqlVigenteEn } from "@/server/turnos/inscripcion.vigencia";

/**
 * Lecturas públicas de la inscripción del módulo C (PR-0.md §2.13): las usan
 * E (pestaña Clases, «Mi historial»), H (indicadores), I (historial de pagos)
 * y la pantalla «Reservas» (HU-C-26). Solo lectura, en lote, sin bloqueo. Toda
 * clasificación usa la regla única (`esVigenteEn` / `sqlVigenteEn`) en el
 * instante `ahora()`: una reserva vencida sin marcar cuenta como vencida.
 *
 * Datos de otros módulos (nombre y DNI del alumno, materia, profesor, aula):
 * se leen por las relaciones de la clase y de la inscripción, porque forman
 * parte del contrato de estas lecturas (spec_modulo_C.md §2.20 y
 * spec_modulo_E.md R2-PR0-3), igual que el listado de turnos existente.
 */

type Db = Prisma.TransactionClient;
type Rango = { desde: string; hasta: string };

const hhmm = (minutos: number) => `${String(Math.floor(minutos / 60) % 24).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
const minutosDe = (hora: Date) => hora.getUTCHours() * 60 + hora.getUTCMinutes();

/** Límites de un rango de meses «AAAA-MM» inclusivo, como fechas @db.Date: [desde, hastaExclusivo). */
function limitesDeMeses({ desde, hasta }: Rango): { inicio: string; finExclusivo: string } {
  if (!/^\d{4}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}$/.test(hasta)) throw new Error("rango: meses AAAA-MM");
  const fin = new Date(`${hasta}-01T00:00:00.000Z`);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  return { inicio: `${desde}-01`, finExclusivo: fin.toISOString().slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Inscripciones de un alumno (spec_modulo_E.md R2-PR0-3, HU-E-02, HU-C-13)
// ---------------------------------------------------------------------------

export type InscripcionDeAlumno = {
  inscripcion_id: string;
  turno_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado_clase: EstadoTurno;
  materia: { id: string; nombre: string };
  /** «Apellido, Nombre», o `null` si la clase no tiene profesor. */
  profesor: string | null;
  aula: string | null;
  vigencia: VigenciaInscripcion;
  /** `esVigenteEn(inscripcion, ahora())`. */
  vigente_ahora: boolean;
  finalizada_el: Date | null;
  /** Momento en que el centro canceló la clase (evento turno:cancelado), o `null`. */
  cancelada_el: Date | null;
  estado_pago: EstadoPagoInscripcion;
  precio: number;
};

/**
 * Todas las inscripciones del alumno, en cualquier vigencia, de la más
 * reciente a la más antigua por fecha y hora de la clase. `desde`/`hasta`
 * (AAAA-MM-DD, inclusivos) filtran por la fecha de la clase. El «resultado»
 * de cada clase (asistió, ausente…) lo calcula E con sus datos.
 */
export async function listarInscripcionesDeAlumno(
  alumnoId: string,
  filtros: { desde?: string; hasta?: string } = {},
  db: Db = prisma,
): Promise<InscripcionDeAlumno[]> {
  const momento = ahora();
  const filas = await db.turnoAlumno.findMany({
    where: {
      alumnoId,
      turno: {
        fechaTurno: {
          ...(filtros.desde ? { gte: new Date(`${filtros.desde}T00:00:00.000Z`) } : {}),
          ...(filtros.hasta ? { lte: new Date(`${filtros.hasta}T00:00:00.000Z`) } : {}),
        },
      },
    },
    include: {
      turno: {
        select: {
          idTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true, estadoTurno: true,
          materia: { select: { idMateria: true, nombreMateria: true } },
          profesor: { select: { nombreProfesor: true, apellidoProfesor: true } },
          aula: { select: { nombreAula: true } },
        },
      },
    },
  });
  const turnoIds = [...new Set(filas.map((f) => f.turnoId))];
  const cancelaciones = turnoIds.length === 0 ? [] : await db.eventoTurno.findMany({
    where: { turnoId: { in: turnoIds }, tipoEvento: "turno:cancelado" },
    orderBy: { creadoEnEvento: "asc" },
    select: { turnoId: true, creadoEnEvento: true },
  });
  const canceladaEl = new Map<string, Date>();
  for (const c of cancelaciones) if (!canceladaEl.has(c.turnoId)) canceladaEl.set(c.turnoId, c.creadoEnEvento);

  return filas
    .map((f) => {
      const inicio = minutosDe(f.turno.horaInicioTurno);
      return {
        inscripcion_id: f.idInscripcion,
        turno_id: f.turnoId,
        fecha: f.turno.fechaTurno.toISOString().slice(0, 10),
        hora_inicio: hhmm(inicio),
        hora_fin: hhmm(inicio + f.turno.duracionMinutosTurno),
        estado_clase: f.turno.estadoTurno,
        materia: { id: f.turno.materia.idMateria, nombre: f.turno.materia.nombreMateria },
        profesor: f.turno.profesor ? `${f.turno.profesor.apellidoProfesor}, ${f.turno.profesor.nombreProfesor}` : null,
        aula: f.turno.aula?.nombreAula ?? null,
        vigencia: f.vigencia,
        vigente_ahora: esVigenteEn({ ...f, estadoClase: f.turno.estadoTurno }, momento),
        finalizada_el: f.finalizadaEl,
        cancelada_el: f.turno.estadoTurno === "CANCELADO" ? canceladaEl.get(f.turnoId) ?? null : null,
        estado_pago: f.estadoPago,
        precio: f.precio,
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora_inicio.localeCompare(a.hora_inicio) || b.inscripcion_id.localeCompare(a.inscripcion_id));
}

/**
 * `true` si el alumno tiene una inscripción vigente (a `ahora()`) en una
 * clase confirmada (Disponible o Completa) de ese profesor y esa materia,
 * incluidas las futuras (spec_modulo_E.md §2.5.3, condición 1).
 */
export async function existeInscripcionVigenteConProfesor(
  alumnoId: string,
  profesorId: string,
  materiaId: string,
  db: Db = prisma,
): Promise<boolean> {
  const [fila] = await db.$queryRaw<{ existe: boolean }[]>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1 FROM "turno_alumno" ta JOIN "turnos" t ON t."idTurno" = ta."turnoId"
      WHERE ta."alumnoId" = ${alumnoId} AND t."profesorId" = ${profesorId} AND t."materiaId" = ${materiaId}
        AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO') AND ${sqlVigenteEn("ta", ahora())}
    ) AS existe`);
  return Boolean(fila?.existe);
}

// ---------------------------------------------------------------------------
// Conteos por mes (spec_modulo_H.md §2.8.2)
// ---------------------------------------------------------------------------

export type VigenciaContable = "VIGENTE" | "CANCELADA_ALUMNO" | "RESERVA_VENCIDA" | "BAJA_ALUMNO";

/**
 * Inscripciones de clases Disponibles o Completas por mes de la clase,
 * clasificadas una sola vez en `ahora()`: VIGENTE (vigente en ese instante),
 * RESERVA_VENCIDA (marcada o vencida sin marcar), CANCELADA_ALUMNO y
 * BAJA_ALUMNO. QUITADA_CENTRO nunca se devuelve. Solo los grupos con datos.
 */
export async function contarInscripcionesPorMes(
  rango: Rango,
  opciones: { vigencias: VigenciaContable[]; porMateria?: boolean },
  db: Db = prisma,
): Promise<{ mes: string; vigencia: VigenciaContable; materia_id?: string; cantidad: number }[]> {
  if (opciones.vigencias.length === 0) throw new Error("contarInscripcionesPorMes: vigencias no puede ser vacía");
  const { inicio, finExclusivo } = limitesDeMeses(rango);
  const momento = ahora();
  const clasificacion = Prisma.sql`CASE
    WHEN ${sqlVigenteEn("ta", momento)} THEN 'VIGENTE'
    WHEN ta."vigencia" = 'VIGENTE' THEN 'RESERVA_VENCIDA'
    ELSE ta."vigencia"::text END`;
  const materia = opciones.porMateria ? Prisma.sql`t."materiaId"` : Prisma.sql`NULL::text`;
  const filas = await db.$queryRaw<{ mes: string; vigencia: VigenciaContable; materia_id: string | null; cantidad: number }[]>(Prisma.sql`
    SELECT c.mes, c.vigencia, c.materia_id, count(*)::int AS cantidad FROM (
      SELECT to_char(t."fechaTurno", 'YYYY-MM') AS mes, ${clasificacion} AS vigencia, ${materia} AS materia_id
      FROM "turno_alumno" ta JOIN "turnos" t ON t."idTurno" = ta."turnoId"
      WHERE t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO') AND ta."vigencia" <> 'QUITADA_CENTRO'
        AND t."fechaTurno" >= CAST(${inicio} AS date) AND t."fechaTurno" < CAST(${finExclusivo} AS date)
    ) c
    WHERE c.vigencia IN (${Prisma.join(opciones.vigencias)})
    GROUP BY c.mes, c.vigencia, c.materia_id
    ORDER BY c.mes, c.vigencia, c.materia_id COLLATE "C"`);
  return filas.map((f) => ({ mes: f.mes, vigencia: f.vigencia, ...(opciones.porMateria ? { materia_id: f.materia_id! } : {}), cantidad: f.cantidad }));
}

// ---------------------------------------------------------------------------
// Reservas (HU-C-26, spec_modulo_C.md §2.20)
// ---------------------------------------------------------------------------

const POR_PAGINA = 10;
const MINUTOS_VENCE_PRONTO = 180;
const HORA_MS = 60 * 60 * 1000;

type Paginacion = { total: number; pagina_actual: number; total_paginas: number; por_pagina: number };
const paginacion = (total: number, pagina: number): Paginacion =>
  ({ total, pagina_actual: pagina, total_paginas: Math.max(1, Math.ceil(total / POR_PAGINA)), por_pagina: POR_PAGINA });

const SELECT_RESERVA = {
  idInscripcion: true, alumnoId: true, venceEl: true, precio: true, vigencia: true,
  alumno: { select: { nombreAlumno: true, apellidoAlumno: true, dniAlumno: true } },
  turno: {
    select: {
      idTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true,
      materia: { select: { idMateria: true, nombreMateria: true } },
      aula: { select: { idAula: true, nombreAula: true } },
      profesor: { select: { idProfesor: true, nombreProfesor: true, apellidoProfesor: true } },
    },
  },
} satisfies Prisma.TurnoAlumnoSelect;
type FilaReserva = Prisma.TurnoAlumnoGetPayload<{ select: typeof SELECT_RESERVA }>;

function claseDeReserva(f: FilaReserva) {
  const inicio = minutosDe(f.turno.horaInicioTurno);
  return {
    turno_id: f.turno.idTurno,
    fecha: f.turno.fechaTurno.toISOString().slice(0, 10),
    hora_inicio: hhmm(inicio),
    hora_fin: hhmm(inicio + f.turno.duracionMinutosTurno),
    materia: { id: f.turno.materia.idMateria, nombre: f.turno.materia.nombreMateria },
  };
}

/** Reservas pendientes: RESERVADA, vigente, de clase Disponible o Completa y con vencimiento posterior a `momento`. */
const condicionPendiente = (momento: Date): Prisma.TurnoAlumnoWhereInput => ({
  vigencia: "VIGENTE", estadoPago: "RESERVADA", venceEl: { gt: momento },
  turno: { estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] } },
});

export type ReservaPendiente = {
  inscripcion_id: string;
  vence_el: string;
  faltan_min: number;
  vence_pronto: boolean;
  alumno: { id: string; nombre_para_mostrar: string; dni: string; reservas_pendientes: number };
  clase: ReturnType<typeof claseDeReserva> & { aula: { id: string; nombre: string } | null };
  profesor: { id: string; nombre_para_mostrar: string } | null;
  precio: number;
};

/**
 * Reservas pendientes de todas las clases (spec_modulo_C.md §2.20.2), por
 * vencimiento ascendente y de a 10. Las ya vencidas (marcadas o no) y las de
 * clases canceladas no se listan. `reservas_pendientes` cuenta sobre el
 * conjunto sin filtrar.
 */
export async function listarReservasPendientes(
  filtros: { alumno?: string; materiaId?: string; vencen?: "en_3_horas" | "hoy" | "manana"; pagina?: number } = {},
  db: Db = prisma,
): Promise<{ items: ReservaPendiente[]; paginacion: Paginacion }> {
  const momento = ahora();
  const pagina = filtros.pagina ?? 1;
  const finDelDia = finDelDiaCentro(momento);
  const vence: Prisma.DateTimeNullableFilter | undefined =
    filtros.vencen === "en_3_horas" ? { lte: new Date(momento.getTime() + MINUTOS_VENCE_PRONTO * 60_000) }
      : filtros.vencen === "hoy" ? { lt: finDelDia }
        : filtros.vencen === "manana" ? { gte: finDelDia, lt: new Date(finDelDia.getTime() + 24 * HORA_MS) }
          : undefined;
  const filtroAlumno = construirFiltroBusquedaAlumno(filtros.alumno);
  const where: Prisma.TurnoAlumnoWhereInput = {
    AND: [
      condicionPendiente(momento),
      ...(vence ? [{ venceEl: vence }] : []),
      ...(filtros.materiaId ? [{ turno: { materiaId: filtros.materiaId } }] : []),
      ...(filtroAlumno ? [{ alumno: filtroAlumno }] : []),
    ],
  };
  const [total, filas] = await Promise.all([
    db.turnoAlumno.count({ where }),
    db.turnoAlumno.findMany({
      where, select: SELECT_RESERVA, orderBy: [{ venceEl: "asc" }, { idInscripcion: "asc" }],
      skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA,
    }),
  ]);
  const porAlumno = await db.turnoAlumno.groupBy({
    by: ["alumnoId"], where: { ...condicionPendiente(momento), alumnoId: { in: [...new Set(filas.map((f) => f.alumnoId))] } }, _count: true,
  });
  const pendientesDe = new Map(porAlumno.map((g) => [g.alumnoId, g._count]));
  const items = filas.map((f) => {
    const faltanMin = Math.floor((f.venceEl!.getTime() - momento.getTime()) / 60_000);
    return {
      inscripcion_id: f.idInscripcion,
      vence_el: isoCentro(f.venceEl!),
      faltan_min: faltanMin,
      vence_pronto: faltanMin <= MINUTOS_VENCE_PRONTO,
      alumno: {
        id: f.alumnoId, nombre_para_mostrar: `${f.alumno.apellidoAlumno}, ${f.alumno.nombreAlumno}`,
        dni: f.alumno.dniAlumno, reservas_pendientes: pendientesDe.get(f.alumnoId) ?? 0,
      },
      clase: { ...claseDeReserva(f), aula: f.turno.aula ? { id: f.turno.aula.idAula, nombre: f.turno.aula.nombreAula } : null },
      profesor: f.turno.profesor
        ? { id: f.turno.profesor.idProfesor, nombre_para_mostrar: `${f.turno.profesor.apellidoProfesor}, ${f.turno.profesor.nombreProfesor}` }
        : null,
      precio: f.precio,
    };
  });
  return { items, paginacion: paginacion(total, pagina) };
}

export type ReservaVencida = {
  inscripcion_id: string;
  vencio_el: string;
  sin_marcar: boolean;
  alumno: { id: string; nombre_para_mostrar: string; dni: string };
  clase: ReturnType<typeof claseDeReserva>;
  precio: number;
};

/**
 * Reservas vencidas en los últimos `dias` días del centro (spec_modulo_C.md
 * §2.20.3), de la más reciente a la más antigua: las marcadas RESERVA_VENCIDA
 * (sea cual sea el estado actual de la clase) y las vencidas sin marcar de
 * clases Disponibles o Completas (`sin_marcar`). De a 10.
 */
export async function listarReservasVencidas(
  filtros: { dias?: number; alumno?: string; materiaId?: string; pagina?: number } = {},
  db: Db = prisma,
): Promise<{ items: ReservaVencida[]; paginacion: Paginacion }> {
  const momento = ahora();
  const pagina = filtros.pagina ?? 1;
  const desde = new Date(inicioDelDiaCentro(momento).getTime() - ((filtros.dias ?? 7) - 1) * 24 * HORA_MS);
  const filtroAlumno = construirFiltroBusquedaAlumno(filtros.alumno);
  const where: Prisma.TurnoAlumnoWhereInput = {
    AND: [
      { venceEl: { gte: desde, lte: momento } },
      {
        OR: [
          { vigencia: "RESERVA_VENCIDA" },
          { vigencia: "VIGENTE", estadoPago: "RESERVADA", turno: { estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] } } },
        ],
      },
      ...(filtros.materiaId ? [{ turno: { materiaId: filtros.materiaId } }] : []),
      ...(filtroAlumno ? [{ alumno: filtroAlumno }] : []),
    ],
  };
  const [total, filas] = await Promise.all([
    db.turnoAlumno.count({ where }),
    db.turnoAlumno.findMany({
      where, select: SELECT_RESERVA, orderBy: [{ venceEl: "desc" }, { idInscripcion: "desc" }],
      skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA,
    }),
  ]);
  const items = filas.map((f) => ({
    inscripcion_id: f.idInscripcion,
    vencio_el: isoCentro(f.venceEl!),
    sin_marcar: f.vigencia === "VIGENTE",
    alumno: { id: f.alumnoId, nombre_para_mostrar: `${f.alumno.apellidoAlumno}, ${f.alumno.nombreAlumno}`, dni: f.alumno.dniAlumno },
    clase: claseDeReserva(f),
    precio: f.precio,
  }));
  return { items, paginacion: paginacion(total, pagina) };
}

/**
 * Totales de la pantalla «Reservas» (spec_modulo_C.md §2.20.1): pendientes con
 * su importe, las que vencen en las próximas 3 horas y antes del fin del día,
 * y las que vencieron hoy (marcadas o no; en una clase cancelada no vence nada).
 */
export async function resumenReservas(db: Db = prisma): Promise<{
  pendientes: { cantidad: number; importe_total: number };
  vencen_en_3_horas: number;
  vencen_hoy: number;
  vencieron_hoy: number;
}> {
  const momento = ahora();
  const [fila] = await db.$queryRaw<{ cantidad: number; importe: number; en3: number; hoy: number; vencieron: number }[]>(Prisma.sql`
    SELECT
      count(*) FILTER (WHERE p.pendiente)::int AS cantidad,
      COALESCE(sum(p.precio) FILTER (WHERE p.pendiente), 0)::int AS importe,
      count(*) FILTER (WHERE p.pendiente AND p."venceEl" <= ${sqlInstante(new Date(momento.getTime() + MINUTOS_VENCE_PRONTO * 60_000))})::int AS en3,
      count(*) FILTER (WHERE p.pendiente AND p."venceEl" < ${sqlInstante(finDelDiaCentro(momento))})::int AS hoy,
      count(*) FILTER (WHERE p.vencio_hoy)::int AS vencieron
    FROM (
      SELECT ta.precio, ta."venceEl",
        (ta."vigencia" = 'VIGENTE' AND ta."estadoPago" = 'RESERVADA' AND ta."venceEl" > ${sqlInstante(momento)}
          AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')) AS pendiente,
        (ta."venceEl" >= ${sqlInstante(inicioDelDiaCentro(momento))} AND ta."venceEl" <= ${sqlInstante(momento)}
          AND (ta."vigencia" = 'RESERVA_VENCIDA'
            OR (ta."vigencia" = 'VIGENTE' AND ta."estadoPago" = 'RESERVADA' AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')))) AS vencio_hoy
      FROM "turno_alumno" ta JOIN "turnos" t ON t."idTurno" = ta."turnoId"
      WHERE ta."estadoPago" = 'RESERVADA'
    ) p`);
  return {
    pendientes: { cantidad: fila?.cantidad ?? 0, importe_total: fila?.importe ?? 0 },
    vencen_en_3_horas: fila?.en3 ?? 0,
    vencen_hoy: fila?.hoy ?? 0,
    vencieron_hoy: fila?.vencieron ?? 0,
  };
}
