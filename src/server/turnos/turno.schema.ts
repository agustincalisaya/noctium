import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

export const ListarTurnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).optional(),
});

// Revisión 4 (§2.1): duraciones que Mesa de Entradas puede elegir. Cambiar el
// conjunto requiere nueva aprobación del PO: es constante, no ParametroSistema.
export const DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180] as const;
export function esDuracionPermitida(valor: number) { return (DURACIONES_PERMITIDAS_TURNO_MIN as readonly number[]).includes(valor); }

export const ConfigurarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema,
  hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ingresá una hora válida (HH:MM)"),
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  // Sin cupo_maximo (Revisión 3): se fija con la capacidad del aula (§2.3).
  // Revisión 4: obligatorio, sin default. Número JSON (no se coerciona un string).
  duracion_min: z.number({ error: "Elegí la duración del turno" }).int("Elegí una duración válida (1, 2 o 3 horas)").refine(esDuracionPermitida, "Elegí una duración válida (1, 2 o 3 horas)"),
});

export type ConfigurarTurnoInput = z.infer<typeof ConfigurarTurnoSchema>;

export const AsignarParticipantesTurnoSchema = z.object({
  alumno_ids: z.array(z.cuid())
    .min(1, "Agregá al menos un alumno")
    .refine((ids) => new Set(ids).size === ids.length, "El mismo alumno no puede agregarse dos veces"),
  profesor_id: z.cuid(),
});
export type AsignarParticipantesTurnoInput = z.infer<typeof AsignarParticipantesTurnoSchema>;

export const AgregarAlumnoTurnoSchema = z.object({
  alumno_id: z.cuid(),
});
export type AgregarAlumnoTurnoInput = z.infer<typeof AgregarAlumnoTurnoSchema>;

export const AsignarAulaTurnoSchema = z.object({ aula_id: z.cuid() });
export type AsignarAulaTurnoInput = z.infer<typeof AsignarAulaTurnoSchema>;
