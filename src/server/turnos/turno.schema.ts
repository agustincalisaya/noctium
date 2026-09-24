import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

export const ListarTurnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).optional(),
});

export const ConfigurarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema,
  hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ingresá una hora válida (HH:MM)"),
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  cupo_maximo: z
    .number({ error: "Ingresá el cupo máximo" })
    .int("El cupo máximo debe ser un número entero mayor que cero")
    .positive("El cupo máximo debe ser un número entero mayor que cero")
    // Tope de la columna INTEGER de Postgres: evita un 500 por desborde.
    .max(2_147_483_647, "El cupo máximo no puede superar 2147483647"),
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
