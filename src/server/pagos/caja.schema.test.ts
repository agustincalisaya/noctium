import { describe, expect, it } from "vitest";
import {
  AbrirCajaSchema, ConfirmarCierreSchema, DeclararEfectivoSchema, ListarCajasQuerySchema, PaginaQuerySchema,
} from "@/server/pagos/caja.schema";

// HU-I-12 (spec_modulo_I.md §2.10.1, §2.11 y §2.12): validación previa al servicio (Regla N.° 6).
describe("AbrirCajaSchema", () => {
  it.each(["0", "0.00", "5000", "5000.5", "123456789.99", " 100 "])("acepta el fondo %j (puede ser 0)", (fondo) => {
    expect(AbrirCajaSchema.safeParse({ fondo_inicial: fondo }).success).toBe(true);
  });
  it.each(["-1", "10.123", "1,5", "abc", "", "1234567890"])("rechaza el fondo %j", (fondo) => {
    const r = AbrirCajaSchema.safeParse({ fondo_inicial: fondo });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.fondo_inicial?.[0]).toBe("El fondo inicial debe ser un número igual o mayor a 0 con hasta 2 decimales");
  });
  it("rechaza un campo extra y la falta del fondo", () => {
    expect(AbrirCajaSchema.safeParse({ fondo_inicial: "10", usuario_id: "x" }).success).toBe(false);
    expect(AbrirCajaSchema.safeParse({}).success).toBe(false);
  });
});

describe("DeclararEfectivoSchema", () => {
  it("acepta 0 y montos con 2 decimales; rechaza negativos, 3 decimales y campos extra", () => {
    expect(DeclararEfectivoSchema.safeParse({ efectivo_declarado: "0" }).success).toBe(true);
    expect(DeclararEfectivoSchema.safeParse({ efectivo_declarado: "16000.50" }).success).toBe(true);
    expect(DeclararEfectivoSchema.safeParse({ efectivo_declarado: "-5" }).success).toBe(false);
    expect(DeclararEfectivoSchema.safeParse({ efectivo_declarado: "1.005" }).success).toBe(false);
    expect(DeclararEfectivoSchema.safeParse({ efectivo_declarado: "10", motivo: "x" }).success).toBe(false);
  });
});

describe("ConfirmarCierreSchema", () => {
  it("exige la huella; el motivo es opcional y de hasta 300 caracteres", () => {
    expect(ConfirmarCierreSchema.safeParse({ huella: "abc" }).success).toBe(true);
    expect(ConfirmarCierreSchema.safeParse({ huella: "abc", motivo: "x".repeat(300) }).success).toBe(true);
    const largo = ConfirmarCierreSchema.safeParse({ huella: "abc", motivo: "x".repeat(301) });
    expect(largo.success).toBe(false);
    if (!largo.success) expect(largo.error.flatten().fieldErrors.motivo?.[0]).toBe("El motivo no puede superar los 300 caracteres");
    expect(ConfirmarCierreSchema.safeParse({ huella: "  " }).success).toBe(false);
    expect(ConfirmarCierreSchema.safeParse({ motivo: "x" }).success).toBe(false);
    expect(ConfirmarCierreSchema.safeParse({ huella: "abc", efectivo_declarado: "1" }).success).toBe(false);
  });
});

describe("ListarCajasQuerySchema y PaginaQuerySchema", () => {
  it("página 1 por defecto y coerción del texto de la URL", () => {
    expect(ListarCajasQuerySchema.parse({})).toEqual({ pagina: 1 });
    expect(ListarCajasQuerySchema.parse({ pagina: "3", integrante_id: "u1", desde: "2026-10-01", hasta: "2026-10-31" }))
      .toEqual({ pagina: 3, integrante_id: "u1", desde: "2026-10-01", hasta: "2026-10-31" });
    expect(PaginaQuerySchema.parse({ pagina: "2" })).toEqual({ pagina: 2 });
  });
  it.each([
    { pagina: "0" }, { pagina: "-1" }, { pagina: "1.5" }, { desde: "2026-02-31" }, { hasta: "10/10/2026" },
    { desde: "2026-10-10", hasta: "2026-10-01" }, { por_pagina: "50" },
  ])("rechaza %j", (query) => {
    expect(ListarCajasQuerySchema.safeParse(query).success).toBe(false);
  });
  it("el mismo día en desde y hasta es válido", () => {
    expect(ListarCajasQuerySchema.safeParse({ desde: "2026-10-10", hasta: "2026-10-10" }).success).toBe(true);
  });
});
