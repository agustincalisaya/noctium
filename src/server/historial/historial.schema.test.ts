import { describe, expect, it } from "vitest";
import { MiHistorialQuerySchema } from "./historial.schema";
describe("E08 query estricta", () => {
  it("defaults y filtro trim", () => { expect(MiHistorialQuerySchema.parse({})).toEqual({ pagina: 1, por_pagina: 10 }); expect(MiHistorialQuerySchema.parse({ materia_id: " m ", pagina: "2" })).toEqual({ materia_id: "m", pagina: 2, por_pagina: 10 }); });
  it.each([{ pagina: 0 }, { pagina: 1.5 }, { por_pagina: 11 }, { por_pagina: -1 }, { materia_id: " " }, { alumno_id: "x" }, { otro: true }])("rechaza %j", input => { expect(MiHistorialQuerySchema.safeParse(input).success).toBe(false); });
});
