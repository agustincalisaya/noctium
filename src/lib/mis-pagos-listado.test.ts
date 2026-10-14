import { describe, expect, it } from "vitest";
import { filtrosInicialesMisPagos, hayFiltrosMisPagos, parametrosMisPagos } from "@/lib/mis-pagos-listado";

describe("HU-I-05 filtros de Mis pagos en la URL", () => {
  it("conserva filtros válidos, incluido desde = hasta, y descarta parámetros desconocidos", () => {
    expect(filtrosInicialesMisPagos({ desde: "2026-10-01", hasta: "2026-10-01", materia_id: " m1 ", pagina: "2", alumno_id: "x", por_pagina: "50" }))
      .toEqual({ desde: "2026-10-01", hasta: "2026-10-01", materia_id: "m1", pagina: 2 });
  });
  it.each(["2026-02-31", "2026-13-01", "01/10/2026", "", "2026-1-1"])("descarta la fecha inválida %j", (fecha) => {
    expect(filtrosInicialesMisPagos({ desde: fecha }).desde).toBe("");
  });
  it("un rango invertido descarta las dos fechas; 29/02 de año bisiesto es válido", () => {
    expect(filtrosInicialesMisPagos({ desde: "2026-10-20", hasta: "2026-10-01" })).toMatchObject({ desde: "", hasta: "" });
    expect(filtrosInicialesMisPagos({ desde: "2028-02-29" }).desde).toBe("2028-02-29");
  });
  it.each(["0", "-1", "1.5", "abc", undefined])("página inválida %j → 1", (pagina) => {
    expect(filtrosInicialesMisPagos({ pagina }).pagina).toBe(1);
  });
  it("toma el último valor repetido", () => {
    expect(filtrosInicialesMisPagos({ pagina: ["2", "4"] }).pagina).toBe(4);
  });
  it("omite vacíos y la página 1; hay filtros solo con fecha o materia", () => {
    expect(parametrosMisPagos({ desde: "", hasta: "", materia_id: "", pagina: 1 }).toString()).toBe("");
    expect(parametrosMisPagos({ desde: "2026-10-01", hasta: "", materia_id: "m1", pagina: 3 }).toString()).toBe("desde=2026-10-01&materia_id=m1&pagina=3");
    expect(hayFiltrosMisPagos({ desde: "", hasta: "", materia_id: "", pagina: 5 })).toBe(false);
    expect(hayFiltrosMisPagos({ desde: "", hasta: "2026-10-01", materia_id: "", pagina: 1 })).toBe(true);
  });
});
