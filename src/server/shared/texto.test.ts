import { describe, expect, it } from "vitest";
import { normalizarTextoNombre } from "./texto";

describe("normalizarTextoNombre", () => {
  it("colapsa espacios múltiples internos a uno solo", () => {
    expect(normalizarTextoNombre("Ana   María")).toBe("Ana María");
  });

  it("recorta espacios al inicio y al final", () => {
    expect(normalizarTextoNombre("  Ana María  ")).toBe("Ana María");
  });

  it("combina trim y colapso de espacios internos en un solo valor", () => {
    expect(normalizarTextoNombre("   Ana    María   Pérez   ")).toBe("Ana María Pérez");
  });

  it("no modifica un valor ya normalizado (idempotente)", () => {
    expect(normalizarTextoNombre("Ana María")).toBe("Ana María");
  });

  it("deja una sola palabra intacta", () => {
    expect(normalizarTextoNombre("Ana")).toBe("Ana");
  });

  it("colapsa tabs y saltos de línea igual que espacios (\\s incluye ambos)", () => {
    expect(normalizarTextoNombre("Ana\t\nMaría")).toBe("Ana María");
  });

  it("un string de solo espacios se normaliza a vacío", () => {
    expect(normalizarTextoNombre("   ")).toBe("");
  });

  it("un string vacío se mantiene vacío", () => {
    expect(normalizarTextoNombre("")).toBe("");
  });

  it("conserva acentos, apóstrofes y guiones sin alterarlos", () => {
    expect(normalizarTextoNombre("  María José  O'Connor-Pérez  ")).toBe("María José O'Connor-Pérez");
  });
});
