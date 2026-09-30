import type { Turno } from "@/types/turno.types";

/**
 * URL del listado de turnos (HU-C-01 / HU-C-02): la comparten el
 * `replaceState` del buscador, el paginador y el `retorno` de cada fila
 * ("Ver detalle", "Continuar configuración"), para que la búsqueda y la
 * página se conserven al ir y volver. A diferencia del listado de alumnos,
 * siempre incluye `pagina` y `orden`: es el formato de `retorno` que ya
 * aceptan los pasos de un turno pendiente (`volver` que empiece con
 * "/turnos?"). HU-C-08 suma acá `profesor_id`.
 */
/** Siguiente paso de un turno PENDIENTE (HU-C-01 c3, Revisión 3): primero aula, después profesor y alumnos. */
export function urlContinuar(turno: Pick<Turno, "id" | "aula_id">, retorno: string) {
  // El aula se elige en la misma pantalla que la configuración (§2.1 + §2.3 fusionadas).
  const paso = turno.aula_id ? "participantes" : "configuracion";
  return `/turnos/${encodeURIComponent(turno.id)}/${paso}?volver=${encodeURIComponent(retorno)}`;
}

export function urlListadoTurnos({ q, pagina }: { q?: string; pagina: number }): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("pagina", String(pagina));
  params.set("orden", "fecha_hora_asc");
  return `/turnos?${params}`;
}
