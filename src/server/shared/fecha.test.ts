import { describe, expect, it } from "vitest";
import { fechaCalendarioValidaSchema } from "./fecha";

describe("fechaCalendarioValidaSchema", () => {
  it("acepta una fecha de calendario real y la devuelve como Date UTC medianoche", () => {
    const resultado = fechaCalendarioValidaSchema.parse("1990-05-15");
    expect(resultado).toEqual(new Date(Date.UTC(1990, 4, 15)));
  });

  it("acepta el 29 de febrero de un año bisiesto (divisible por 4)", () => {
    const resultado = fechaCalendarioValidaSchema.parse("2004-02-29");
    expect(resultado).toEqual(new Date(Date.UTC(2004, 1, 29)));
  });

  it("acepta el 29 de febrero de un año bisiesto por regla de siglo (divisible por 400)", () => {
    const resultado = fechaCalendarioValidaSchema.parse("2000-02-29");
    expect(resultado).toEqual(new Date(Date.UTC(2000, 1, 29)));
  });

  it("rechaza el 29 de febrero de un año NO bisiesto", () => {
    expect(() => fechaCalendarioValidaSchema.parse("2001-02-29")).toThrow();
  });

  it("rechaza el 29 de febrero de un año divisible por 100 pero no por 400 (1900 no es bisiesto)", () => {
    expect(() => fechaCalendarioValidaSchema.parse("1900-02-29")).toThrow();
  });

  it("rechaza el 31 de febrero (mes con 28/29 días, no 31)", () => {
    expect(() => fechaCalendarioValidaSchema.parse("2000-02-31")).toThrow();
  });

  it("rechaza el 30 de febrero", () => {
    expect(() => fechaCalendarioValidaSchema.parse("2000-02-30")).toThrow();
  });

  it("rechaza el día 32 de un mes de 31 días", () => {
    expect(() => fechaCalendarioValidaSchema.parse("2020-01-32")).toThrow();
  });

  it("rechaza el mes 13", () => {
    expect(() => fechaCalendarioValidaSchema.parse("2020-13-01")).toThrow();
  });

  it("rechaza el mes 00", () => {
    expect(() => fechaCalendarioValidaSchema.parse("2020-00-15")).toThrow();
  });

  it("rechaza el día 00", () => {
    expect(() => fechaCalendarioValidaSchema.parse("2020-05-00")).toThrow();
  });

  it("rechaza un string vacío", () => {
    expect(() => fechaCalendarioValidaSchema.parse("")).toThrow();
  });

  it("rechaza un formato con separadores incorrectos (DD/MM/YYYY)", () => {
    expect(() => fechaCalendarioValidaSchema.parse("15/05/1990")).toThrow();
  });

  it("rechaza un formato sin cero-padding (YYYY-M-D)", () => {
    expect(() => fechaCalendarioValidaSchema.parse("1990-5-15")).toThrow();
  });

  it("rechaza un valor no numérico", () => {
    expect(() => fechaCalendarioValidaSchema.parse("199a-05-15")).toThrow();
  });

  it("rechaza texto arbitrario", () => {
    expect(() => fechaCalendarioValidaSchema.parse("no es una fecha")).toThrow();
  });

  it("no reinterpreta silenciosamente una fecha inexistente (a diferencia de z.coerce.date())", () => {
    // new Date("2000-02-31") / Date.UTC(2000, 1, 31) "rebalancea" a
    // 2000-03-02 en vez de fallar — el schema debe rechazar, no corregir.
    const resultado = fechaCalendarioValidaSchema.safeParse("2000-02-31");
    expect(resultado.success).toBe(false);
  });
});
