/** Filtros de «Mis pagos» (HU-I-05) tal como viven en la URL y en el formulario. */
export type FiltrosMisPagos = {
  desde: string;
  hasta: string;
  materia_id: string;
  pagina: number;
};

export const filtrosVaciosMisPagos: FiltrosMisPagos = { desde: "", hasta: "", materia_id: "", pagina: 1 };

/** `AAAA-MM-DD` que existe en el calendario; se compara como texto, sin pasar por la zona del navegador. */
function fechaValida(valor: string | undefined): string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "";
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia ? valor : "";
}

/**
 * Normaliza la URL inicial: descarta fechas inválidas o un rango invertido,
 * lleva una página inválida a 1 e ignora parámetros desconocidos. Así la
 * pantalla nunca arma una consulta que el servidor rechazaría con 400.
 */
export function filtrosInicialesMisPagos(params: Record<string, string | string[] | undefined>): FiltrosMisPagos {
  const valor = (clave: string) => {
    const v = params[clave];
    return Array.isArray(v) ? v[v.length - 1] : v;
  };
  let desde = fechaValida(valor("desde"));
  let hasta = fechaValida(valor("hasta"));
  if (desde && hasta && desde > hasta) { desde = ""; hasta = ""; }
  const pagina = Number(valor("pagina"));
  return {
    desde,
    hasta,
    materia_id: valor("materia_id")?.trim() ?? "",
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** Query de la API y de la URL de la pantalla: los vacíos se omiten y la página 1 no se escribe. */
export function parametrosMisPagos(filtros: FiltrosMisPagos): URLSearchParams {
  const params = new URLSearchParams();
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.materia_id) params.set("materia_id", filtros.materia_id);
  if (filtros.pagina > 1) params.set("pagina", String(filtros.pagina));
  return params;
}

export const hayFiltrosMisPagos = (filtros: FiltrosMisPagos) => Boolean(filtros.desde || filtros.hasta || filtros.materia_id);
