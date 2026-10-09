import { Prisma } from "@prisma/client";

/**
 * Valor vigente del historial académico (spec_modulo_E.md §3.6 y §3.7): la
 * única implementación de la regla. Las correcciones nunca modifican el
 * original: se lee la corrección más reciente (por fecha de registro y, de
 * empate, por id).
 */

const ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;
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
