/**
 * Modo edición de una ficha (`/<entidad>/[id]?modo=edicion`): la edición no
 * es una ruta aparte sino un modo del mismo detalle (mapa de pantallas
 * Sprint 2 §1). Compartido por las fichas que lo implementan — HU-L-03
 * (materia) y HU-D-06 (profesor) — para que todas usen el mismo parámetro.
 *
 * `?actualizada=1` es la señal de vuelta a modo consulta después de guardar,
 * para mostrar el banner de éxito (DESIGN.md §6.2), mismo patrón que
 * `?creada=1` del listado de materias.
 */
export const PARAM_MODO = "modo";
export const MODO_EDICION = "edicion";
export const PARAM_ACTUALIZADA = "actualizada";

type SearchParams = Record<string, string | string[] | undefined>;

export function esModoEdicion(searchParams: SearchParams): boolean {
  return searchParams[PARAM_MODO] === MODO_EDICION;
}

export function fueActualizada(searchParams: SearchParams): boolean {
  return searchParams[PARAM_ACTUALIZADA] === "1";
}

export function rutaModoEdicion(rutaFicha: string): string {
  return `${rutaFicha}?${PARAM_MODO}=${MODO_EDICION}`;
}

export function rutaTrasGuardar(rutaFicha: string): string {
  return `${rutaFicha}?${PARAM_ACTUALIZADA}=1`;
}
