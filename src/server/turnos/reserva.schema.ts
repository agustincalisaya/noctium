import { z } from "zod";

/**
 * Query de la pestaña «Pendientes» de Reservas (HU-C-26, spec_modulo_C.md
 * §2.20.2). De a 10, fijo: `por_pagina` u otro parámetro ajeno es 400
 * (`.strict()`). `alumno` filtra desde 2 caracteres con el criterio de HU-B-05,
 * que ya resuelve la lectura.
 */
export const ReservasPendientesQuerySchema = z.object({
  alumno: z.string().trim().max(100).optional(),
  materia_id: z.string().cuid().optional(),
  vencen: z.enum(["en_3_horas", "hoy", "manana"]).optional(),
  pagina: z.coerce.number().int().positive().default(1),
}).strict();
export type ReservasPendientesQuery = z.infer<typeof ReservasPendientesQuerySchema>;

/** Query de la pestaña «Vencidas · últimos 7 días» (§2.20.3): sin `vencen`. */
export const ReservasVencidasQuerySchema = z.object({
  alumno: z.string().trim().max(100).optional(),
  materia_id: z.string().cuid().optional(),
  pagina: z.coerce.number().int().positive().default(1),
}).strict();
export type ReservasVencidasQuery = z.infer<typeof ReservasVencidasQuerySchema>;

/** Contrato HTTP (snake_case) → filtros de las lecturas de C (camelCase). */
export function filtrosReservas<T extends { alumno?: string; materia_id?: string; pagina: number }>(query: T) {
  const { materia_id: materiaId, ...resto } = query;
  return { ...resto, ...(materiaId ? { materiaId } : {}) };
}
