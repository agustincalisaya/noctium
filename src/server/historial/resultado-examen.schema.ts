import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

export const RegistrarResultadoExamenSchema = z.object({
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  fecha_examen: fechaCalendarioValidaSchema,
  nota: z.string().trim().regex(/^\d{1,3}(\.\d)?$/, "La nota debe ser un número con hasta 1 decimal"),
  observaciones: z.string().trim().optional(),
}).strict();

export type RegistrarResultadoExamenInput = z.infer<typeof RegistrarResultadoExamenSchema>;
