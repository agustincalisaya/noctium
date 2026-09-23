import { z } from "zod";

export const CrearMateriaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre no puede superar los 80 caracteres")
    .transform((v) => v.replace(/\s+/g, " ")),
  // Regex con `*` (no `+`) para que un string vacío también matchee y
  // pueda transformarse a `undefined` acá abajo — un <input> de HTML
  // siempre manda "" cuando el campo opcional queda vacío, nunca omite
  // la key, así que hay que tratar "" como "no vino código".
  codigo: z
    .string()
    .trim()
    .max(10, "El código no puede superar los 10 caracteres")
    .regex(/^[A-Za-z0-9]*$/, "El código admite solo letras y números, sin espacios")
    .transform((v) => (v === "" ? undefined : v.toUpperCase()))
    .optional(),
});
export type CrearMateriaInput = z.infer<typeof CrearMateriaSchema>;
