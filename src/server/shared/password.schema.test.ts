import { describe, expect, it } from "vitest";
import { politicaPasswordSchema } from "./password.schema";

describe("politicaPasswordSchema", () => {
  const schema = politicaPasswordSchema(8);

  it("acepta una contraseña que cumple los 4 requisitos", () => {
    expect(schema.safeParse("Abcdefg1").success).toBe(true);
  });

  it("rechaza una contraseña más corta que el mínimo parametrizado", () => {
    const resultado = schema.safeParse("Abc1");
    expect(resultado.success).toBe(false);
  });

  it("respeta el mínimo parametrizado (no hardcodeado)", () => {
    expect(politicaPasswordSchema(4).safeParse("Ab1x").success).toBe(true);
    expect(politicaPasswordSchema(12).safeParse("Abcdefg1").success).toBe(false);
  });

  it("rechaza sin mayúscula", () => {
    expect(schema.safeParse("abcdefg1").success).toBe(false);
  });

  it("rechaza sin minúscula", () => {
    expect(schema.safeParse("ABCDEFG1").success).toBe(false);
  });

  it("rechaza sin número", () => {
    expect(schema.safeParse("Abcdefgh").success).toBe(false);
  });

  it("el mensaje de longitud incluye el mínimo parametrizado", () => {
    const resultado = politicaPasswordSchema(10).safeParse("Ab1");
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.some((i) => i.message.includes("10 caracteres"))).toBe(true);
    }
  });
});
