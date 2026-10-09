import { z } from "zod";

const TextoLibre1000 = z.string().trim().max(1000, "Máximo 1000 caracteres");

export const RegistrarObservacionClaseSchema = z.object({
  temas_vistos: TextoLibre1000.min(1, "Este campo es obligatorio"),
  observaciones_internas: TextoLibre1000.optional(),
}).strict();

export type RegistrarObservacionClaseInput = z.infer<typeof RegistrarObservacionClaseSchema>;
