import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";
import { ConfigurarTurnoSchema } from "./turno.schema";

/** Payload compartido por la vista previa y la confirmación de HU-C-17. */
export const GenerarTurnosSchema = z.object({
  materia_id: ConfigurarTurnoSchema.shape.materia_id,
  profesor_id: z.cuid(),
  horario_id: z.cuid(),
  duracion_min: ConfigurarTurnoSchema.shape.duracion_min,
  hora_inicio: ConfigurarTurnoSchema.shape.hora_inicio,
  aula_id: z.cuid(),
  fecha_desde: fechaCalendarioValidaSchema,
  fecha_hasta: fechaCalendarioValidaSchema,
}).strict().refine((datos) => datos.fecha_desde <= datos.fecha_hasta, {
  message: "La fecha hasta debe ser posterior o igual a la fecha desde",
  path: ["fecha_hasta"],
});

export type GenerarTurnosInput = z.infer<typeof GenerarTurnosSchema>;

/** Contratos de éxito de §2.9 compartidos por preview y confirmación. */
export type MotivoConflictoGeneracion = "AULA_OCUPADA" | "PROFESOR_OCUPADO" | "TURNO_EXISTENTE";
export type VistaPreviaGeneracion = {
  cantidad: number;
  fechas: { fecha: string; estado: "OK" | "CONFLICTO"; motivos: MotivoConflictoGeneracion[] }[];
  hay_conflictos: boolean;
  fechas_omitidas_vencidas: number;
};
export type ResultadoGeneracion = { generacion_id: string; cantidad: number; turno_ids: string[] };
