import { describe, expect, it } from "vitest";
import {
  AbrirCajaSchema, AnularMovimientoSchema, ConfirmarCierreSchema, DeclararEfectivoSchema, ListarCajasQuerySchema, PaginaQuerySchema,
  RegistrarMovimientoSchema,
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

// HU-I-12-b (spec_modulo_I.md §2.10.3 y §2.10.4): movimientos manuales.
describe("RegistrarMovimientoSchema", () => {
  const valido = { tipo: "EGRESO", monto: "1000", concepto: "Retiro para comprar insumos" };
  it.each([
    valido, { ...valido, tipo: "INGRESO" }, { ...valido, monto: "0.01" }, { ...valido, monto: "123456789.99" },
    { ...valido, concepto: "x".repeat(200) },
  ])("acepta %j", (body) => {
    expect(RegistrarMovimientoSchema.safeParse(body).success).toBe(true);
  });
  it("recorta el concepto", () => {
    expect(RegistrarMovimientoSchema.parse({ ...valido, concepto: "  Cambio  " }).concepto).toBe("Cambio");
  });
  it.each(["0", "0.00", "-1", "1.234", "1,5", "abc", ""])("rechaza el monto %j", (monto) => {
    const r = RegistrarMovimientoSchema.safeParse({ ...valido, monto });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.monto?.length).toBeGreaterThan(0);
  });
  it("concepto vacío o de más de 200: el mensaje de la spec", () => {
    const vacio = RegistrarMovimientoSchema.safeParse({ ...valido, concepto: "   " });
    expect(vacio.success).toBe(false);
    if (!vacio.success) expect(vacio.error.flatten().fieldErrors.concepto?.[0]).toBe("Ingresá el concepto");
    const largo = RegistrarMovimientoSchema.safeParse({ ...valido, concepto: "x".repeat(201) });
    expect(largo.success).toBe(false);
    if (!largo.success) expect(largo.error.flatten().fieldErrors.concepto?.[0]).toBe("El concepto no puede superar los 200 caracteres");
  });
  it.each([{ ...valido, tipo: "AJUSTE" }, { ...valido, tipo: "ingreso" }, { monto: "1", concepto: "x" }, { ...valido, caja_id: "c1" }, {}])("rechaza %j", (body) => {
    expect(RegistrarMovimientoSchema.safeParse(body).success).toBe(false);
  });
});

describe("AnularMovimientoSchema", () => {
  it("acepta un motivo de 1 a 300 caracteres, recortado", () => {
    expect(AnularMovimientoSchema.parse({ motivo: "  Error de carga " })).toEqual({ motivo: "Error de carga" });
    expect(AnularMovimientoSchema.safeParse({ motivo: "x".repeat(300) }).success).toBe(true);
  });
  it("motivo vacío o de más de 300: el mensaje de la spec", () => {
    const vacio = AnularMovimientoSchema.safeParse({ motivo: "  " });
    expect(vacio.success).toBe(false);
    if (!vacio.success) expect(vacio.error.flatten().fieldErrors.motivo?.[0]).toBe("Ingresá el motivo");
    const largo = AnularMovimientoSchema.safeParse({ motivo: "x".repeat(301) });
    expect(largo.success).toBe(false);
    if (!largo.success) expect(largo.error.flatten().fieldErrors.motivo?.[0]).toBe("El motivo no puede superar los 300 caracteres");
  });
  it("rechaza la falta del motivo y un campo extra", () => {
    expect(AnularMovimientoSchema.safeParse({}).success).toBe(false);
    expect(AnularMovimientoSchema.safeParse({ motivo: "x", movimiento_id: "m1" }).success).toBe(false);
  });
});
