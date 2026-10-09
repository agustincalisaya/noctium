import { z } from "zod";

export const EstadoAsistenciaSchema = z.enum(["PRESENTE", "AUSENTE"]);
export const RegistrarClaseDictadaSchema = z.object({
  asistencias: z.array(z.object({
    alumno_id: z.string().trim().min(1),
    estado: EstadoAsistenciaSchema,
  }).strict()).max(500),
}).strict();
export const CorregirAsistenciaSchema = RegistrarClaseDictadaSchema.extend({
  motivo: z.string().trim().min(1, "El motivo es obligatorio").max(300, "Máximo 300 caracteres"),
}).strict();
export const AnularClaseDictadaSchema = z.object({
  motivo: z.string().trim().min(1, "El motivo es obligatorio").max(300, "Máximo 300 caracteres"),
}).strict();
export type CorregirAsistenciaInput = z.infer<typeof CorregirAsistenciaSchema>;
export type RegistrarClaseDictadaInput = z.infer<typeof RegistrarClaseDictadaSchema>;
