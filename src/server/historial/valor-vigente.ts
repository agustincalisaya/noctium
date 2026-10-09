import { Prisma } from "@prisma/client";

/**
 * Valor vigente del historial académico (spec_modulo_E.md §3.6 y §3.7): la
 * única implementación de la regla. Las correcciones nunca modifican el
 * original: se lee la corrección más reciente (por fecha de registro y, de
 * empate, por id).
 */

const ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
export const DIAS_PLAZO_CORRECCION_PROFESOR = 7;

function alias(nombre: string): Prisma.Sql {
  if (!ALIAS.test(nombre)) throw new Error(`alias inválido "${nombre}"`);
  return Prisma.raw(`"${nombre}"`);
}

/** Estado de asistencia vigente de la fila `cda` de clases_dictadas_alumnos (NULL = sin control). */
export function sqlAsistenciaVigente(cda: string): Prisma.Sql {
  const a = alias(cda);
  return Prisma.sql`COALESCE(
    (SELECT vcaa."estadoNuevo" FROM "correcciones_asistencia_alumnos" vcaa
       JOIN "correcciones_asistencia" vca ON vca."idCorreccionAsistencia" = vcaa."correccionId"
      WHERE vca."claseDictadaId" = ${a}."claseDictadaId" AND vcaa."alumnoId" = ${a}."alumnoId"
      ORDER BY vca."createdAtCorreccion" DESC, vca."idCorreccionAsistencia" DESC LIMIT 1),
    ${a}."estadoAsistencia")`;
}

/** Marca «con control de asistencia» vigente de la clase dictada `cd`: la de la última corrección o la original. */
export function sqlConControlVigente(cd: string): Prisma.Sql {
  const c = alias(cd);
  return Prisma.sql`COALESCE(
    (SELECT vca."conControlAsistencia" FROM "correcciones_asistencia" vca
      WHERE vca."claseDictadaId" = ${c}."idClaseDictada"
      ORDER BY vca."createdAtCorreccion" DESC, vca."idCorreccionAsistencia" DESC LIMIT 1),
    ${c}."conControlAsistencia")`;
}

/** Clase dictada vigente: no anulada (spec_modulo_E.md §3.7). */
export function sqlClaseDictadaVigente(cd: string): Prisma.Sql {
  return Prisma.sql`${alias(cd)}."anuladaEl" IS NULL`;
}

/** Fecha del resultado de examen después de aplicar su corrección más reciente. */
export function sqlFechaExamenVigente(examen: string): Prisma.Sql {
  const e = alias(examen);
  return Prisma.sql`COALESCE(
    (SELECT ce."fechaNueva" FROM "correcciones_resultado_examen" ce
      WHERE ce."resultadoExamenId" = ${e}."idResultadoExamen"
      ORDER BY ce."createdAtCorreccion" DESC, ce."idCorreccionResultado" DESC LIMIT 1),
    ${e}."fechaExamen")`;
}

/** Nota del resultado de examen después de aplicar su corrección más reciente. */
export function sqlNotaExamenVigente(examen: string): Prisma.Sql {
  const e = alias(examen);
  return Prisma.sql`COALESCE(
    (SELECT ce."notaNueva" FROM "correcciones_resultado_examen" ce
      WHERE ce."resultadoExamenId" = ${e}."idResultadoExamen"
      ORDER BY ce."createdAtCorreccion" DESC, ce."idCorreccionResultado" DESC LIMIT 1),
    ${e}."notaExamen")`;
}

/** Calendario en Buenos Aires para aplicar el plazo inclusivo de siete días. */
function diaEnBuenosAires(instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  const dia = `${valor("year")}-${valor("month")}-${valor("day")}`;
  return Date.parse(`${dia}T00:00:00.000Z`);
}

/** Diferencia de días calendario local; el día 7 desde el registro está incluido. */
export function dentroDePlazoDeCorreccion(fechaBase: Date, hoy: Date): boolean {
  const diferencia = (diaEnBuenosAires(hoy) - diaEnBuenosAires(fechaBase)) / 86_400_000;
  return diferencia >= 0 && diferencia <= DIAS_PLAZO_CORRECCION_PROFESOR;
}
