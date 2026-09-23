import { describe, expect, it } from "vitest";
import { normalizarTexto } from "./texto";

describe("normalizarTexto", () => {
  it("colapsa espacios múltiples internos a uno solo", () => {
    expect(normalizarTexto("Ana   María")).toBe("Ana María");
  });

  it("recorta espacios al inicio y al final", () => {
    expect(normalizarTexto("  Ana María  ")).toBe("Ana María");
  });

  it("combina trim y colapso de espacios internos en un solo valor", () => {
    expect(normalizarTexto("   Ana    María   Pérez   ")).toBe("Ana María Pérez");
  });

  it("no modifica un valor ya normalizado (idempotente)", () => {
    expect(normalizarTexto("Ana María")).toBe("Ana María");
  });

  it("deja una sola palabra intacta", () => {
    expect(normalizarTexto("Ana")).toBe("Ana");
  });

  it("colapsa tabs y saltos de línea igual que espacios (\\s incluye ambos)", () => {
    expect(normalizarTexto("Ana\t\nMaría")).toBe("Ana María");
  });

  it("un string de solo espacios se normaliza a vacío", () => {
    expect(normalizarTexto("   ")).toBe("");
  });

  it("un string vacío se mantiene vacío", () => {
    expect(normalizarTexto("")).toBe("");
  });

  it("conserva acentos, apóstrofes y guiones sin alterarlos", () => {
    expect(normalizarTexto("  María José  O'Connor-Pérez  ")).toBe("María José O'Connor-Pérez");
  });
});
