import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sqlAsistenciaVigente, sqlClaseDictadaVigente, sqlConControlVigente } from "@/server/historial/valor-vigente";

type Db = Prisma.TransactionClient;

/** Contratos públicos de Historial para los módulos consumidores. */
export async function obtenerClaseDictadaDeTurno(
  turnoId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<{ id: string; registrada_en: string; alumnos_registrados: number } | null> {
  // Relación 1:N (PR-0.md §2.0 y §2.8): la clase dictada vigente del turno es la no anulada.
  const clase = await db.claseDictada.findFirst({
    where: { turnoId, anuladaEl: null },
    select: {
      idClaseDictada: true,
      createdAtClaseDictada: true,
      _count: { select: { alumnos: true } },
    },
  });
  return clase
    ? {
        id: clase.idClaseDictada,
        registrada_en: clase.createdAtClaseDictada.toISOString(),
        alumnos_registrados: clase._count.alumnos,
      }
    : null;
}

/** `true` cuando ese profesor registró una clase (no anulada) a la que asistió el alumno. */
export async function profesorAtendioAlumno(
  profesorId: string,
  alumnoId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  const inscripcion = await db.claseDictadaAlumno.findFirst({
    where: { alumnoId, clase: { is: { profesorId, anuladaEl: null } } },
    select: { alumnoId: true },
  });
  return inscripcion !== null;
}

// ---------------------------------------------------------------------------
// Lecturas públicas de asistencia (spec_modulo_E.md §2.13, spec_modulo_H.md
// §2.8.3): valor vigente y solo clases dictadas no anuladas. Solo lectura.
// ---------------------------------------------------------------------------

type Rango = { desde: string; hasta: string };

function limites({ desde, hasta }: Rango) {
  if (!/^\d{4}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}$/.test(hasta)) throw new Error("rango: meses AAAA-MM");
  const fin = new Date(`${hasta}-01T00:00:00.000Z`);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  return { inicio: `${desde}-01`, finExclusivo: fin.toISOString().slice(0, 10) };
}

/** Filas de asistencia vigente (clase no anulada): alumno, materia, fecha, marca de control y estado. */
const asistenciasVigentes = (filtro: Prisma.Sql) => Prisma.sql`
  SELECT cda."alumnoId" AS alumno_id, cd."materiaId" AS materia_id, cd."fechaClaseDictada" AS fecha,
    ${sqlConControlVigente("cd")} AS con_control, ${sqlAsistenciaVigente("cda")}::text AS estado
  FROM "clases_dictadas_alumnos" cda JOIN "clases_dictadas" cd ON cd."idClaseDictada" = cda."claseDictadaId"
  WHERE ${sqlClaseDictadaVigente("cd")} ${filtro}`;

/** Porcentaje entero con las mitades hacia arriba (P-E6), o `null` sin clases con control. */
function porcentaje(presentes: number, ausentes: number): number | null {
  const total = presentes + ausentes;
  return total === 0 ? null : Math.floor((presentes * 100) / total + 0.5);
}

/**
 * Asistencia del alumno por materia (spec_modulo_E.md §2.13): presentes y
 * ausentes de las clases con control (estado vigente), `sin_control` de las
 * registradas sin control y el porcentaje. Ordenada por materia.
 */
export async function asistenciaDeAlumno(
  alumnoId: string,
  materiaId?: string,
  db: Db = prisma,
): Promise<{ materia_id: string; presentes: number; ausentes: number; sin_control: number; porcentaje: number | null }[]> {
  const filtroMateria = materiaId ? Prisma.sql`AND cd."materiaId" = ${materiaId}` : Prisma.empty;
  const filas = await db.$queryRaw<{ materia_id: string; presentes: number; ausentes: number; sin_control: number }[]>(Prisma.sql`
    SELECT a.materia_id,
      count(*) FILTER (WHERE a.con_control AND a.estado = 'PRESENTE')::int AS presentes,
      count(*) FILTER (WHERE a.con_control AND a.estado = 'AUSENTE')::int AS ausentes,
      count(*) FILTER (WHERE NOT a.con_control)::int AS sin_control
    FROM (${asistenciasVigentes(Prisma.sql`AND cda."alumnoId" = ${alumnoId} ${filtroMateria}`)}) a
    GROUP BY a.materia_id ORDER BY a.materia_id COLLATE "C"`);
  return filas.map((f) => ({ ...f, porcentaje: porcentaje(f.presentes, f.ausentes) }));
}

/** Asistencias por mes de la clase dictada (y por materia), con el estado vigente. Solo meses con datos. */
export async function contarAsistenciasPorMes(
  rango: Rango,
  opciones: { porMateria?: boolean } = {},
  db: Db = prisma,
): Promise<{ mes: string; materia_id?: string; presentes: number; ausentes: number; sin_control: number }[]> {
  const { inicio, finExclusivo } = limites(rango);
  const materia = opciones.porMateria ? Prisma.sql`a.materia_id` : Prisma.sql`NULL::text`;
  const filas = await db.$queryRaw<{ mes: string; materia_id: string | null; presentes: number; ausentes: number; sin_control: number }[]>(Prisma.sql`
    SELECT to_char(a.fecha, 'YYYY-MM') AS mes, ${materia} AS materia_id,
      count(*) FILTER (WHERE a.con_control AND a.estado = 'PRESENTE')::int AS presentes,
      count(*) FILTER (WHERE a.con_control AND a.estado = 'AUSENTE')::int AS ausentes,
      count(*) FILTER (WHERE NOT a.con_control)::int AS sin_control
    FROM (${asistenciasVigentes(Prisma.sql`AND cd."fechaClaseDictada" >= CAST(${inicio} AS date) AND cd."fechaClaseDictada" < CAST(${finExclusivo} AS date)`)}) a
    GROUP BY 1, 2 ORDER BY 1, ${materia} COLLATE "C"`);
  return filas.map(({ materia_id, ...resto }) => ({ ...resto, ...(opciones.porMateria ? { materia_id: materia_id! } : {}) }));
}

/** Clases dictadas no anuladas cuya marca vigente «con control» es falsa, en el rango (spec_modulo_H.md §2.8.3). */
export async function contarClasesDictadasSinControl(rango: Rango, db: Db = prisma): Promise<number> {
  const { inicio, finExclusivo } = limites(rango);
  const [fila] = await db.$queryRaw<{ cantidad: number }[]>(Prisma.sql`
    SELECT count(*)::int AS cantidad FROM "clases_dictadas" cd
    WHERE ${sqlClaseDictadaVigente("cd")} AND NOT ${sqlConControlVigente("cd")}
      AND cd."fechaClaseDictada" >= CAST(${inicio} AS date) AND cd."fechaClaseDictada" < CAST(${finExclusivo} AS date)`);
  return fila?.cantidad ?? 0;
}

/**
 * Alumnos con presentismo bajo por materia (spec_modulo_H.md §2.8.3): clases
 * con control y estado vigente PRESENTE o AUSENTE; conserva los grupos con
 * `clases >= minimoClases` y `presentes * 100 < umbral * clases` (enteros).
 * Orden: presentismo ascendente, ausentes descendente, alumno y materia.
 * `total` es la cantidad de grupos antes de paginar.
 */
export async function listarAlumnosConPresentismoBajo(
  rango: Rango,
  opciones: { umbral: number; minimoClases: number; limite: number; desplazamiento: number },
  db: Db = prisma,
): Promise<{ total: number; items: { alumno_id: string; materia_id: string; clases: number; presentes: number; ausentes: number }[] }> {
  if (!Number.isInteger(opciones.umbral) || opciones.umbral < 1 || opciones.umbral > 100) throw new Error("listarAlumnosConPresentismoBajo: umbral entero de 1 a 100");
  const { inicio, finExclusivo } = limites(rango);
  const filas = await db.$queryRaw<{ alumno_id: string; materia_id: string; clases: number; presentes: number; ausentes: number; total: number }[]>(Prisma.sql`
    SELECT g.*, count(*) OVER ()::int AS total FROM (
      SELECT a.alumno_id, a.materia_id,
        count(*)::int AS clases,
        count(*) FILTER (WHERE a.estado = 'PRESENTE')::int AS presentes,
        count(*) FILTER (WHERE a.estado = 'AUSENTE')::int AS ausentes
      FROM (${asistenciasVigentes(Prisma.sql`AND cd."fechaClaseDictada" >= CAST(${inicio} AS date) AND cd."fechaClaseDictada" < CAST(${finExclusivo} AS date)`)}) a
      WHERE a.con_control AND a.estado IN ('PRESENTE', 'AUSENTE')
      GROUP BY a.alumno_id, a.materia_id
    ) g
    WHERE g.clases >= ${opciones.minimoClases} AND g.presentes * 100 < ${opciones.umbral} * g.clases
    ORDER BY (g.presentes::numeric / g.clases) ASC, g.ausentes DESC, g.alumno_id COLLATE "C", g.materia_id COLLATE "C"
    LIMIT ${opciones.limite} OFFSET ${opciones.desplazamiento}`);
  const total = filas[0]?.total ?? (opciones.desplazamiento > 0 ? await contarGrupos(rango, opciones, db) : 0);
  return {
    total,
    items: filas.map((f) => ({ alumno_id: f.alumno_id, materia_id: f.materia_id, clases: f.clases, presentes: f.presentes, ausentes: f.ausentes })),
  };
}

/** Total de grupos cuando la página pedida quedó vacía (el `count(*) OVER ()` no tiene filas que lo traigan). */
async function contarGrupos(rango: Rango, opciones: { umbral: number; minimoClases: number }, db: Db): Promise<number> {
  const { inicio, finExclusivo } = limites(rango);
  const [fila] = await db.$queryRaw<{ total: number }[]>(Prisma.sql`
    SELECT count(*)::int AS total FROM (
      SELECT count(*) AS clases, count(*) FILTER (WHERE a.estado = 'PRESENTE') AS presentes
      FROM (${asistenciasVigentes(Prisma.sql`AND cd."fechaClaseDictada" >= CAST(${inicio} AS date) AND cd."fechaClaseDictada" < CAST(${finExclusivo} AS date)`)}) a
      WHERE a.con_control AND a.estado IN ('PRESENTE', 'AUSENTE')
      GROUP BY a.alumno_id, a.materia_id
    ) g WHERE g.clases >= ${opciones.minimoClases} AND g.presentes * 100 < ${opciones.umbral} * g.clases`);
  return fila?.total ?? 0;
}

/**
 * `true` si existe al menos una clase dictada no anulada de ese profesor y
 * esa materia en la que el alumno figura en el registro, con cualquier estado
 * (presente, ausente o sin control; P-E9). Habilita «Registrar indicación»
 * (HU-E-04) y es la segunda condición de `profesorPuedeVerHistorial`.
 */
export async function profesorPuedeRegistrarIndicacion(
  profesorId: string,
  alumnoId: string,
  materiaId: string,
  db: Db = prisma,
): Promise<boolean> {
  const [fila] = await db.$queryRaw<{ existe: boolean }[]>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1 FROM "clases_dictadas_alumnos" cda JOIN "clases_dictadas" cd ON cd."idClaseDictada" = cda."claseDictadaId"
      WHERE ${sqlClaseDictadaVigente("cd")} AND cd."profesorId" = ${profesorId} AND cd."materiaId" = ${materiaId} AND cda."alumnoId" = ${alumnoId}
    ) AS existe`);
  return Boolean(fila?.existe);
}
