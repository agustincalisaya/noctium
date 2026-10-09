import { describe, expect, it } from "vitest";
import { ClasesAlumnoQuerySchema, RESULTADOS_CLASE_ALUMNO } from "./clases-alumno.schema";
describe("E02 query", () => {
  it("defaults y nueve resultados", () => { expect(ClasesAlumnoQuerySchema.parse({})).toEqual({ pagina: 1, por_pagina: 10 }); for (const resultado of RESULTADOS_CLASE_ALUMNO) expect(ClasesAlumnoQuerySchema.safeParse({ resultado }).success).toBe(true); });
  it("fechas inclusivas iguales y transformación Date", () => { expect(ClasesAlumnoQuerySchema.parse({ desde: "2026-10-09", hasta: "2026-10-09" }).desde).toEqual(new Date("2026-10-09Z")); });
  it.each([{ desde: "2026-02-30" }, { desde: "2026-10-10", hasta: "2026-10-09" }, { resultado: "otro" }, { pagina: 0 }, { por_pagina: 11 }, { desconocido: true }])("rechaza %j", q => { expect(ClasesAlumnoQuerySchema.safeParse(q).success).toBe(false); });
});
