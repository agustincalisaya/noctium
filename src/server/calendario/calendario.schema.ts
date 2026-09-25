import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

// Query de las vistas semanales del calendario (spec_modulo_J.md §2.1 y
// §2.2). `semana_inicio` puede ser cualquier día: el servicio lo normaliza
// al lunes. Sin `semana_inicio`, se usa la semana actual.
const ConsultarCalendarioSemanaQuerySchema = z.object({
  semana_inicio: fechaCalendarioValidaSchema.optional(),
});

// GET /api/calendario/profesor/[profesorId] (HU-J-01).
export const ConsultarCalendarioProfesorQuerySchema = ConsultarCalendarioSemanaQuerySchema;
export type ConsultarCalendarioProfesorQuery = z.infer<typeof ConsultarCalendarioProfesorQuerySchema>;

// GET /api/calendario/materia/[materiaId] (HU-J-02).
export const ConsultarCalendarioMateriaQuerySchema = ConsultarCalendarioSemanaQuerySchema;
export type ConsultarCalendarioMateriaQuery = z.infer<typeof ConsultarCalendarioMateriaQuerySchema>;
