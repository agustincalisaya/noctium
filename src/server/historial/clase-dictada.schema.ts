import { z } from "zod";

export const EstadoAsistenciaSchema = z.enum(["PRESENTE", "AUSENTE"]);
export const RegistrarClaseDictadaSchema = z.object({
  asistencias: z.array(z.object({
    alumno_id: z.string().trim().min(1),
    estado: EstadoAsistenciaSchema,
  }).strict()).max(500),
}).strict();
export type RegistrarClaseDictadaInput = z.infer<typeof RegistrarClaseDictadaSchema>;
