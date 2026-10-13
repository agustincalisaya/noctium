import { z } from "zod";

export const RegistrarIndicacionSchema = z.object({
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  indicacion: z.string().trim().min(1, "La indicación es obligatoria").max(1000, "Máximo 1000 caracteres"),
  contexto_origen: z.string().min(1).max(4096).optional(),
  clase_dictada_id: z.string().trim().min(1).optional(),
}).strict();

export type RegistrarIndicacionInput = z.infer<typeof RegistrarIndicacionSchema>;
