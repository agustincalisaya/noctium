import { sumarPagosPorMes } from "@/server/pagos/pago.publico";
import { promediarOcupacionTurnosPorMes } from "@/server/turnos/turno.publico";
import type { IngresoMes, OcupacionMes } from "@/types/indicadores.types";
import { fechaActualBuenosAires, resolverRangoIndicadores, type RangoIndicadoresInput } from "./indicadores.schema";

/**
 * Total cobrado por mes del rango (spec_modulo_H.md §2.2). La suma la hace
 * Pagos (Regla N.° 3); acá se completan los meses sin pagos con cero.
 */
export async function obtenerIngresosPorMes(query: RangoIndicadoresInput): Promise<IngresoMes[]> {
  const rango = resolverRangoIndicadores(query);
  const sumas = await sumarPagosPorMes(rango.desde, rango.hasta);
  const totalPorMes = new Map(sumas.map(({ mes, total }) => [mes, Number(total)]));
  return rango.meses.map((mes) => ({ mes, total: totalPorMes.get(mes) ?? 0 }));
}

/**
 * Razón 0–1 → porcentaje con 1 decimal, redondeando la mitad hacia arriba como
 * PostgreSQL. `toPrecision(12)` quita el ruido binario de la multiplicación
 * (0.38749999999999996 × 1000 ≠ 387.5) antes de redondear.
 */
export function porcentajeUnDecimal(razon: number): number {
  return Math.round(Number((razon * 1000).toPrecision(12))) / 10;
}

/**
 * Ocupación promedio por mes del rango (spec_modulo_H.md §2.3): solo turnos
 * ya dictados (hasta hoy en Buenos Aires, §3.6). Turnos entrega la razón sin
 * redondear; acá se pasa a porcentaje con 1 decimal (§3.8) y se completan
 * con cero los meses sin turnos elegibles.
 */
export async function obtenerOcupacionPromedioPorMes(query: RangoIndicadoresInput): Promise<OcupacionMes[]> {
  const rango = resolverRangoIndicadores(query);
  const promedios = await promediarOcupacionTurnosPorMes(rango.desde, rango.hasta, fechaActualBuenosAires());
  const promedioPorMes = new Map(promedios.map(({ mes, promedio }) => [mes, porcentajeUnDecimal(promedio)]));
  return rango.meses.map((mes) => ({ mes, ocupacion_promedio: promedioPorMes.get(mes) ?? 0 }));
}

/** Promedio simple por clase de todo el período; los meses pesan por clases, no por cupos. */
export async function obtenerResumenOcupacion(query: RangoIndicadoresInput) {
  const rango = resolverRangoIndicadores(query);
  const filas = await promediarOcupacionTurnosPorMes(rango.desde, rango.hasta, fechaActualBuenosAires());
  const turnos = filas.reduce((total, fila) => total + fila.turnos, 0);
  const suma = filas.reduce((total, fila) => total + fila.promedio * fila.turnos, 0);
  return { ocupacion_promedio: turnos ? porcentajeUnDecimal(suma / turnos) : 0, turnos };
}
