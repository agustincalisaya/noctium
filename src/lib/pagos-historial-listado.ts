export type FiltrosHistorialPagos = {
  desde: string;
  hasta: string;
  forma_pago_id: string;
  materia_id: string;
  estado_pago: string;
  pagina: number;
};

export const filtrosVaciosHistorialPagos: FiltrosHistorialPagos = {
  desde: "", hasta: "", forma_pago_id: "", materia_id: "", estado_pago: "", pagina: 1,
};

export function parametrosHistorialPagos(filtros: FiltrosHistorialPagos, alumnoId?: string): URLSearchParams {
  const params = new URLSearchParams();
  if (alumnoId) params.set("alumno_id", alumnoId);
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.estado_pago) params.set("estado_pago", filtros.estado_pago);
  else {
    if (filtros.forma_pago_id) params.set("forma_pago_id", filtros.forma_pago_id);
    if (filtros.materia_id) params.set("materia_id", filtros.materia_id);
  }
  if (filtros.pagina > 1) params.set("pagina", String(filtros.pagina));
  return params;
}

export function filtrosInicialesHistorialPagos(params: Record<string, string | undefined>): FiltrosHistorialPagos {
  const estado = ["PAGADA", "RESERVADA", "PAGO_SIN_REGISTRAR"].includes(params.estado_pago ?? "")
    ? params.estado_pago ?? "" : "";
  const pagina = Number(params.pagina);
  return {
    desde: params.desde ?? "",
    hasta: params.hasta ?? "",
    forma_pago_id: estado ? "" : params.forma_pago_id ?? "",
    materia_id: estado ? "" : params.materia_id ?? "",
    estado_pago: estado,
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** Formato AR conservando todos los centavos del decimal del API. */
export function formatearDineroHistorial(valor: string | number): string {
  const [entero, centavos = ""] = String(valor).split(".");
  return `$ ${BigInt(entero).toLocaleString("es-AR")},${centavos.padEnd(2, "0").slice(0, 2)}`;
}