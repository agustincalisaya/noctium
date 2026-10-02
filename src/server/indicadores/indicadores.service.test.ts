import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sumarPagos, promediarOcupacion } = vi.hoisted(() => ({ sumarPagos: vi.fn(), promediarOcupacion: vi.fn() }));
vi.mock("@/server/pagos/pago.publico", () => ({ sumarPagosPorMes: sumarPagos }));
vi.mock("@/server/turnos/turno.publico", () => ({ promediarOcupacionTurnosPorMes: promediarOcupacion }));

import { obtenerIngresosPorMes, obtenerOcupacionPromedioPorMes } from "./indicadores.service";
import { RangoIndicadoresQuerySchema } from "./indicadores.schema";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  // 30/09/2026 22:30 en Buenos Aires: en UTC ya es 1/10.
  vi.setSystemTime(new Date("2026-10-01T01:30:00.000Z"));
});
afterEach(() => vi.useRealTimers());

describe("obtenerIngresosPorMes", () => {
  it("con pagos en todos los meses devuelve el total de cada uno, en orden y como number", async () => {
    sumarPagos.mockResolvedValue([
      { mes: "2026-07", total: "450000.00" }, { mes: "2026-08", total: "512000.50" }, { mes: "2026-09", total: "0.30" },
    ]);
    await expect(obtenerIngresosPorMes({ desde: "2026-07", hasta: "2026-09" })).resolves.toEqual([
      { mes: "2026-07", total: 450000 }, { mes: "2026-08", total: 512000.5 }, { mes: "2026-09", total: 0.3 },
    ]);
    expect(sumarPagos).toHaveBeenCalledExactlyOnceWith("2026-07", "2026-09");
  });

  it("un mes sin pagos se devuelve en $0, no se omite", async () => {
    sumarPagos.mockResolvedValue([{ mes: "2026-07", total: "1000.00" }, { mes: "2026-09", total: "2000.00" }]);
    await expect(obtenerIngresosPorMes({ desde: "2026-07", hasta: "2026-09" })).resolves.toEqual([
      { mes: "2026-07", total: 1000 }, { mes: "2026-08", total: 0 }, { mes: "2026-09", total: 2000 },
    ]);
  });

  it("sin parámetros usa los últimos 6 meses incluyendo el actual del centro", async () => {
    sumarPagos.mockResolvedValue([]);
    const datos = await obtenerIngresosPorMes({});
    expect(datos.map(({ mes }) => mes)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(datos.every(({ total }) => total === 0)).toBe(true);
    expect(sumarPagos).toHaveBeenCalledExactlyOnceWith("2026-04", "2026-09");
  });

  it("desde > hasta es un error de validación del schema y no llega al servicio", () => {
    const resultado = RangoIndicadoresQuerySchema.safeParse({ desde: "2026-09", hasta: "2026-07" });
    expect(resultado.success).toBe(false);
    expect(resultado.error!.flatten().fieldErrors.desde).toEqual(["El mes desde no puede ser posterior al mes hasta"]);
  });
});

describe("obtenerOcupacionPromedioPorMes", () => {
  it("pasa a porcentaje con 1 decimal y completa con 0% los meses sin turnos elegibles", async () => {
    // 0.6825 → 68.3 (AC4, ejemplo de la HU); 0.625 = (0.25 + 1) / 2 → 62.5.
    promediarOcupacion.mockResolvedValue([{ mes: "2026-07", promedio: 0.6825, turnos: 4 }, { mes: "2026-09", promedio: 0.625, turnos: 2 }]);
    await expect(obtenerOcupacionPromedioPorMes({ desde: "2026-07", hasta: "2026-10" })).resolves.toEqual([
      { mes: "2026-07", ocupacion_promedio: 68.3 },
      { mes: "2026-08", ocupacion_promedio: 0 },
      { mes: "2026-09", ocupacion_promedio: 62.5 },
      { mes: "2026-10", ocupacion_promedio: 0 },
    ]);
  });

  it("redondea la mitad hacia arriba aunque la razón llegue con ruido binario (caso real de nivel 3)", async () => {
    // 38.75% llegó como 0.38749999999999996 desde un AVG en coma flotante: debe dar 38.8, igual que ROUND de PostgreSQL.
    promediarOcupacion.mockResolvedValue([
      { mes: "2026-08", promedio: 0.3875, turnos: 4 },
      { mes: "2026-09", promedio: 0.38749999999999996, turnos: 4 },
    ]);
    await expect(obtenerOcupacionPromedioPorMes({ desde: "2026-08", hasta: "2026-09" })).resolves.toEqual([
      { mes: "2026-08", ocupacion_promedio: 38.8 },
      { mes: "2026-09", ocupacion_promedio: 38.8 },
    ]);
  });

  it("pide a Turnos solo los turnos hasta hoy en Buenos Aires (no el día UTC)", async () => {
    promediarOcupacion.mockResolvedValue([]);
    await obtenerOcupacionPromedioPorMes({ desde: "2026-09", hasta: "2026-12" });
    expect(promediarOcupacion).toHaveBeenCalledExactlyOnceWith("2026-09", "2026-12", "2026-09-30");
  });

  it("delega el filtro de estados en Turnos: el servicio no recalcula ni mezcla Cancelado/Pendiente", async () => {
    // El promedio que llega ya excluye CANCELADO/PENDIENTE (verificado contra PostgreSQL en
    // turno.publico.pg.test.ts); acá se comprueba que H lo usa tal cual, sin alterarlo.
    promediarOcupacion.mockResolvedValue([{ mes: "2026-09", promedio: 0.5, turnos: 1 }]);
    await expect(obtenerOcupacionPromedioPorMes({ desde: "2026-09", hasta: "2026-09" })).resolves.toEqual([
      { mes: "2026-09", ocupacion_promedio: 50 },
    ]);
  });
});
