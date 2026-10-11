import { describe, expect, it } from "vitest";
import {
  CredencialesLoginSchema,
  SolicitarRecuperacionSchema,
  construirCambiarPasswordSchema,
  construirRestablecerPasswordSchema,
} from "@/server/sesion/sesion.schema";

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

// HU-A-05 (spec_modulo_A.md §2.7.1 y §2.7.3).

describe("SolicitarRecuperacionSchema", () => {
  const MENSAJE = "Ingresá un email válido, por ejemplo nombre@dominio.com.";
  const errorEmail = (email: unknown) => {
    const r = SolicitarRecuperacionSchema.safeParse({ email });
    return r.success ? undefined : r.error.flatten().fieldErrors.email;
  };

  it("normaliza: sin espacios y en minúsculas", () => {
    expect(SolicitarRecuperacionSchema.safeParse({ email: "  Ana@Noctium.Local " })).toMatchObject({
      success: true,
      data: { email: "ana@noctium.local" },
    });
  });

  it.each(["", "ana", "ana@", "@noctium.local", "ana noctium.local"])("formato inválido «%s» → mensaje de la pantalla", (email) => {
    expect(errorEmail(email)).toContain(MENSAJE);
  });

  it("hasta 254 caracteres", () => {
    const dominio = `${["b", "c", "d", "e"].map((letra) => letra.repeat(60)).join(".")}.com`; // 247 caracteres
    const limite = `${"a".repeat(6)}@${dominio}`;
    expect(limite).toHaveLength(254);
    expect(errorEmail(limite)).toBeUndefined();
    expect(errorEmail(`a${limite}`)).toContain(MENSAJE);
  });

  it("sin email → rechazo", () => {
    expect(SolicitarRecuperacionSchema.safeParse({}).success).toBe(false);
  });
});

describe("construirRestablecerPasswordSchema", () => {
  const TOKEN = "x".repeat(43);
  const schema = construirRestablecerPasswordSchema(8);
  const errores = (datos: Record<string, unknown>) => {
    const r = schema.safeParse({ token: TOKEN, ...datos });
    return r.success ? {} : r.error.flatten().fieldErrors;
  };

  it("acepta un token y una contraseña que cumple la política", () => {
    expect(schema.safeParse({ token: TOKEN, password_nueva: "NuevaClave1", confirmacion: "NuevaClave1" }).success).toBe(true);
  });

  it.each([
    ["corto", "x".repeat(19)],
    ["largo", "x".repeat(201)],
  ])("token %s → error en token", (_caso, token) => {
    expect(errores({ token, password_nueva: "NuevaClave1", confirmacion: "NuevaClave1" }).token).toBeDefined();
  });

  it.each([20, 200])("token de %i caracteres → válido", (largo) => {
    expect(errores({ token: "x".repeat(largo), password_nueva: "NuevaClave1", confirmacion: "NuevaClave1" })).toEqual({});
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
    expect(
      construirRestablecerPasswordSchema(12).safeParse({ token: TOKEN, password_nueva: "NuevaClave1", confirmacion: "NuevaClave1" }).success,
    ).toBe(false);
  });

  it("confirmación distinta → error en confirmacion", () => {
    expect(errores({ password_nueva: "NuevaClave1", confirmacion: "NuevaClave2" }).confirmacion).toEqual(["Las contraseñas no coinciden"]);
  });
});
