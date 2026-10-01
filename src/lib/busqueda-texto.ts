import { normalizarTexto } from "@/lib/normalizar-texto";

/**
 * Criterio de "búsqueda inteligente" (HU-B-05, spec_modulo_B.md §2.7 y
 * §3.9): umbral de 2 caracteres, normalización sin mayúsculas ni acentos y
 * partición en palabras. Función pura, sin Prisma ni `src/server/**`, para
 * que la reutilicen otros módulos (HU-C-02) sin romper la Regla N.° 3: cada
 * uno arma su propio filtro sobre sus campos a partir de estos tokens.
 */

export const MIN_CARACTERES_BUSQUEDA = 2;
export const MAX_TOKENS_BUSQUEDA = 5;

/** El texto recortado si alcanza el umbral; `undefined` si no se busca. */
export function terminoBusqueda(texto: string | undefined): string | undefined {
  const recortado = texto?.trim() ?? "";
  return recortado.length >= MIN_CARACTERES_BUSQUEDA ? recortado : undefined;
}

/**
 * Palabras normalizadas a buscar (como máximo `MAX_TOKENS_BUSQUEDA`: las
 * siguientes se ignoran), o `null` si el texto no alcanza el umbral.
 */
export function tokenizarBusqueda(texto: string | undefined): string[] | null {
  const termino = terminoBusqueda(texto);
  if (termino === undefined) return null;
  return normalizarTexto(termino).split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS_BUSQUEDA);
}
