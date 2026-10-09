import { describe, expect, it } from "vitest";
import { formatearMonto } from "./moneda";

describe("HU-C-25 formatearMonto", () => {
  it.each([
    [0, "$ 0"],
    [12000, "$ 12.000"],
    [22000, "$ 22.000"],
    [1234567, "$ 1.234.567"],
  ])("%d → %s (sin decimales, separador de miles es-AR)", (valor, esperado) => {
    expect(formatearMonto(valor)).toBe(esperado);
  });
});
