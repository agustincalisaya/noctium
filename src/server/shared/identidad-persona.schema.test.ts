import { describe, expect, it } from "vitest";
import { flattenError } from "zod";
import { GENERO_VALORES, construirIdentidadPersonaSchema } from "@/server/shared/identidad-persona.schema";

// construirIdentidadPersonaSchema (spec_modulo_F.md §1, HU-F-01 c2): las
// validaciones de HU-D-01 sin el contacto ni la mayoría de edad, con los
// mensajes de ui.comun.identidad.* (decisiones 2 y 3 de la task).

const schema = construirIdentidadPersonaSchema(7, 8);
const VALIDA = { nombre: "Lucía", apellido: "Fernández", dni: "30123456", fechaNacimiento: "1990-04-12" };

function errores(datos: unknown) {
  const r = schema.safeParse(datos);
  if (r.success) throw new Error("Se esperaba un error");
  return flattenError(r.error).fieldErrors as Record<string, string[] | undefined>;
}

function isoUTC(desplazamientoDias: number): string {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + desplazamientoDias)).toISOString().slice(0, 10);
}

describe("construirIdentidadPersonaSchema", () => {
  it("acepta una identidad válida: espacios colapsados, fecha como Date UTC y género opcional", () => {
    const r = schema.parse({ ...VALIDA, nombre: "  María   José ", apellido: "O'Connor-Díaz", dni: " 3012345 " });
    expect(r).toEqual({
      nombre: "María José",
      apellido: "O'Connor-Díaz",
      dni: "3012345",
      fechaNacimiento: new Date(Date.UTC(1990, 3, 12)),
    });
    expect(schema.parse({ ...VALIDA, genero: "PREFIERO_NO_INDICARLO" }).genero).toBe("PREFIERO_NO_INDICARLO");
  });

  it("nombre y apellido: obligatorios, de 2 a 50 caracteres y solo letras, espacios, acentos, apóstrofes y guiones", () => {
    expect(errores({ ...VALIDA, nombre: undefined }).nombre).toEqual(["Ingresá el nombre"]);
    expect(errores({ ...VALIDA, nombre: "   " }).nombre).toEqual(["Ingresá el nombre"]);
    expect(errores({ ...VALIDA, nombre: "L" }).nombre).toEqual(["El nombre debe tener al menos 2 caracteres"]);
    expect(errores({ ...VALIDA, apellido: "a".repeat(51) }).apellido).toEqual(["El apellido no puede superar los 50 caracteres"]);
    expect(errores({ ...VALIDA, apellido: "Pérez2" }).apellido).toEqual([
      "El apellido solo admite letras, espacios, acentos, apóstrofes y guiones",
    ]);
    expect(schema.parse({ ...VALIDA, apellido: "a".repeat(50) }).apellido).toHaveLength(50);
  });

  it("DNI: obligatorio, solo números y con la longitud configurada", () => {
    expect(errores({ ...VALIDA, dni: "" }).dni).toEqual(["Ingresá el DNI"]);
    expect(errores({ ...VALIDA, dni: "30.123.456" }).dni).toContain("Ingresá el DNI solo con números");
    expect(errores({ ...VALIDA, dni: "123456" }).dni).toEqual(["El DNI debe tener entre 7 y 8 dígitos"]);
    expect(errores({ ...VALIDA, dni: "123456789" }).dni).toEqual(["El DNI debe tener entre 7 y 8 dígitos"]);
    expect(construirIdentidadPersonaSchema(8, 8).safeParse({ ...VALIDA, dni: "1234567" }).success).toBe(false);
  });

  it("fecha de nacimiento: obligatoria, real y no futura; hoy vale y no exige mayoría de edad", () => {
    expect(errores({ ...VALIDA, fechaNacimiento: undefined }).fechaNacimiento).toEqual(["Ingresá la fecha de nacimiento"]);
    expect(errores({ ...VALIDA, fechaNacimiento: "" }).fechaNacimiento).toEqual(["Ingresá la fecha de nacimiento"]);
    expect(errores({ ...VALIDA, fechaNacimiento: "2001-02-31" }).fechaNacimiento).toEqual(["Ingresá una fecha válida"]);
    expect(errores({ ...VALIDA, fechaNacimiento: isoUTC(1) }).fechaNacimiento).toEqual(["La fecha de nacimiento no puede ser futura"]);
    expect(schema.safeParse({ ...VALIDA, fechaNacimiento: isoUTC(0) }).success).toBe(true);
    expect(schema.safeParse({ ...VALIDA, fechaNacimiento: isoUTC(-365) }).success).toBe(true);
  });

  it("género: solo los valores del enum", () => {
    expect(GENERO_VALORES).toEqual(["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_INDICARLO"]);
    expect(errores({ ...VALIDA, genero: "X" }).genero).toEqual(["Elegí un género de la lista"]);
  });
});
