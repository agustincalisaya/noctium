import { describe, expect, it } from "vitest";
import {
  BuscarAlumnosCobroQuerySchema, formaPagoIdSchema, montoSchema, motivoSchema, OpcionesPagoQuerySchema,
  PendientesQuerySchema, RegistrarOperacionSchema, RegistrarPagoSchema,
} from "@/server/pagos/pago.schema";

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

// ---------------------------------------------------------------------------
// HU-I-10 (spec_modulo_I.md §2.7.1-2.7.3)
// ---------------------------------------------------------------------------

const CUID = "c123456789012345678901234";
const CUID_2 = "c223456789012345678901234";
const operacion = { alumno_id: CUID, items: [{ inscripcion_id: CUID_2, monto: "12000" }], forma_pago_id: "formapago-efectivo" };
const mensajes = (resultado: { success: boolean; error?: { issues: { message: string }[] } }) => resultado.error?.issues.map((i) => i.message) ?? [];

describe("HU-I-10 constantes compartidas", () => {
  it("RegistrarPagoSchema conserva el mensaje de forma de pago", () => {
    expect(mensajes(RegistrarPagoSchema.safeParse({ ...valido, forma_pago_id: undefined }))).toContain("Elegí una forma de pago");
  });
  it("motivoSchema exige texto y tope de 300", () => {
    expect(mensajes(motivoSchema.safeParse("   "))).toEqual(["Ingresá el motivo"]);
    expect(mensajes(motivoSchema.safeParse("x".repeat(301)))).toEqual(["El motivo no puede superar los 300 caracteres"]);
  });
  it("montoSchema y formaPagoIdSchema son los de HU-I-01", () => {
    expect(mensajes(montoSchema.safeParse("0"))).toEqual(["El monto debe ser mayor a cero"]);
    expect(formaPagoIdSchema.safeParse("formapago-debito").success).toBe(true);
  });
});

describe("HU-I-10 BuscarAlumnosCobroQuerySchema", () => {
  it("exige 2 caracteres después de recortar", () => {
    expect(mensajes(BuscarAlumnosCobroQuerySchema.safeParse({ q: " a " }))).toEqual(["Escribí al menos 2 caracteres"]);
    expect(BuscarAlumnosCobroQuerySchema.parse({ q: " an " }).q).toBe("an");
  });
  it("rechaza parámetros extra", () => {
    expect(BuscarAlumnosCobroQuerySchema.safeParse({ q: "ana", pagina: "2" }).success).toBe(false);
  });
});

describe("HU-I-10 PendientesQuerySchema", () => {
  it("alumno CUID y turno opcional (los del seed no son CUID)", () => {
    expect(PendientesQuerySchema.parse({ alumno_id: CUID, turno_id: " seed-turno-12 " })).toEqual({ alumno_id: CUID, turno_id: "seed-turno-12" });
    expect(PendientesQuerySchema.safeParse({ alumno_id: "x" }).success).toBe(false);
    expect(PendientesQuerySchema.safeParse({ alumno_id: CUID, extra: "1" }).success).toBe(false);
  });
});

describe("HU-I-10 RegistrarOperacionSchema", () => {
  it("admite inscripciones y «Se inscribe al confirmar el pago», con motivo y fecha", () => {
    const datos = RegistrarOperacionSchema.parse({
      ...operacion,
      items: [{ inscripcion_id: CUID_2, monto: "11000", motivo_ajuste: " Beca " }, { turno_id: "seed-turno-12", monto: "12000.50" }],
      fecha_pago: "2026-10-09",
    });
    expect(datos.items[0]!.motivo_ajuste).toBe("Beca");
    expect(datos.fecha_pago).toEqual(new Date("2026-10-09T00:00:00Z"));
  });
  it("mensaje del alumno", () => {
    expect(mensajes(RegistrarOperacionSchema.safeParse({ ...operacion, alumno_id: "x" }))).toContain("Elegí el alumno que paga");
  });
  it.each([
    ["con los dos ids", { inscripcion_id: CUID_2, turno_id: "seed-turno-12", monto: "1" }],
    ["sin ningún id", { monto: "1" }],
  ])("ítem %s", (_caso, item) => {
    expect(mensajes(RegistrarOperacionSchema.safeParse({ ...operacion, items: [item] }))).toContain("Cada clase lleva inscripcion_id o turno_id, no los dos");
  });
  it.each(["0", "-1", "1.001", ""])("monto inválido %j", (monto) => {
    expect(RegistrarOperacionSchema.safeParse({ ...operacion, items: [{ inscripcion_id: CUID_2, monto }] }).success).toBe(false);
  });
  it("motivo vacío o de más de 300", () => {
    expect(RegistrarOperacionSchema.safeParse({ ...operacion, items: [{ inscripcion_id: CUID_2, monto: "1", motivo_ajuste: " " }] }).success).toBe(false);
    expect(RegistrarOperacionSchema.safeParse({ ...operacion, items: [{ inscripcion_id: CUID_2, monto: "1", motivo_ajuste: "x".repeat(301) }] }).success).toBe(false);
  });
  it("ninguna clase, más de 50 y clases repetidas", () => {
    expect(mensajes(RegistrarOperacionSchema.safeParse({ ...operacion, items: [] }))).toContain("Elegí al menos una clase");
    const muchos = Array.from({ length: 51 }, (_, i) => ({ turno_id: `seed-turno-${i}`, monto: "1" }));
    expect(RegistrarOperacionSchema.safeParse({ ...operacion, items: muchos }).success).toBe(false);
    expect(mensajes(RegistrarOperacionSchema.safeParse({ ...operacion, items: [operacion.items[0], operacion.items[0]] }))).toContain("No repitas una clase en la misma operación");
    expect(mensajes(RegistrarOperacionSchema.safeParse({ ...operacion, items: [{ turno_id: "t", monto: "1" }, { turno_id: "t", monto: "2" }] }))).toContain("No repitas una clase en la misma operación");
  });
  it("rechaza campos extra en la operación y en el ítem (el precio no viaja)", () => {
    expect(RegistrarOperacionSchema.safeParse({ ...operacion, total: "12000" }).success).toBe(false);
    expect(RegistrarOperacionSchema.safeParse({ ...operacion, items: [{ inscripcion_id: CUID_2, monto: "1", precio: 12000 }] }).success).toBe(false);
  });
});
