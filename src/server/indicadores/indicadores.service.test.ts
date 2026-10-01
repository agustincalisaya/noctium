import { beforeEach, describe, expect, it, vi } from "vitest";

const { contarTurnos } = vi.hoisted(() => ({ contarTurnos: vi.fn() }));
vi.mock("@/server/turnos/turno.publico", () => ({ contarTurnosPorMes: contarTurnos }));

import { obtenerIndicadoresMensuales } from "./indicadores.service";

beforeEach(() => {
  vi.clearAllMocks();
  contarTurnos.mockResolvedValue([{ mes: "2026-09", cantidad: 8 }, { mes: "2026-11", cantidad: 3 }]);
});

describe("obtenerIndicadoresMensuales", () => {
  it("cuenta turnos y completa meses vacíos con cero", async () => {
    const datos = await obtenerIndicadoresMensuales({ desde: "2026-09", hasta: "2026-11" });

    expect(datos).toEqual({
      rango: { desde: "2026-09", hasta: "2026-11", meses: 3 },
      meses: [
        { mes: "2026-09", turnos: 8 },
        { mes: "2026-10", turnos: 0 },
        { mes: "2026-11", turnos: 3 },
      ],
    });
    expect(contarTurnos).toHaveBeenCalledExactlyOnceWith("2026-09", "2026-11");
  });

  it("devuelve ceros para todos los meses cuando no hay turnos", async () => {
    contarTurnos.mockResolvedValueOnce([]);

    const datos = await obtenerIndicadoresMensuales({ desde: "2026-01", hasta: "2026-03" });

    expect(datos.meses).toEqual([
      { mes: "2026-01", turnos: 0 },
      { mes: "2026-02", turnos: 0 },
      { mes: "2026-03", turnos: 0 },
    ]);
  });

  it("resuelve y envía el rango por defecto al módulo de Turnos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T18:00:00.000Z"));

    await obtenerIndicadoresMensuales({});

    expect(contarTurnos).toHaveBeenCalledExactlyOnceWith("2026-04", "2026-09");
    vi.useRealTimers();
  });
});
