import { z } from "zod";
import { texto } from "@/lib/textos";
import { campoOpcional, emailContactoSchema, telefonoContactoSchema } from "@/server/shared/contacto.schema";
import { GENERO_VALORES, construirIdentidadPersonaSchema } from "@/server/shared/identidad-persona.schema";

/**
 * Schemas de los gerentes (spec_modulo_G.md §2.1 y §2.2, HU-G-01). Mismo
 * diseño que los del personal de mesa de entrada (HU-F-01): los mismos en el
 * formulario, la Server Action y el Route Handler, construidos con la longitud
 * del DNI de `ParametroSistema`.
 */

/**
 * Email obligatorio: es el usuario de la cuenta de acceso (HU-A-06 c1). Vacío,
 * con solo espacios, ausente o `null` responde el mensaje del backlog («Ingresá
 * el email: con él se crea la cuenta de acceso»); con valor, las reglas del
 * contacto (minúsculas, formato válido, hasta 254 caracteres).
 */
function emailObligatorioSchema() {
  const requerido = texto("ui.gerentes.contacto.emailRequerido");
  return z.preprocess(
    (valor) => (valor == null ? "" : valor),
    z.string({ error: requerido }).trim().min(1, requerido).pipe(emailContactoSchema),
  );
}

/**
 * Alta (spec_modulo_G.md §2.1): identidad + email obligatorio + teléfono
 * opcional (vacío = sin teléfono). `.strict()` rechaza `activo`, `usuarioId`,
 * el rol y cualquier campo ajeno: el rol de la cuenta lo fija el servicio.
 */
export function construirAltaGerenteSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return construirIdentidadPersonaSchema(dniLongitudMin, dniLongitudMax)
    .extend({
      email: emailObligatorioSchema(),
      telefono: campoOpcional(telefonoContactoSchema),
    })
    .strict();
}

export type AltaGerenteInput = z.infer<ReturnType<typeof construirAltaGerenteSchema>>;

/**
 * Modificación (spec_modulo_G.md §2.2): campo ausente = no se toca.
 * - `genero: null` vuelve a «Sin especificar» (como F; la spec usa
 *   `.partial()`, que no lo permite: diferencia anotada).
 * - `email` no se puede vaciar: es el de la cuenta.
 * - `telefono: null` lo quita; la cadena vacía se rechaza (la UI manda `null`).
 * - `version` es obligatoria (Regla N.° 7).
 */
export function construirModificarGerenteSchema(dniLongitudMin: number, dniLongitudMax: number) {
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

export type ModificarGerenteInput = z.infer<ReturnType<typeof construirModificarGerenteSchema>>;
