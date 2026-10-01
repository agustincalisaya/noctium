import { describe, expect, it } from "vitest";
import {
  construirUrlCalendarioProfesor,
  desplazarFecha,
  desplazarMes,
  diaDeLaFecha,
  esPeriodoActual,
  formatearDiaLargo,
  formatearMes,
  formatearRangoCorto,
  grillaDelMes,
  navegacionDelCalendario,
  periodoDeLaVista,
  primerDiaDelMes,
  resolverVistaYFecha,
  rotuloDelPeriodo,
  ultimoDiaDelMes,
} from "@/lib/calendario-semana";

// HU-J-03: helpers puros de las vistas día, semana y mes.

const LUNES_A_VIERNES = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"] as const;
const HOY = "2026-09-30"; // miércoles

describe("resolverVistaYFecha", () => {
  it("sin parámetros abre la semana de hoy (c1)", () => {
    expect(resolverVistaYFecha({}, HOY)).toEqual({ vista: "semana", fecha: HOY, fechaExplicita: false });
  });

  it("vista desconocida -> semana; fecha inválida -> hoy", () => {
    expect(resolverVistaYFecha({ vista: "anio", fecha: "2026-02-31" }, HOY)).toEqual({
      vista: "semana",
      fecha: HOY,
      fechaExplicita: false,
    });
  });

  it("acepta vista y fecha válidas", () => {
    expect(resolverVistaYFecha({ vista: "mes", fecha: "2026-10-15" }, HOY)).toEqual({
      vista: "mes",
      fecha: "2026-10-15",
      fechaExplicita: true,
    });
  });

  it("?semana= de HU-J-01/J-02 equivale a vista=semana&fecha=<valor>; fecha gana si vienen las dos", () => {
    expect(resolverVistaYFecha({ semana: "2026-09-21" }, HOY)).toEqual({
      vista: "semana",
      fecha: "2026-09-21",
      fechaExplicita: true,
    });
    expect(resolverVistaYFecha({ semana: "2026-09-21", fecha: "2026-09-14" }, HOY).fecha).toBe("2026-09-14");
  });
});

describe("mes calendario", () => {
  it("primer y último día, con febrero común y bisiesto", () => {
    expect(primerDiaDelMes("2026-09-17")).toBe("2026-09-01");
    expect(ultimoDiaDelMes("2026-09-17")).toBe("2026-09-30");
    expect(ultimoDiaDelMes("2026-10-01")).toBe("2026-10-31");
    expect(ultimoDiaDelMes("2026-02-10")).toBe("2026-02-28");
    expect(ultimoDiaDelMes("2028-02-10")).toBe("2028-02-29");
  });

  it("desplazarMes devuelve el día 1 y cruza de año (sin el problema del 31)", () => {
    expect(desplazarMes("2026-01-31", 1)).toBe("2026-02-01");
    expect(desplazarMes("2026-12-15", 1)).toBe("2027-01-01");
    expect(desplazarMes("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("grillaDelMes arma semanas completas de lunes a domingo", () => {
    const septiembre = grillaDelMes("2026-09-30");
    expect(septiembre).toMatchObject({ desde: "2026-08-31", hasta: "2026-10-04" });
    expect(septiembre.semanas).toHaveLength(5);
    expect(septiembre.semanas.every((semana) => semana.length === 7)).toBe(true);
    expect(septiembre.semanas[0]![0]).toBe("2026-08-31");

    // Agosto 2026 empieza en sábado: 6 semanas.
    const agosto = grillaDelMes("2026-08-10");
    expect(agosto).toMatchObject({ desde: "2026-07-27", hasta: "2026-09-06" });
    expect(agosto.semanas).toHaveLength(6);

    // Junio 2026 empieza en lunes: sin relleno al principio.
    expect(grillaDelMes("2026-06-10")).toMatchObject({ desde: "2026-06-01", hasta: "2026-07-05" });
  });
});

describe("desplazarFecha (‹ / › según la vista, c5)", () => {
  it("mueve un día, una semana o un mes", () => {
    expect(desplazarFecha("dia", "2026-09-30", 1)).toBe("2026-10-01");
    expect(desplazarFecha("dia", "2026-09-30", -1)).toBe("2026-09-29");
    expect(desplazarFecha("semana", "2026-09-30", 1)).toBe("2026-10-05");
    expect(desplazarFecha("semana", "2026-09-30", -1)).toBe("2026-09-21");
    expect(desplazarFecha("mes", "2026-09-30", 1)).toBe("2026-10-01");
    expect(desplazarFecha("mes", "2026-12-30", 1)).toBe("2027-01-01");
  });
});

describe("periodoDeLaVista", () => {
  it("día: [fecha, fecha], una columna aunque no sea día operativo", () => {
    const sabado = periodoDeLaVista("dia", "2026-10-03", LUNES_A_VIERNES);
    expect(sabado).toEqual({
      vista: "dia",
      rango: { desde: "2026-10-03", hasta: "2026-10-03" },
      consulta: { desde: "2026-10-03", hasta: "2026-10-03" },
      dias: [{ fecha: "2026-10-03", dia: "SABADO" }],
    });
  });

  it("semana: mismo criterio que HU-J-01 (lunes a domingo, días operativos)", () => {
    const semana = periodoDeLaVista("semana", "2026-09-30", LUNES_A_VIERNES);
    expect(semana.rango).toEqual({ desde: "2026-09-28", hasta: "2026-10-02" });
    expect(semana.consulta).toEqual(semana.rango);
    expect(semana.vista === "semana" && semana.dias.map(({ dia }) => dia)).toEqual([...LUNES_A_VIERNES]);
  });

  it("mes: rango del mes calendario y consulta de la grilla completa", () => {
    const mes = periodoDeLaVista("mes", "2026-09-30", LUNES_A_VIERNES);
    expect(mes.rango).toEqual({ desde: "2026-09-01", hasta: "2026-09-30" });
    expect(mes.consulta).toEqual({ desde: "2026-08-31", hasta: "2026-10-04" });
  });
});

describe("rótulos del período", () => {
  it("día largo, rango corto y mes", () => {
    expect(formatearDiaLargo("2026-09-30")).toBe("Miércoles 30 de septiembre de 2026");
    expect(formatearRangoCorto("2026-09-28", "2026-10-03")).toBe("28 sep – 3 oct 2026");
    expect(formatearRangoCorto("2026-12-28", "2027-01-01")).toBe("28 dic 2026 – 1 ene 2027");
    expect(formatearMes("2026-09-01")).toBe("Septiembre 2026");
  });

  it("rotuloDelPeriodo según la vista", () => {
    expect(rotuloDelPeriodo(periodoDeLaVista("dia", HOY, LUNES_A_VIERNES))).toBe("Miércoles 30 de septiembre de 2026");
    expect(rotuloDelPeriodo(periodoDeLaVista("semana", HOY, LUNES_A_VIERNES))).toBe("28 sep – 2 oct 2026");
    expect(rotuloDelPeriodo(periodoDeLaVista("mes", HOY, LUNES_A_VIERNES))).toBe("Septiembre 2026");
  });

  it("diaDeLaFecha", () => {
    expect(diaDeLaFecha("2026-09-28")).toBe("LUNES");
    expect(diaDeLaFecha("2026-10-04")).toBe("DOMINGO");
  });
});

describe("esPeriodoActual", () => {
  it("compara día, semana o mes con hoy", () => {
    expect(esPeriodoActual("dia", HOY, HOY)).toBe(true);
    expect(esPeriodoActual("dia", "2026-09-29", HOY)).toBe(false);
    expect(esPeriodoActual("semana", "2026-10-04", HOY)).toBe(true);
    expect(esPeriodoActual("semana", "2026-10-05", HOY)).toBe(false);
    expect(esPeriodoActual("mes", "2026-09-01", HOY)).toBe(true);
    expect(esPeriodoActual("mes", "2026-10-01", HOY)).toBe(false);
  });
});

describe("navegacionDelCalendario (c4 y c5)", () => {
  const url = (valores: { vista?: "dia" | "semana" | "mes"; fecha?: string }) =>
    construirUrlCalendarioProfesor({ profesorId: "ckprof", ...valores });

  it("cambiar de vista y 'Hoy' conservan el profesor y omiten la fecha (abren en hoy)", () => {
    const navegacion = navegacionDelCalendario({
      periodo: periodoDeLaVista("semana", "2026-10-14", LUNES_A_VIERNES),
      fecha: "2026-10-14",
      hoy: HOY,
      url,
    });
    expect(navegacion.hrefsVista).toEqual({
      dia: "/calendario/profesor?profesorId=ckprof&vista=dia",
      semana: "/calendario/profesor?profesorId=ckprof&vista=semana",
      mes: "/calendario/profesor?profesorId=ckprof&vista=mes",
    });
    expect(navegacion.hrefHoy).toBe("/calendario/profesor?profesorId=ckprof&vista=semana");
    expect(navegacion.esPeriodoActual).toBe(false);
  });

  it("‹ / › llevan la fecha movida según la vista activa", () => {
    const mes = navegacionDelCalendario({ periodo: periodoDeLaVista("mes", HOY, LUNES_A_VIERNES), fecha: HOY, hoy: HOY, url });
    expect(mes.hrefAnterior).toBe("/calendario/profesor?profesorId=ckprof&vista=mes&fecha=2026-08-01");
    expect(mes.hrefSiguiente).toBe("/calendario/profesor?profesorId=ckprof&vista=mes&fecha=2026-10-01");
    expect(mes.rotulo).toBe("Septiembre 2026");
    expect(mes.esPeriodoActual).toBe(true);

    const dia = navegacionDelCalendario({ periodo: periodoDeLaVista("dia", HOY, LUNES_A_VIERNES), fecha: HOY, hoy: HOY, url });
    expect(dia.hrefAnterior).toBe("/calendario/profesor?profesorId=ckprof&vista=dia&fecha=2026-09-29");
    expect(dia.hrefSiguiente).toBe("/calendario/profesor?profesorId=ckprof&vista=dia&fecha=2026-10-01");
  });
});
