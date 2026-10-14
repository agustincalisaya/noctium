import type { PeriodoListadoTurnos, Turno } from "@/types/turno.types";

/**
 * URL del listado de clases (HU-C-01 / HU-C-02 / HU-C-08 / HU-C-27): la
 * comparten el `replaceState` de los filtros, el paginador y el `retorno` de
 * cada fila ("Ver detalle", "Continuar configuración"), para que los filtros
 * y la página se conserven al ir y volver. Siempre incluye `pagina`: así la
 * URL empieza con "/turnos?", el formato de `retorno` que aceptan los pasos
 * de una clase pendiente. Con rango (`desde`/`hasta`) no se escribe `periodo`
 * («Rango personalizado»); sin rango, `periodo` va siempre, incluido `hoy`.
 */
/** Siguiente paso de un turno PENDIENTE (HU-C-01 c3, Revisión 3): primero aula, después profesor y alumnos. */
export function urlContinuar(turno: Pick<Turno, "id" | "aula_id">, retorno: string) {
  // El aula se elige en la misma pantalla que la configuración (§2.1 + §2.3 fusionadas).
  const paso = turno.aula_id ? "participantes" : "configuracion";
  return `/turnos/${encodeURIComponent(turno.id)}/${paso}?volver=${encodeURIComponent(retorno)}`;
}

export type FiltrosUrlListadoTurnos = {
  pagina: number; q?: string; profesorId?: string;
  periodo?: PeriodoListadoTurnos; desde?: string; hasta?: string; materiaId?: string;
};

export function urlListadoTurnos({ q, pagina, profesorId, periodo, desde, hasta, materiaId }: FiltrosUrlListadoTurnos): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (profesorId) params.set("profesor_id", profesorId);
  if (desde || hasta) {
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
  } else if (periodo) {
    params.set("periodo", periodo);
  }
  if (materiaId) params.set("materia_id", materiaId);
  params.set("pagina", String(pagina));
  return `/turnos?${params}`;
}
