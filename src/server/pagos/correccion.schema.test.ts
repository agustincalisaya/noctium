import { describe, expect, it } from "vitest";
import { AnularPagoSchema, CorregirPagoSchema } from "./correccion.schema";

const CUID = "c123456789012345678901234";

describe("CorregirPagoSchema (spec_modulo_I.md §2.14.2)", () => {
  it.each([
    { monto: "10000", motivo: "Beca parcial" },
    { forma_pago_id: "formapago-transferencia", motivo: "Era transferencia" },
    { fecha_pago: "2026-10-08", motivo: "Fecha mal cargada" },
    { monto: "10000.50", forma_pago_id: CUID, fecha_pago: "2026-10-08", motivo: "Todo", caja_ajuste_id: CUID },
  ])("acepta %o", (body) => {
    expect(CorregirPagoSchema.safeParse(body).success).toBe(true);
  });

  it("transforma fecha_pago en Date (medianoche UTC) y recorta el motivo", () => {
    const r = CorregirPagoSchema.parse({ fecha_pago: "2026-10-08", motivo: "  Error  " });
    expect(r.fecha_pago).toEqual(new Date("2026-10-08T00:00:00.000Z"));
    expect(r.motivo).toBe("Error");
  });

  it("sin ninguno de los tres campos de cambio falla el refine", () => {
    const r = CorregirPagoSchema.safeParse({ motivo: "Nada" });
    expect(r.success).toBe(false);
    expect(r.error!.flatten().formErrors).toEqual(["Indicá qué querés corregir"]);
  });

  it.each([
    [{ monto: "1", motivo: "" }, "motivo"],
    [{ monto: "1", motivo: "   " }, "motivo"],
    [{ monto: "1", motivo: "x".repeat(301) }, "motivo"],
    [{ monto: "0", motivo: "x" }, "monto"],
    [{ monto: "1.234", motivo: "x" }, "monto"],
    [{ monto: "-5", motivo: "x" }, "monto"],
    [{ fecha_pago: "2026-02-30", motivo: "x" }, "fecha_pago"],
    [{ forma_pago_id: "no-es-cuid", motivo: "x" }, "forma_pago_id"],
    [{ monto: "1", motivo: "x", caja_ajuste_id: "caja-1" }, "caja_ajuste_id"],
  ])("rechaza %o en %s", (body, campo) => {
    const r = CorregirPagoSchema.safeParse(body);
    expect(r.success).toBe(false);
    expect(r.error!.flatten().fieldErrors).toHaveProperty(campo);
  });

  it("acepta el motivo de exactamente 300 caracteres", () => {
    expect(CorregirPagoSchema.safeParse({ monto: "1", motivo: "x".repeat(300) }).success).toBe(true);
  });

  it("rechaza campos extra (.strict())", () => {
    expect(CorregirPagoSchema.safeParse({ monto: "1", motivo: "x", alumno_id: CUID }).success).toBe(false);
  });
});

describe("AnularPagoSchema (spec_modulo_I.md §2.14.3)", () => {
  it("acepta el motivo solo o con la caja de ajuste; «Reintegro» es un motivo más", () => {
    expect(AnularPagoSchema.parse({ motivo: "Reintegro" })).toEqual({ motivo: "Reintegro" });
    expect(AnularPagoSchema.safeParse({ motivo: "Duplicado", caja_ajuste_id: CUID }).success).toBe(true);
  });

  it.each([
    {},
    { motivo: "" },
    { motivo: "x".repeat(301) },
    { motivo: "x", caja_ajuste_id: "no-cuid" },
    { motivo: "x", monto: "1" },
  ])("rechaza %o", (body) => {
    expect(AnularPagoSchema.safeParse(body).success).toBe(false);
  });
});
