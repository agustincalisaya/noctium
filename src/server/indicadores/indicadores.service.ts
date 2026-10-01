import { contarTurnosPorMes } from "@/server/turnos/turno.publico";
import type { IndicadoresMensuales } from "@/types/indicadores.types";
import { resolverRangoIndicadores, type IndicadoresQuery } from "./indicadores.schema";

/** Compone las series públicas de B y C; Indicadores no consulta sus tablas (Regla N.° 3). */
export async function obtenerIndicadoresMensuales(query: IndicadoresQuery): Promise<IndicadoresMensuales> {
  const rango = resolverRangoIndicadores(query);
  const turnos = await contarTurnosPorMes(rango.desde, rango.hasta);
  const turnosPorMes = new Map(turnos.map(({ mes, cantidad }) => [mes, cantidad]));

  return {
    rango: { desde: rango.desde, hasta: rango.hasta, meses: rango.meses.length },
    meses: rango.meses.map((mes) => ({ mes, turnos: turnosPorMes.get(mes) ?? 0 })),
  };
}
