import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha";
export const RESULTADOS_CLASE_ALUMNO = ["PROXIMA", "ASISTIO", "AUSENTE", "SIN_REGISTRAR_COMO_DICTADA", "CANCELADA_CENTRO", "CANCELADA_ALUMNO", "RESERVA_VENCIDA", "BAJA_ALUMNO", "QUITADA_CENTRO"] as const;
export const ClasesAlumnoQuerySchema = z.object({
  resultado: z.enum(RESULTADOS_CLASE_ALUMNO).optional(),
  desde: fechaCalendarioValidaSchema.optional(), hasta: fechaCalendarioValidaSchema.optional(),
  pagina: z.coerce.number().int().positive().default(1), por_pagina: z.coerce.number().int().positive().max(10).default(10),
}).strict().refine(q => !q.desde || !q.hasta || q.desde <= q.hasta, { message: "«Desde» no puede ser posterior a «Hasta»", path: ["desde"] });
export type ClasesAlumnoQuery = z.infer<typeof ClasesAlumnoQuerySchema>;
