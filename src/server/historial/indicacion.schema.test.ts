import { describe, expect, it } from "vitest";
import { RegistrarIndicacionSchema } from "./indicacion.schema";

describe("RegistrarIndicacionSchema", () => {
  it("recorta el texto y acepta materia y clase opcional", () => {
    expect(RegistrarIndicacionSchema.parse({ materia_id: " materia-1 ", indicacion: "  Practicar ecuaciones  ", clase_dictada_id: " clase-1 " })).toEqual({
      materia_id: "materia-1", indicacion: "Practicar ecuaciones", clase_dictada_id: "clase-1",
    });
    expect(RegistrarIndicacionSchema.parse({ materia_id: "materia-1", indicacion: "Practicar ecuaciones" }).clase_dictada_id).toBeUndefined();
  });

  it("rechaza texto vacío, solo espacios, más de 1000 caracteres y campos desconocidos", () => {
    for (const indicacion of ["", "   ", "x".repeat(1001)]) {
      expect(RegistrarIndicacionSchema.safeParse({ materia_id: "materia-1", indicacion }).success).toBe(false);
    }
    expect(RegistrarIndicacionSchema.parse({ materia_id: "materia-1", indicacion: ` ${"x".repeat(1000)} ` }).indicacion).toHaveLength(1000);
    expect(RegistrarIndicacionSchema.safeParse({ materia_id: "materia-1", indicacion: "Repasar", extra: true }).success).toBe(false);
    expect(RegistrarIndicacionSchema.safeParse({ materia_id: "materia-1", indicacion: "Repasar", clase_dictada_id: " " }).success).toBe(false);
  });
});
