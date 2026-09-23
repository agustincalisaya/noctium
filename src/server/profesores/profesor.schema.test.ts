import { describe, expect, it } from "vitest";
import { AsociarMateriasProfesorSchema, ProfesorIdSchema } from "./profesor.schema";

// Código escrito, no ejecutado — sin test runner instalado (HU-D-01 §6).

const MATERIA_A = "ckmateria0000000000000001";
const MATERIA_B = "ckmateria0000000000000002";

describe("AsociarMateriasProfesorSchema", () => {
  it("acepta una lista de ids cuid", () => {
    const resultado = AsociarMateriasProfesorSchema.parse({ materiaIds: [MATERIA_A, MATERIA_B] });
    expect(resultado.materiaIds).toEqual([MATERIA_A, MATERIA_B]);
  });

  it("rechaza un array vacío (criterio 3: al menos una materia nueva)", () => {
    const resultado = AsociarMateriasProfesorSchema.safeParse({ materiaIds: [] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe("Seleccioná al menos una materia nueva");
  });

  it("rechaza un id que no es cuid", () => {
    const resultado = AsociarMateriasProfesorSchema.safeParse({ materiaIds: ["no-es-cuid"] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe("Materia inválida");
  });

  it("rechaza la ausencia del campo materiaIds", () => {
    expect(AsociarMateriasProfesorSchema.safeParse({}).success).toBe(false);
  });

  it("deduplica ids repetidos conservando el orden", () => {
    const resultado = AsociarMateriasProfesorSchema.parse({
      materiaIds: [MATERIA_A, MATERIA_B, MATERIA_A],
    });
    expect(resultado.materiaIds).toEqual([MATERIA_A, MATERIA_B]);
  });
});

describe("ProfesorIdSchema", () => {
  it("acepta un cuid", () => {
    expect(ProfesorIdSchema.safeParse("ckprofesor000000000000001").success).toBe(true);
  });

  it("rechaza un id vacío o con formato inválido", () => {
    expect(ProfesorIdSchema.safeParse("").success).toBe(false);
    expect(ProfesorIdSchema.safeParse("123").success).toBe(false);
  });
});
