import { z } from "zod";

export const HistorialQuerySchema = z.object({
  materia_id: z.string().trim().min(1).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(10).default(10),
}).strict();

export type HistorialQuery = z.infer<typeof HistorialQuerySchema>;
