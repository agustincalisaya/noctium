import { describe, expect, it } from "vitest";
import {
  asignarCarriles,
  construirUrlCalendarioProfesor,
  desplazarSemana,
  diasOperativosDeLaSemana,
  esFechaCalendario,
  formatearRangoSemana,
  franjasDeLaGrilla,
  hoyEnZonaCentro,
  lunesDeLaSemana,
  posicionEnGrilla,
  rangoDeLaSemana,
} from "@/lib/calendario-semana";

// HU-J-01: helpers puros de la agenda semanal.

const LUNES_A_VIERNES = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"] as const;
const HORARIO = { apertura: "08:00", cierre: "20:00", granularidadMinutos: 30 };

describe("hoyEnZonaCentro", () => {
  it("usa el día de Buenos Aires, no el UTC", () => {
    // 02:30 UTC del 24/09 = 23:30 del 23/09 en Buenos Aires (UTC-3).
    expect(hoyEnZonaCentro(new Date("2026-09-24T02:30:00Z"))).toBe("2026-09-23");
    expect(hoyEnZonaCentro(new Date("2026-09-24T03:30:00Z"))).toBe("2026-09-24");
  });
});

describe("lunesDeLaSemana", () => {
  it("normaliza cualquier día al lunes de su semana (lunes a domingo)", () => {
    expect(lunesDeLaSemana("2026-09-21")).toBe("2026-09-21");
    expect(lunesDeLaSemana("2026-09-23")).toBe("2026-09-21");
    expect(lunesDeLaSemana("2026-09-27")).toBe("2026-09-21");
  });

  it("cruza de mes y de año", () => {
    expect(lunesDeLaSemana("2026-03-01")).toBe("2026-02-23");
    expect(lunesDeLaSemana("2026-01-01")).toBe("2025-12-29");
  });
});

describe("desplazarSemana", () => {
  it("avanza y retrocede de a 7 días, cruzando mes y año", () => {
    expect(desplazarSemana("2026-09-21", 1)).toBe("2026-09-28");
    expect(desplazarSemana("2026-09-21", -1)).toBe("2026-09-14");
    expect(desplazarSemana("2025-12-29", 1)).toBe("2026-01-05");
  });
});

describe("diasOperativosDeLaSemana y rangoDeLaSemana", () => {
  it("devuelve solo los días operativos, con su fecha, en orden de semana", () => {
    expect(diasOperativosDeLaSemana("2026-09-21", LUNES_A_VIERNES)).toEqual([
      { fecha: "2026-09-21", dia: "LUNES" },
      { fecha: "2026-09-22", dia: "MARTES" },
      { fecha: "2026-09-23", dia: "MIERCOLES" },
      { fecha: "2026-09-24", dia: "JUEVES" },
      { fecha: "2026-09-25", dia: "VIERNES" },
    ]);
    expect(diasOperativosDeLaSemana("2026-09-21", ["SABADO", "LUNES", "MIERCOLES"])).toEqual([
      { fecha: "2026-09-21", dia: "LUNES" },
      { fecha: "2026-09-23", dia: "MIERCOLES" },
      { fecha: "2026-09-26", dia: "SABADO" },
    ]);
  });

  it("el rango va del primer al último día operativo (lunes a sábado coincide con la spec)", () => {
    expect(rangoDeLaSemana("2026-09-21", LUNES_A_VIERNES)).toEqual({ desde: "2026-09-21", hasta: "2026-09-25" });
    expect(rangoDeLaSemana("2026-09-21", [...LUNES_A_VIERNES, "SABADO"])).toEqual({
      desde: "2026-09-21",
      hasta: "2026-09-26",
    });
    expect(rangoDeLaSemana("2026-09-21", [])).toEqual({ desde: "2026-09-21", hasta: "2026-09-27" });
  });
});

describe("formatearRangoSemana", () => {
  it("muestra el año una vez, o en ambas fechas si cruza de año", () => {
    expect(formatearRangoSemana("2026-09-21", "2026-09-25")).toBe("Semana del 21/09 al 25/09/2026");
    expect(formatearRangoSemana("2025-12-29", "2026-01-02")).toBe("Semana del 29/12/2025 al 02/01/2026");
  });
});

describe("esFechaCalendario", () => {
  it("acepta solo fechas AAAA-MM-DD que existen", () => {
    expect(esFechaCalendario("2026-02-28")).toBe(true);
    expect(esFechaCalendario("2026-02-31")).toBe(false);
    expect(esFechaCalendario("21/09/2026")).toBe(false);
    expect(esFechaCalendario(undefined)).toBe(false);
  });
});

describe("franjasDeLaGrilla y posicionEnGrilla", () => {
  it("genera una fila cada 30 minutos del horario operativo, sin el cierre", () => {
    const franjas = franjasDeLaGrilla(HORARIO);
    expect(franjas).toHaveLength(24);
    expect(franjas[0]).toBe("08:00");
    expect(franjas.at(-1)).toBe("19:30");
  });

  it("el evento ocupa su intervalo completo", () => {
    expect(posicionEnGrilla({ hora_inicio: "10:00", hora_fin: "11:00" }, HORARIO)).toEqual({
      filaInicio: 4,
      filas: 2,
    });
    expect(posicionEnGrilla({ hora_inicio: "14:00", hora_fin: "17:00" }, HORARIO)).toEqual({
      filaInicio: 12,
      filas: 6,
    });
  });

  it("recorta lo que cae fuera de la franja y descarta lo que cae completo afuera", () => {
    expect(posicionEnGrilla({ hora_inicio: "07:00", hora_fin: "09:00" }, HORARIO)).toEqual({
      filaInicio: 0,
      filas: 2,
    });
    expect(posicionEnGrilla({ hora_inicio: "20:00", hora_fin: "21:00" }, HORARIO)).toBeNull();
  });
});

describe("asignarCarriles", () => {
  it("pone uno al lado del otro los eventos superpuestos, sin ocultar ninguno", () => {
    const a = { hora_inicio: "10:00", hora_fin: "11:00" };
    const b = { hora_inicio: "10:30", hora_fin: "11:30" };
    const c = { hora_inicio: "12:00", hora_fin: "13:00" };
    expect(asignarCarriles([c, b, a])).toEqual([
      { evento: a, carril: 0, carriles: 2 },
      { evento: b, carril: 1, carriles: 2 },
      { evento: c, carril: 0, carriles: 1 },
    ]);
  });

  it("los contiguos no se superponen", () => {
    const a = { hora_inicio: "10:00", hora_fin: "11:00" };
    const b = { hora_inicio: "11:00", hora_fin: "12:00" };
    expect(asignarCarriles([a, b]).map(({ carril, carriles }) => [carril, carriles])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });
});

describe("construirUrlCalendarioProfesor", () => {
  it("lleva profesor y semana en los searchParams y omite los ausentes", () => {
    expect(construirUrlCalendarioProfesor({ profesorId: "ckabc", semana: "2026-09-21" })).toBe(
      "/calendario/profesor?profesorId=ckabc&semana=2026-09-21",
    );
    expect(construirUrlCalendarioProfesor({ semana: "2026-09-21" })).toBe("/calendario/profesor?semana=2026-09-21");
    expect(construirUrlCalendarioProfesor({})).toBe("/calendario/profesor");
  });
});
