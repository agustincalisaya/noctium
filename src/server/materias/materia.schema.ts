import { z } from "zod";

const nombreMateria = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(80, "El nombre no puede superar los 80 caracteres")
  .transform((v) => v.replace(/\s+/g, " "));

// Regex con `*` (no `+`) para que un string vacío también matchee y pueda
// transformarse acá abajo — un <input> de HTML siempre manda "" cuando el
// campo opcional queda vacío, nunca omite la key.
const codigoMateria = z
  .string()
  .trim()
  .max(10, "El código no puede superar los 10 caracteres")
  .regex(/^[A-Za-z0-9]*$/, "El código admite solo letras y números, sin espacios");

export const CrearMateriaSchema = z.object({
  nombre: nombreMateria,
  // En el alta, "" significa "no vino código".
  codigo: codigoMateria.transform((v) => (v === "" ? undefined : v.toUpperCase())).optional(),
});
export type CrearMateriaInput = z.infer<typeof CrearMateriaSchema>;

/**
 * Modificación (spec_modulo_L.md §2.4, HU-L-03): mismas reglas y
 * normalización que el alta. Semántica de PATCH: campo ausente = no se
 * modifica; `codigo` en `null` o "" = se quita (el alta permite materias sin
 * código). `.strict()` rechaza `is_active` y cualquier campo de duración
 * (criterio 5). `version` es obligatoria: concurrencia optimista (§3.5).
 */
export const ModificarMateriaSchema = z
  .object({
    nombre: nombreMateria.optional(),
    codigo: codigoMateria
      .transform((v) => (v === "" ? null : v.toUpperCase()))
      .nullable()
      .optional(),
    version: z.number().int().nonnegative(),
  })
  .strict();
export type ModificarMateriaInput = z.infer<typeof ModificarMateriaSchema>;

export const ListarMateriasQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
export type ListarMateriasQuery = z.infer<typeof ListarMateriasQuerySchema>;
