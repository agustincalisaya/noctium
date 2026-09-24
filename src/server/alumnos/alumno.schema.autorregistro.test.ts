import { describe, expect, it } from "vitest";
import {
  construirAutorregistroAlumnoSchema,
  VerificarCodigoAutorregistroSchema,
  ReenviarCodigoAutorregistroSchema,
} from "./alumno.schema";

// Archivo separado de un futuro alumno.schema.test.ts general (no existe
// todavía) — cubre puntualmente los 3 schemas nuevos de HU-B-08. Nombre
// distinto de alumno.schema.test.ts a propósito, para no confundirlo si se
// agrega uno para el resto del archivo más adelante.

const schema = construirAutorregistroAlumnoSchema(7, 8, 8);

const base = {
  nombre: "Ana",
  apellido: "Pérez",
  dni: "30123456",
  fecha_nacimiento: "2000-01-01",
  email: "ana.perez@test.com",
  password: "Abcdefg1",
  confirmacion_password: "Abcdefg1",
  acepta_terminos: true,
};

describe("construirAutorregistroAlumnoSchema", () => {
  it("acepta un payload completo válido, con y sin teléfono (opcional)", () => {
    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, telefono: "1155551234" }).success).toBe(true);
  });

  it("rechaza sin mayúscula/minúscula/número (delegado a politicaPasswordSchema)", () => {
    expect(schema.safeParse({ ...base, password: "abcdefgh", confirmacion_password: "abcdefgh" }).success).toBe(false);
    expect(schema.safeParse({ ...base, password: "ABCDEFG1", confirmacion_password: "ABCDEFG1" }).success).toBe(false);
    expect(schema.safeParse({ ...base, password: "abcdefgA", confirmacion_password: "abcdefgA" }).success).toBe(false);
  });

  it("rechaza una contraseña más corta que passwordLongitudMinima", () => {
    expect(schema.safeParse({ ...base, password: "Ab1", confirmacion_password: "Ab1" }).success).toBe(false);
  });

  it("rechaza si la confirmación no coincide", () => {
    const resultado = schema.safeParse({ ...base, confirmacion_password: "Otra123X" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.some((i) => i.path.includes("confirmacion_password"))).toBe(true);
    }
  });

  it("rechaza si la contraseña contiene el email (case-insensitive)", () => {
    const resultado = schema.safeParse({
      ...base,
      password: "Ana.perezX1",
      confirmacion_password: "Ana.perezX1",
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.some((i) => i.path.includes("password"))).toBe(true);
    }
  });

  it("rechaza si la contraseña contiene el DNI", () => {
    const resultado = schema.safeParse({
      ...base,
      password: "Abc30123456",
      confirmacion_password: "Abc30123456",
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.some((i) => i.path.includes("password"))).toBe(true);
    }
  });

  it("rechaza si no se aceptan los términos (false u omitido)", () => {
    expect(schema.safeParse({ ...base, acepta_terminos: false }).success).toBe(false);
    const { acepta_terminos, ...sinTerminos } = base;
    void acepta_terminos;
    expect(schema.safeParse(sinTerminos).success).toBe(false);
  });

  it("rechaza claves desconocidas (.strict())", () => {
    expect(schema.safeParse({ ...base, campo_inventado: "x" }).success).toBe(false);
  });

  it("no crashea en runtime (regresión del bug de Zod v4 con .pick() sobre ContactoAlumnoSchema)", () => {
    expect(() => construirAutorregistroAlumnoSchema(7, 8, 8)).not.toThrow();
  });
});

describe("VerificarCodigoAutorregistroSchema", () => {
  it("acepta un cuid válido y código de 6 dígitos", () => {
    expect(
      VerificarCodigoAutorregistroSchema.safeParse({
        solicitud_id: "ckabc12345678901234567890",
        codigo: "123456",
      }).success,
    ).toBe(true);
  });

  it("rechaza un uuid en vez de cuid (desvío de spec ya documentado)", () => {
    expect(
      VerificarCodigoAutorregistroSchema.safeParse({
        solicitud_id: "550e8400-e29b-41d4-a716-446655440000",
        codigo: "123456",
      }).success,
    ).toBe(false);
  });

  it("rechaza un código que no sean exactamente 6 dígitos", () => {
    const solicitud_id = "ckabc12345678901234567890";
    expect(VerificarCodigoAutorregistroSchema.safeParse({ solicitud_id, codigo: "12345" }).success).toBe(false);
    expect(VerificarCodigoAutorregistroSchema.safeParse({ solicitud_id, codigo: "1234567" }).success).toBe(false);
    expect(VerificarCodigoAutorregistroSchema.safeParse({ solicitud_id, codigo: "12345a" }).success).toBe(false);
  });
});

describe("ReenviarCodigoAutorregistroSchema", () => {
  it("acepta solo solicitud_id, sin exigir codigo", () => {
    expect(
      ReenviarCodigoAutorregistroSchema.safeParse({ solicitud_id: "ckabc12345678901234567890" }).success,
    ).toBe(true);
  });

  it("no crashea en runtime (.pick() sobre un objeto sin refinements es seguro)", () => {
    expect(() => ReenviarCodigoAutorregistroSchema.safeParse({ solicitud_id: "x" })).not.toThrow();
  });
});
