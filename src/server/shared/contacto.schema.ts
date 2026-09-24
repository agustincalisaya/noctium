import { z } from "zod";
import { contarDigitosTelefono, normalizarTelefono } from "@/server/shared/contacto";

// Dígitos, espacios, guiones y paréntesis; el `+` solo como primer carácter.
const TELEFONO_CARACTERES_REGEX = /^\+?[\d\s\-()]+$/;
const TELEFONO_DIGITOS_MIN = 8;
const TELEFONO_DIGITOS_MAX = 15;
const EMAIL_LONGITUD_MAX = 254;

export const MENSAJE_CONTACTO_REQUERIDO = "Ingresá al menos un teléfono o un email de contacto";

/**
 * Teléfono de contacto (HU-B-02 c2 / HU-D-02 c2): valida los caracteres
 * permitidos sobre el valor tipeado y después normaliza con
 * `normalizarTelefono()` — el valor que sale del schema es el que se guarda.
 */
export const telefonoContactoSchema = z
  .string()
  .trim()
  .regex(
    TELEFONO_CARACTERES_REGEX,
    "El teléfono solo admite dígitos, +, espacios, guiones y paréntesis",
  )
  .transform(normalizarTelefono)
  .refine(
    (valor) => {
      const digitos = contarDigitosTelefono(valor);
      return digitos >= TELEFONO_DIGITOS_MIN && digitos <= TELEFONO_DIGITOS_MAX;
    },
    `El teléfono debe tener entre ${TELEFONO_DIGITOS_MIN} y ${TELEFONO_DIGITOS_MAX} dígitos`,
  );

/** Email de contacto (HU-B-02 c3 / HU-D-02 c3): trim + minúsculas, máx. 254. */
export const emailContactoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email("Ingresá un email válido")
      .max(EMAIL_LONGITUD_MAX, `El email no puede superar los ${EMAIL_LONGITUD_MAX} caracteres`),
  );

/**
 * Un campo vacío, con solo espacios o ausente del `FormData` (`null`) se
 * trata como "no provisto" — nunca como un valor inválido.
 *
 * Exportado (HU-B-06): `construirModificarAlumnoSchema()` lo reutiliza para
 * `telefono`/`email` sin pasar por `ContactoSchema.partial()` — en Zod v4,
 * `.partial()` sobre un objeto con `.superRefine()` propio (como
 * `ContactoSchema`, la regla "al menos uno") lanza en runtime
 * (`node_modules/zod/v4/core/util.js`, `.partial() cannot be used on object
 * schemas containing refinements`). Esa regla de "al menos uno" tampoco
 * aplica a una edición parcial, así que no hace falta preservarla.
 */
export function campoOpcional<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (valor) => (valor == null || (typeof valor === "string" && valor.trim() === "") ? undefined : valor),
    schema.optional(),
  );
}

/**
 * Datos de contacto compartidos por Alumno (HU-B-02) y Profesor (HU-D-02):
 * mismas reglas en ambos módulos, un único schema usado tanto en el
 * formulario (cliente) como en la Server Action (servidor). El error de
 * "al menos uno" se asocia a `telefono`, el primer campo del formulario.
 */
export const ContactoSchema = z
  .object({
    telefono: campoOpcional(telefonoContactoSchema),
    email: campoOpcional(emailContactoSchema),
  })
  .superRefine((datos, ctx) => {
    if (datos.telefono === undefined && datos.email === undefined) {
      ctx.addIssue({ code: "custom", message: MENSAJE_CONTACTO_REQUERIDO, path: ["telefono"] });
    }
  });

export type ContactoInput = z.infer<typeof ContactoSchema>;
