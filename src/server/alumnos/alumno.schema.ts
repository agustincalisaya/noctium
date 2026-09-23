import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";
import { ContactoSchema, type ContactoInput } from "@/server/shared/contacto.schema";

const REGEX_NOMBRE = /^[\p{L}\s'-]+$/u;

/**
 * Factory en vez de `const` fijo: la longitud del DNI no es un valor
 * hardcodeado (`DNI_LONGITUD` único, como sugería una versión previa de la
 * spec) sino un rango configurable en `ParametroSistema`
 * (`dni_longitud_min` / `dni_longitud_max`, ver seed). El Route
 * Handler/Server Action resuelve esos valores primero y arma el schema con
 * ellos — sigue siendo `schema.safeParse()` puro (Regla N.° 6 de
 * docs/RULES.md), no una validación async por fuera de Zod.
 */
export function crearIdentidadAlumnoSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return z.object({
    nombre: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(50, "El nombre no puede superar los 50 caracteres")
      .regex(REGEX_NOMBRE, "El nombre solo admite letras, espacios, acentos, apóstrofes y guiones")
      .transform((v) => v.replace(/\s+/g, " ")),
    apellido: z
      .string()
      .trim()
      .min(2, "El apellido debe tener al menos 2 caracteres")
      .max(50, "El apellido no puede superar los 50 caracteres")
      .regex(REGEX_NOMBRE, "El apellido solo admite letras, espacios, acentos, apóstrofes y guiones")
      .transform((v) => v.replace(/\s+/g, " ")),
    dni: z
      .string()
      .trim()
      .regex(/^\d+$/, "Ingresá el DNI solo con números")
      .min(dniLongitudMin, `El DNI debe tener entre ${dniLongitudMin} y ${dniLongitudMax} dígitos`)
      .max(dniLongitudMax, `El DNI debe tener entre ${dniLongitudMin} y ${dniLongitudMax} dígitos`),
    fecha_nacimiento: fechaCalendarioValidaSchema.refine(
      (d) => d <= new Date(),
      "La fecha de nacimiento no puede ser futura",
    ),
    genero: z.enum(["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_INDICARLO"]).optional(),
  });
}
export type IdentidadAlumnoInput = z.infer<ReturnType<typeof crearIdentidadAlumnoSchema>>;

/**
 * Contacto del alumno (HU-B-02): mismas reglas que el contacto de Profesor
 * (HU-D-02), así que se reutiliza el schema compartido en vez de
 * duplicarlo — utilidad de validación transversal, no acoplamiento de
 * dominio (spec_modulo_B.md §2.2, "mismo requisito en spec_modulo_D.md §2.2").
 */
export const ContactoAlumnoSchema = ContactoSchema;
export type ContactoAlumnoInput = ContactoInput;
