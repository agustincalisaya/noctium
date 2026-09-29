import { z } from "zod";

export const CrearAulaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre o número del aula es obligatorio")
    .max(30, "El nombre no puede superar los 30 caracteres")
    .transform((v) => v.replace(/\s+/g, " ")),
  capacidad: z.coerce
    .number()
    .int("La capacidad debe ser un número entero")
    .positive("La capacidad debe ser mayor a cero"),
});
export type CrearAulaInput = z.infer<typeof CrearAulaSchema>;

export const ListarAulasQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
export type ListarAulasQuery = z.infer<typeof ListarAulasQuerySchema>;

/**
 * Modificación de aula (spec_modulo_K.md §2.4, HU-K-03): mismas reglas que
 * el alta (criterio 1). Campo ausente = no se modifica; `version` es
 * obligatoria (concurrencia optimista) y `.strict()` rechaza `is_active`
 * (desactivar es HU-K-04) y cualquier otro campo.
 */
export const ModificarAulaSchema = CrearAulaSchema.partial()
  .extend({
    version: z.number().int().nonnegative(),
  })
  .strict();
export type ModificarAulaInput = z.infer<typeof ModificarAulaSchema>;
