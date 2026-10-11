import { z } from "zod";
import { texto } from "@/lib/textos";
import { campoOpcional, emailContactoSchema, telefonoContactoSchema } from "@/server/shared/contacto.schema";
import { GENERO_VALORES, construirIdentidadPersonaSchema } from "@/server/shared/identidad-persona.schema";

/**
 * Schemas del personal de mesa de entrada (spec_modulo_F.md §2.1 y §2.2,
 * HU-F-01). Los mismos en el formulario, la Server Action y el Route Handler:
 * se construyen con la longitud del DNI de `ParametroSistema`.
 */

/**
 * Email obligatorio: es el usuario de la cuenta de acceso (HU-A-06 c1). Vacío,
 * con solo espacios, ausente o `null` responde el mensaje del backlog («Ingresá
 * el email: con él se crea la cuenta de acceso»); con valor, las reglas del
 * contacto (minúsculas, formato válido, hasta 254 caracteres).
 */
function emailObligatorioSchema() {
  const requerido = texto("ui.personal.contacto.emailRequerido");
  return z.preprocess(
    (valor) => (valor == null ? "" : valor),
    z.string({ error: requerido }).trim().min(1, requerido).pipe(emailContactoSchema),
  );
}

/**
 * Alta (spec_modulo_F.md §2.1): identidad + email obligatorio + teléfono
 * opcional (vacío = sin teléfono). `.strict()` rechaza `activo`, `usuarioId`,
 * el rol y cualquier campo ajeno: el rol de la cuenta lo fija el servicio.
 */
export function construirAltaIntegranteSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return construirIdentidadPersonaSchema(dniLongitudMin, dniLongitudMax)
    .extend({
      email: emailObligatorioSchema(),
      telefono: campoOpcional(telefonoContactoSchema),
    })
    .strict();
}

export type AltaIntegranteInput = z.infer<ReturnType<typeof construirAltaIntegranteSchema>>;

/**
 * Modificación (spec_modulo_F.md §2.2): campo ausente = no se toca.
 * - `genero: null` vuelve a «Sin especificar» (como profesor; la spec usa
 *   `.partial()`, que no lo permite: diferencia anotada).
 * - `email` no se puede vaciar: es el de la cuenta.
 * - `telefono: null` lo quita; la cadena vacía se rechaza (la UI manda `null`).
 * - `version` es obligatoria (Regla N.° 7).
 */
export function construirModificarIntegranteSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return construirIdentidadPersonaSchema(dniLongitudMin, dniLongitudMax)
    .partial()
    .extend({
      genero: z.enum(GENERO_VALORES, { error: texto("ui.comun.identidad.generoInvalido") }).nullable().optional(),
      email: emailObligatorioSchema().optional(),
      telefono: telefonoContactoSchema.nullable().optional(),
      version: z.number().int().nonnegative(),
    })
    .strict();
}

export type ModificarIntegranteInput = z.infer<ReturnType<typeof construirModificarIntegranteSchema>>;

/** Integrantes por página del listado (HU-F-03 c1): fijo, no es parámetro. */
export const POR_PAGINA_PERSONAL = 10;

/**
 * Query de `GET /api/personal` (spec_modulo_F.md §2.3, HU-F-03). `q` de menos
 * de 2 caracteres no es un error: el servicio la ignora. `.strict()`: a
 * diferencia de `/api/alumnos`, `por_pagina` no se acepta (400).
 */
export const ListarPersonalQuerySchema = z
  .object({
    pagina: z.coerce.number().int().positive().default(1),
    q: z.string().trim().max(100).optional(),
  })
  .strict();

export type ListarPersonalQuery = z.infer<typeof ListarPersonalQuerySchema>;

/**
 * Baja (spec_modulo_F.md §2.5, HU-F-05), con la forma de la de profesor. El
 * motivo se recorta y vacío equivale a no enviado; si es obligatorio lo decide
 * el servicio (DEC-39). `.strict()` rechaza `activo`, `usuarioId` y cualquier
 * campo ajeno.
 */
export const DesactivarIntegranteSchema = z
  .object({
    motivo: z
      .string()
      .trim()
      .max(300, texto("errores.personal.motivoDemasiadoLargo"))
      .transform((motivo) => motivo || undefined)
      .optional(),
    version: z.number().int().nonnegative(),
  })
  .strict();

export type DesactivarIntegranteInput = z.infer<typeof DesactivarIntegranteSchema>;

/** Reactivación (spec_modulo_F.md §2.6): solo la `version`; no pide motivo. */
export const ReactivarIntegranteSchema = z.object({ version: z.number().int().nonnegative() }).strict();

export type ReactivarIntegranteInput = z.infer<typeof ReactivarIntegranteSchema>;
