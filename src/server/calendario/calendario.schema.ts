import { z } from "zod";
import { VISTAS_CALENDARIO } from "@/lib/calendario-semana";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

// Query de GET /api/calendario/profesor/[profesorId] (HU-J-01) y
// GET /api/calendario/materia/[materiaId] (HU-J-02), con las vistas de
// HU-J-03 (spec_modulo_J.md §2.3). `fecha` es el día de referencia (por
// defecto, hoy en Buenos Aires). `semana_inicio` es el alias de HU-J-01/J-02:
// equivale a vista=semana&fecha=<valor>; si vienen los dos, gana `fecha`.
export const ConsultarCalendarioQuerySchema = z.object({
  vista: z.enum(VISTAS_CALENDARIO).default("semana"),
  fecha: fechaCalendarioValidaSchema.optional(),
  semana_inicio: fechaCalendarioValidaSchema.optional(),
});
export type ConsultarCalendarioQuery = z.infer<typeof ConsultarCalendarioQuerySchema>;
