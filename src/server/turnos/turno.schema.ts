import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

export const ListarTurnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).optional(),
  q: z.string().trim().max(100).optional(), // HU-C-02
  // HU-C-08. `.strict()`: sin `materia_id`, `estados` ni `solo_futuros` (HU-C-02 AC6, spec §2.7).
  profesor_id: z.string().cuid().optional(),
}).strict();

export const PRIORIDADES_TURNO = ["NORMAL", "ALTA", "URGENTE"] as const;
export const ActualizarPrioridadSchema = z.object({
  prioridad: z.enum(PRIORIDADES_TURNO),
}).strict();
export type ActualizarPrioridadInput = z.infer<typeof ActualizarPrioridadSchema>;

// Revisión 4 (§2.1): duraciones que Mesa de Entradas puede elegir. Cambiar el
// conjunto requiere nueva aprobación del PO: es constante, no ParametroSistema.
export const DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180] as const;
export function esDuracionPermitida(valor: number) { return (DURACIONES_PERMITIDAS_TURNO_MIN as readonly number[]).includes(valor); }

export const ConfigurarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema,
  hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ingresá una hora válida (HH:MM)"),
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  profesor_id: z.cuid(),
  // Sin cupo_maximo (Revisión 3): se fija con la capacidad del aula (§2.3).
  // Revisión 4: obligatorio, sin default. Número JSON (no se coerciona un string).
  duracion_min: z.number({ error: "Elegí la duración del turno" }).int("Elegí una duración válida (1, 2 o 3 horas)").refine(esDuracionPermitida, "Elegí una duración válida (1, 2 o 3 horas)"),
});

export type ConfigurarTurnoInput = z.infer<typeof ConfigurarTurnoSchema>;

/** HU-C-07 §2.8.2: parámetros de consulta para disponibilidad del profesor. */
export const DisponibilidadProfesorQuerySchema = z.object({
  materia_id: ConfigurarTurnoSchema.shape.materia_id,
  duracion_min: z.coerce.number({ error: "Elegí la duración del turno" })
    .int().refine(esDuracionPermitida, "Elegí una duración válida (1, 2 o 3 horas)"),
  desde: fechaCalendarioValidaSchema.optional(),
  hasta: fechaCalendarioValidaSchema.optional(),
});
export type DisponibilidadProfesorQuery = z.infer<typeof DisponibilidadProfesorQuerySchema>;

export const AsignarParticipantesTurnoSchema = z.object({
  alumno_ids: z.array(z.cuid())
    .min(1, "Agregá al menos un alumno")
    .refine((ids) => new Set(ids).size === ids.length, "El mismo alumno no puede agregarse dos veces"),
  profesor_id: z.cuid().optional(),
});
export type AsignarParticipantesTurnoInput = z.infer<typeof AsignarParticipantesTurnoSchema>;

export const AgregarAlumnoTurnoSchema = z.object({
  alumno_id: z.cuid(),
});
export type AgregarAlumnoTurnoInput = z.infer<typeof AgregarAlumnoTurnoSchema>;

/** HU-C-12 §2.14.2: el segundo filtro requiere el primero. */
export const OpcionesInscripcionQuerySchema = z.object({
  materia_id: z.string().trim().min(1).optional(),
  profesor_id: z.string().trim().min(1).optional(),
}).strict().refine((query) => !query.profesor_id || Boolean(query.materia_id), {
  message: "Elegí una materia antes de elegir un profesor",
  path: ["materia_id"],
});
export type OpcionesInscripcionQuery = z.infer<typeof OpcionesInscripcionQuerySchema>;

/** HU-C-13 §2.14.1: consulta paginada de turnos del alumno autenticado. */
export const MisTurnosQuerySchema = z.object({
  vista: z.enum(["proximos", "anteriores"]).default("proximos"),
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(10).default(10),
}).strict();
export type MisTurnosQuery = z.infer<typeof MisTurnosQuerySchema>;

export const AsignarAulaTurnoSchema = z.object({ aula_id: z.cuid() });
export type AsignarAulaTurnoInput = z.infer<typeof AsignarAulaTurnoSchema>;

/** HU-C-06: solo fecha y hora de inicio. */
export const ReprogramarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema,
  hora_inicio: ConfigurarTurnoSchema.shape.hora_inicio,
}).strict();
export type ReprogramarTurnoInput = z.infer<typeof ReprogramarTurnoSchema>;

export const OpcionesReprogramacionQuerySchema = z.object({ fecha: fechaCalendarioValidaSchema }).strict();
