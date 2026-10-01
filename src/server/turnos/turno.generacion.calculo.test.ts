import { describe, expect, it } from "vitest";
import { calcularOcurrencias, contarOcurrenciasDentroDelMaximo, motivosConflictoGeneracion, sumarMesesCalendario, validarEncajeEnFranja } from "./turno.generacion.calculo";

const fecha = (valor: string) => new Date(`${valor}T00:00:00.000Z`);
const hoy = { fecha: "2026-09-30", hora: "09:00" };
const dias = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"] as const;
const calcular = (desde: string, hasta: string, dia: "LUNES" | "MIERCOLES" = "LUNES", hora = "10:00", actual = hoy) =>
  calcularOcurrencias(fecha(desde), fecha(hasta), dia, dias, hora, actual);
const iso = (fechas: Date[]) => fechas.map((valor) => valor.toISOString().slice(0, 10));

describe("cálculo puro de fechas C-17", () => {
  it("incluye ambos extremos y una única ocurrencia", () => {
    expect(iso(calcular("2026-10-05", "2026-10-05").fechas)).toEqual(["2026-10-05"]);
  });

  it("enumera varias semanas, cruza mes y año", () => {
    expect(iso(calcular("2026-12-21", "2027-01-04").fechas)).toEqual(["2026-12-21", "2026-12-28", "2027-01-04"]);
    expect(iso(calcular("2026-10-26", "2026-11-02").fechas)).toEqual(["2026-10-26", "2026-11-02"]);
  });

  it("respeta febrero bisiesto", () => {
    expect(iso(calcular("2024-02-26", "2024-03-04").fechas)).toEqual(["2024-02-26", "2024-03-04"]);
  });

  it("calcula seis meses de calendario con ajuste al fin de mes", () => {
    expect(sumarMesesCalendario(fecha("2026-10-05"), 6)).toEqual(fecha("2027-04-05"));
    expect(sumarMesesCalendario(fecha("2026-08-31"), 6)).toEqual(fecha("2027-02-28"));
    expect(sumarMesesCalendario(fecha("2023-08-31"), 6)).toEqual(fecha("2024-02-29"));
  });

  it("distingue exactamente 40 ocurrencias de 41", () => {
    const inicio = fecha("2026-10-05");
    const cuarenta = new Date(inicio.getTime() + 39 * 7 * 86400000);
    const cuarentaYUna = new Date(inicio.getTime() + 40 * 7 * 86400000);
    expect(contarOcurrenciasDentroDelMaximo(calcularOcurrencias(inicio, cuarenta, "LUNES", dias, "10:00", hoy).fechas.length, 40)).toBe(true);
    expect(contarOcurrenciasDentroDelMaximo(calcularOcurrencias(inicio, cuarentaYUna, "LUNES", dias, "10:00", hoy).fechas.length, 40)).toBe(false);
  });

  it("no crea fechas cuando falta el día de la franja o no es operativo", () => {
    expect(calcular("2026-10-06", "2026-10-06").fechas).toEqual([]);
    expect(calcularOcurrencias(fecha("2026-10-05"), fecha("2026-10-12"), "LUNES", ["MARTES"], "10:00", hoy).fechas).toEqual([]);
  });

  it("incluye hoy futuro y omite hoy vencido, incluida la misma hora", () => {
    expect(iso(calcular("2026-09-30", "2026-09-30", "MIERCOLES", "10:00").fechas)).toEqual(["2026-09-30"]);
    expect(calcular("2026-09-30", "2026-09-30", "MIERCOLES", "08:30")).toMatchObject({ fechas: [], fechasOmitidasVencidas: 1 });
    expect(calcular("2026-09-30", "2026-09-30", "MIERCOLES", "09:00")).toMatchObject({ fechas: [], fechasOmitidasVencidas: 1 });
  });
});

describe("encaje de franja C-17", () => {
  const franja = { hora_inicio: "08:00", hora_fin: "12:00" };
  it.each([60, 120, 180])("acepta %i minutos al inicio alineado", (duracion) => {
    expect(validarEncajeEnFranja(franja, "08:00", duracion, 30)).toBe(true);
  });
  it("acepta un final exactamente al borde de la franja", () => {
    expect(validarEncajeEnFranja(franja, "11:00", 60, 30)).toBe(true);
    expect(validarEncajeEnFranja(franja, "10:00", 120, 30)).toBe(true);
  });
  it("rechaza inicio no alineado y duración que excede la franja", () => {
    expect(validarEncajeEnFranja(franja, "08:15", 60, 30)).toBe(false);
    expect(validarEncajeEnFranja(franja, "10:00", 180, 30)).toBe(false);
  });
});

describe("precedencia de conflictos C-17", () => {
  it("conserva los dos conflictos físicos en orden documentado", () => {
    expect(motivosConflictoGeneracion(false, false, false)).toEqual([]);
    expect(motivosConflictoGeneracion(false, true, true)).toEqual(["AULA_OCUPADA", "PROFESOR_OCUPADO"]);
  });
  it("el duplicado prevalece sobre cualquier choque físico", () => {
    expect(motivosConflictoGeneracion(true, true, true)).toEqual(["TURNO_EXISTENTE"]);
  });
});
