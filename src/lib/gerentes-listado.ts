/**
 * Query string del listado de gerentes (HU-G-03): lo usan el listado y su
 * paginador. Omite la página 1 y la búsqueda vacía para que el listado sin
 * filtro quede en `/gerentes`. Equivalente a `personal-listado.ts`, sin
 * acoplarse a ese módulo.
 */
export function parametrosListadoGerentes({ q, pagina }: { q?: string; pagina?: number }): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (pagina !== undefined && pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return query ? `?${query}` : "";
}
