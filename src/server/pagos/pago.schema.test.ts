import { describe, expect, it } from "vitest";
import { OpcionesPagoQuerySchema, RegistrarPagoSchema } from "@/server/pagos/pago.schema";

const valido = { turno_id: "seed-turno-02", alumno_id: "c123456789012345678901234", monto: "1500.50", forma_pago_id: "c223456789012345678901234" };

describe("HU-I-01 schema", () => {
  it.each(["0.01", "1", "1500.50", "999999999.99"])("admite monto decimal exacto %s y turno del seed", (monto) => {
    expect(RegistrarPagoSchema.parse({ ...valido, monto }).monto).toBe(monto);
  });
  it.each(["", "0", "0.00", "-1", "1.001", "1000000000", "1e3", "NaN", "1,50", ".50"])("rechaza monto %s", (monto) => {
    expect(RegistrarPagoSchema.safeParse({ ...valido, monto }).success).toBe(false);
  });
  it.each(["2026-02-29", "2026-09-31", "2026-13-01", "2026-00-01", "01/10/2026"])("rechaza calendario inválido %s", (fecha_pago) => {
    expect(RegistrarPagoSchema.safeParse({ ...valido, fecha_pago }).success).toBe(false);
  });
  it("transforma una fecha real y deja la regla de fecha futura al servicio", () => {
    expect(RegistrarPagoSchema.parse({ ...valido, fecha_pago: "2099-10-01" }).fecha_pago).toEqual(new Date("2099-10-01T00:00:00Z"));
  });
  it("admite fecha omitida", () => expect(RegistrarPagoSchema.parse(valido).fecha_pago).toBeUndefined());
  it.each(["formapago-efectivo", "formapago-transferencia", "formapago-debito", "formapago-mercado-pago"])("admite id del catálogo inicial %s", (forma_pago_id) => {
    expect(RegistrarPagoSchema.safeParse({ ...valido, forma_pago_id }).success).toBe(true);
  });
  it("rechaza ids de forma arbitrarios", () => {
    expect(RegistrarPagoSchema.safeParse({ ...valido, forma_pago_id: "forma-arbitraria" }).success).toBe(false);
  });
  it.each(["alumno_id", "forma_pago_id", "turno_id"])("exige %s", (campo) => {
    expect(RegistrarPagoSchema.safeParse({ ...valido, [campo]: "" }).success).toBe(false);
  });
  it("rechaza campos adicionales y montos numéricos", () => {
    expect(RegistrarPagoSchema.safeParse({ ...valido, numero_tarjeta: "1234" }).success).toBe(false);
    expect(RegistrarPagoSchema.safeParse({ ...valido, monto: 1500.5 }).success).toBe(false);
  });
  it("exige turno en query", () => {
    expect(OpcionesPagoQuerySchema.safeParse({}).success).toBe(false);
    expect(OpcionesPagoQuerySchema.parse({ turno_id: " seed-turno-02 " }).turno_id).toBe("seed-turno-02");
  });
});
