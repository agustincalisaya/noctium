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
