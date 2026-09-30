/**
 * URL del listado de turnos (HU-C-01 / HU-C-02): la comparten el
 * `replaceState` del buscador, el paginador y el `retorno` de cada fila
 * ("Ver detalle", "Continuar configuración"), para que la búsqueda y la
 * página se conserven al ir y volver. A diferencia del listado de alumnos,
 * siempre incluye `pagina` y `orden`: es el formato de `retorno` que ya
 * aceptan los pasos de un turno pendiente (`volver` que empiece con
 * "/turnos?"). HU-C-08 suma acá `profesor_id`.
 */
export function urlListadoTurnos({ q, pagina }: { q?: string; pagina: number }): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("pagina", String(pagina));
  params.set("orden", "fecha_hora_asc");
  return `/turnos?${params}`;
}
