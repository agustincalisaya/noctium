import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";
import {
  ContactoSchema,
  campoOpcional,
  emailContactoSchema,
  telefonoContactoSchema,
  type ContactoInput,
} from "@/server/shared/contacto.schema";
import { politicaPasswordSchema } from "@/server/shared/password.schema";

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

/**
 * Autorregistro del alumno (HU-B-08, `spec_modulo_B.md` §2.6). Factory por
 * el mismo motivo que `crearIdentidadAlumnoSchema`/`construirModificarAlumnoSchema`
 * — acá con DOS parámetros externos a resolver antes de armar el schema
 * (`dniLongitudMin`/`Max` de siempre, más `passwordLongitudMinima` para
 * `politicaPasswordSchema()`). El contrato literal de la task (§4.1) muestra
 * `AutorregistroAlumnoSchema` como `export const` fijo — no puede serlo:
 * necesita los tres valores resueltos en runtime desde `ParametroSistema`,
 * igual que ya pasa con el DNI en el resto de este archivo.
 *
 * Desvío técnico (mismo que ya documentado en HU-B-06 para
 * `construirModificarAlumnoSchema`): NO se usa
 * `ContactoAlumnoSchema.pick({ telefono: true })` como dice el contrato
 * literal — `ContactoAlumnoSchema` tiene un `.superRefine()` propio (la
 * regla "al menos uno"), y en Zod v4 `.pick()` sobre un objeto con `checks`
 * también lanza en runtime: `.pick() cannot be used on object schemas
 * containing refinements` (`node_modules/zod/v4/core/util.js:412-418`,
 * mismo mecanismo que ya rompía `.partial()`). En su lugar, `telefono` se
 * agrega directo con `campoOpcional(telefonoContactoSchema)` — el mismo
 * campo, sin pasar por el schema compuesto.
 *
 * `email` NO reutiliza `emailContactoSchema` (que lo trata como opcional
 * vía `campoOpcional`): acá es obligatorio, por eso se define suelto con la
 * regla exacta de la spec.
 *
 * `acepta_terminos`: el contrato literal usa `z.literal(true, { errorMap:
 * () => ({...}) })`, sintaxis de Zod v3. En Zod v4 el segundo parámetro de
 * `z.literal()` acepta un string directo como mensaje de error
 * (`node_modules/zod/v4/classic/schemas.d.ts:628`) — se usa esa forma.
 */
export function construirAutorregistroAlumnoSchema(
  dniLongitudMin: number,
  dniLongitudMax: number,
  passwordLongitudMinima: number,
) {
  return crearIdentidadAlumnoSchema(dniLongitudMin, dniLongitudMax)
    .extend({
      telefono: campoOpcional(telefonoContactoSchema),
      email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254),
      password: politicaPasswordSchema(passwordLongitudMinima),
      confirmacion_password: z.string(),
      acepta_terminos: z.literal(true, "Debés aceptar los términos de uso y tratamiento de datos"),
    })
    .strict()
    .refine((d) => d.password === d.confirmacion_password, {
      message: "Las contraseñas no coinciden",
      path: ["confirmacion_password"],
    })
    .refine((d) => !d.password.toLowerCase().includes(d.email.split("@")[0].toLowerCase()), {
      message: "La contraseña no puede contener tu email",
      path: ["password"],
    })
    .refine((d) => !d.password.includes(d.dni), {
      message: "La contraseña no puede contener tu DNI",
      path: ["password"],
    });
}
export type AutorregistroAlumnoInput = z.infer<ReturnType<typeof construirAutorregistroAlumnoSchema>>;

/**
 * Verificación del código de autorregistro (HU-B-08, rama b). `solicitud_id`
 * es `z.string().cuid()`, no `.uuid()` como decía la spec literal — mismo
 * desvío ya documentado para `forma_pago_id` (HU-B-03) y para los ids del
 * resto del schema real (`@default(cuid())`, nunca `@default(uuid())`).
 */
export const VerificarCodigoAutorregistroSchema = z.object({
  solicitud_id: z.string().cuid(),
  codigo: z.string().length(6).regex(/^\d{6}$/),
});
export type VerificarCodigoAutorregistroInput = z.infer<typeof VerificarCodigoAutorregistroSchema>;

/**
 * Reenvío de código (HU-B-08 §4.4) — mismo `solicitud_id` que
 * `VerificarCodigoAutorregistroSchema`, sin el código (todavía no hay uno
 * nuevo). `.pick()` es seguro acá: a diferencia de `ContactoAlumnoSchema`,
 * `VerificarCodigoAutorregistroSchema` es un objeto plano sin
 * `.superRefine()`/`.refine()` propio, así que no dispara el bug de Zod v4
 * ya documentado arriba.
 */
export const ReenviarCodigoAutorregistroSchema = VerificarCodigoAutorregistroSchema.pick({
  solicitud_id: true,
});
export type ReenviarCodigoAutorregistroInput = z.infer<typeof ReenviarCodigoAutorregistroSchema>;
