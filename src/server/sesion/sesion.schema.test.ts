import { describe, expect, it } from "vitest";
import { CredencialesLoginSchema, construirCambiarPasswordSchema } from "@/server/sesion/sesion.schema";

// HU-A-06 (spec_modulo_A.md §2.6.3, §3.8 y T12): la política rige solo para
// la contraseña nueva; el login acepta el DNI tal cual.

describe("CredencialesLoginSchema (sin cambios)", () => {
  it.each(["3011122", "30111222"])("acepta un DNI de %s como contraseña", (dni) => {
    expect(CredencialesLoginSchema.safeParse({ email: "Ana@Noctium.Local ", password: dni })).toMatchObject({
      success: true,
      data: { email: "ana@noctium.local", password: dni },
    });
  });

  it("sigue rechazando la contraseña vacía", () => {
    expect(CredencialesLoginSchema.safeParse({ email: "ana@noctium.local", password: "" }).success).toBe(false);
  });
});

describe("construirCambiarPasswordSchema", () => {
  const schema = construirCambiarPasswordSchema(8);
  const errores = (datos: Record<string, unknown>) => {
    const r = schema.safeParse(datos);
    return r.success ? {} : r.error.flatten().fieldErrors;
  };

  it("acepta una contraseña que cumple la política, con o sin la actual", () => {
    expect(schema.safeParse({ password_nueva: "NuevaClave1", confirmacion: "NuevaClave1" }).success).toBe(true);
    expect(schema.safeParse({ password_actual: "x", password_nueva: "NuevaClave1", confirmacion: "NuevaClave1" }).success).toBe(true);
  });

  it.each([
    ["corta", "Nueva1", "La contraseña debe tener al menos 8 caracteres"],
    ["sin mayúscula", "nuevaclave1", "La contraseña debe tener al menos una mayúscula"],
    ["sin minúscula", "NUEVACLAVE1", "La contraseña debe tener al menos una minúscula"],
    ["sin número", "NuevaClave", "La contraseña debe tener al menos un número"],
  ])("política: %s", (_caso, nueva, mensaje) => {
    expect(errores({ password_nueva: nueva, confirmacion: nueva }).password_nueva).toContain(mensaje);
  });

  it("toma la longitud de password_longitud_minima", () => {
    expect(construirCambiarPasswordSchema(12).safeParse({ password_nueva: "NuevaClave1", confirmacion: "NuevaClave1" }).success).toBe(false);
  });

  it("un DNI no cumple la política de la contraseña nueva", () => {
    expect(errores({ password_nueva: "30111222", confirmacion: "30111222" }).password_nueva).toBeDefined();
  });

  it("confirmación distinta → error en confirmacion", () => {
    expect(errores({ password_nueva: "NuevaClave1", confirmacion: "NuevaClave2" }).confirmacion).toEqual(["Las contraseñas no coinciden"]);
  });

  it("una contraseña actual vacía cuenta como ausente", () => {
    const r = schema.safeParse({ password_actual: "", password_nueva: "NuevaClave1", confirmacion: "NuevaClave1" });
    expect(r.success && r.data.password_actual).toBeUndefined();
  });
});
