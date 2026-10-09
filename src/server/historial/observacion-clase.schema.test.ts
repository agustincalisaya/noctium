import { describe, expect, it } from "vitest";
import { RegistrarObservacionClaseSchema } from "./observacion-clase.schema";

describe("RegistrarObservacionClaseSchema", () => {
  it("recorta ambos textos y admite observación interna omitida o vacía", () => {
    expect(RegistrarObservacionClaseSchema.parse({ temas_vistos: "  Funciones lineales  " })).toEqual({ temas_vistos: "Funciones lineales" });
    expect(RegistrarObservacionClaseSchema.parse({ temas_vistos: "Álgebra", observaciones_internas: "  " })).toEqual({ temas_vistos: "Álgebra", observaciones_internas: "" });
  });

  it("acepta 1000 caracteres por campo y rechaza 1001", () => {
    expect(RegistrarObservacionClaseSchema.safeParse({ temas_vistos: "a".repeat(1000) }).success).toBe(true);
    expect(RegistrarObservacionClaseSchema.safeParse({ temas_vistos: "a".repeat(1001) }).success).toBe(false);
    expect(RegistrarObservacionClaseSchema.safeParse({ temas_vistos: "a", observaciones_internas: "b".repeat(1000) }).success).toBe(true);
    expect(RegistrarObservacionClaseSchema.safeParse({ temas_vistos: "a", observaciones_internas: "b".repeat(1001) }).success).toBe(false);
  });

  it.each(["", " ", "\n\t"]) ("rechaza temas vistos con solo espacios (%j)", (temas_vistos) => {
    expect(RegistrarObservacionClaseSchema.safeParse({ temas_vistos }).success).toBe(false);
  });

  it("rechaza campos ausentes, tipos incorrectos y propiedades desconocidas", () => {
    expect(RegistrarObservacionClaseSchema.safeParse({}).success).toBe(false);
    expect(RegistrarObservacionClaseSchema.safeParse({ temas_vistos: 1 }).success).toBe(false);
    expect(RegistrarObservacionClaseSchema.safeParse({ temas_vistos: "Álgebra", extra: true }).success).toBe(false);
  });
});
