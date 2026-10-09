import { describe, expect, it } from "vitest";
import { dentroDePlazoDeCorreccion } from "./valor-vigente";

describe("plazo de corrección por calendario de Buenos Aires", () => {
  it("incluye el mismo día y el séptimo día aunque cruce el mes", () => {
    expect(dentroDePlazoDeCorreccion(new Date("2026-09-30T18:00:00.000Z"), new Date("2026-09-30T23:00:00.000Z"))).toBe(true);
    expect(dentroDePlazoDeCorreccion(new Date("2026-09-30T18:00:00.000Z"), new Date("2026-10-07T18:00:00.000Z"))).toBe(true);
  });

  it("vence al comenzar el octavo día local y no admite una base futura", () => {
    const registro = new Date("2026-10-09T02:30:00.000Z"); // 08/10, 23:30 en Buenos Aires
    expect(dentroDePlazoDeCorreccion(registro, new Date("2026-10-16T02:30:00.000Z"))).toBe(true); // 15/10 local
    expect(dentroDePlazoDeCorreccion(registro, new Date("2026-10-16T03:01:00.000Z"))).toBe(false); // 16/10 local
    expect(dentroDePlazoDeCorreccion(new Date("2026-10-10T04:00:00.000Z"), new Date("2026-10-10T02:59:00.000Z"))).toBe(false);
  });
});
