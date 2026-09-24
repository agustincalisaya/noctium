import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";
import {
  ContactoSchema,
  campoOpcional,
  emailContactoSchema,
  telefonoContactoSchema,
  type ContactoInput,
} from "@/server/shared/contacto.schema";

const REGEX_NOMBRE = /^[\p{L}\s'-]+$/u;
const GENERO_VALUES = ["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_INDICARLO"] as const;

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
    genero: z.enum(GENERO_VALUES).optional(),
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

/**
 * Listado de alumnos (HU-B-04, spec_modulo_B.md §2.4) — mismo contrato que
 * `ListarMateriasQuerySchema` de Materias (HU-L-02).
 */
export const ListarAlumnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
export type ListarAlumnosQuery = z.infer<typeof ListarAlumnosQuerySchema>;

/**
 * Forma de pago preferida (HU-B-03, spec_modulo_B.md §2.3). `null` =
 * "Sin preferencia" — la conversión `"" -> null` del `<select>` HTML ocurre
 * en la capa delgada (action/route), antes de este `safeParse()`.
 *
 * `forma_pago_id` es `z.string().min(1)`, NO `.uuid()` como dice la spec
 * literal: los ids reales de `FormaPago` no son UUID (ver
 * `docs/tasks/Sprint 1/HU-B-03.md` sección 8 para el detalle completo de
 * esta desviación documentada).
 */
export const FormaPagoPreferidaSchema = z.object({
  forma_pago_id: z.string().min(1).nullable(),
});
export type FormaPagoPreferidaInput = z.infer<typeof FormaPagoPreferidaSchema>;

/**
 * Modificación de datos del alumno (HU-B-06, `spec_modulo_B.md` §2.5).
 * Factory por el mismo motivo que `crearIdentidadAlumnoSchema` (rango de
 * DNI configurable).
 *
 * Desvío respecto al contrato literal de la task/spec: NO se usa
 * `.merge(ContactoAlumnoSchema.partial())` — ver el docstring de
 * `campoOpcional()` en `contacto.schema.ts` para el porqué (Zod v4 lanza en
 * runtime `.partial()` sobre un objeto con `.superRefine()` propio). En su
 * lugar, `telefono`/`email` se agregan explícitamente con el mismo helper
 * que usa `ContactoSchema` internamente, sin la regla "al menos uno" (no
 * aplica a una edición parcial: se puede cambiar solo el DNI, por ejemplo,
 * sin tocar el contacto).
 *
 * `forma_pago_id`: mismo criterio que `FormaPagoPreferidaSchema` de arriba
 * (`z.string().min(1)`, no `.uuid()` — HU-B-03 §8).
 *
 * `genero`: se sobreescribe como `.nullable().optional()` (a diferencia del
 * `.optional()` de `crearIdentidadAlumnoSchema`) para poder distinguir "no
 * vino en el payload" (`undefined`, no se toca) de "vino explícitamente para
 * volver a 'sin especificar'" (`null`, se persiste como tal) — mismo
 * criterio de fondo que `telefono`/`email` arriba, pero con `null` explícito
 * en vez de `campoOpcional()` porque un `<select>` HTML sí puede mandar un
 * valor que la capa delgada convierte a `null` (igual que `forma_pago_id`),
 * mientras que `campoOpcional()` está pensado para inputs de texto vacíos.
 *
 * `version`: obligatorio, no opcional — es la condición de concurrencia
 * optimista (RULES.md Regla N.° 7), siempre necesaria para poder aplicar el
 * `updateMany`.
 */
export function construirModificarAlumnoSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return crearIdentidadAlumnoSchema(dniLongitudMin, dniLongitudMax)
    .partial()
    .extend({
      genero: z.enum(GENERO_VALUES).nullable().optional(),
      telefono: campoOpcional(telefonoContactoSchema),
      email: campoOpcional(emailContactoSchema),
      forma_pago_id: z.string().min(1).nullable().optional(),
      version: z.number().int().nonnegative(),
    })
    .strict();
}
export type ModificarAlumnoInput = z.infer<ReturnType<typeof construirModificarAlumnoSchema>>;
