/**
 * Query string del listado de alumnos (HU-B-04 / HU-B-05): lo comparten el
 * listado, su paginador y el link "Volver al listado" de la ficha, para que
 * la búsqueda y la página se conserven al ir y volver. Omite la página 1 y
 * la búsqueda vacía para que el listado sin filtro quede en `/alumnos`.
 */
export function parametrosListadoAlumnos({ q, pagina }: { q?: string; pagina?: number }): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (pagina !== undefined && pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return query ? `?${query}` : "";
}
