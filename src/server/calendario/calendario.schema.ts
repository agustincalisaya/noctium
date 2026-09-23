import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

// Query de GET /api/calendario/profesor/[profesorId] (spec_modulo_J.md §2.1).
// `semana_inicio` puede ser cualquier día: el servicio lo normaliza al lunes.
// Sin `semana_inicio`, se usa la semana actual.
export const ConsultarCalendarioProfesorQuerySchema = z.object({
  semana_inicio: fechaCalendarioValidaSchema.optional(),
});
export type ConsultarCalendarioProfesorQuery = z.infer<typeof ConsultarCalendarioProfesorQuerySchema>;
