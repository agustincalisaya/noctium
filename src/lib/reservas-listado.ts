export type PestanaReservas = "pendientes" | "vencidas";
export type VencenReservas = "en_3_horas" | "hoy" | "manana";

export type FiltrosReservas = { alumno?: string; materiaId?: string; vencen?: VencenReservas };

/**
 * Query string de la pantalla Reservas (HU-C-26): lo usan las pestañas, los
 * filtros y el paginador. Mismos nombres que la API (`alumno`, `materia_id`,
 * `vencen`, `pagina`), más `tab`. Omite la pestaña por defecto (Pendientes), la
 * página 1 y los filtros vacíos, para que el listado sin filtro quede en
 * `/reservas`; `vencen` solo existe en Pendientes. Equivalente a
 * `parametrosListadoPersonal`.
 */
export function parametrosListadoReservas({
  tab = "pendientes", alumno, materiaId, vencen, pagina,
}: FiltrosReservas & { tab?: PestanaReservas; pagina?: number }): string {
  const params = new URLSearchParams();
  if (tab !== "pendientes") params.set("tab", tab);
  if (alumno) params.set("alumno", alumno);
  if (materiaId) params.set("materia_id", materiaId);
  if (vencen && tab === "pendientes") params.set("vencen", vencen);
  if (pagina !== undefined && pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return query ? `?${query}` : "";
}
