import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

export const FechaExamenSchema = fechaCalendarioValidaSchema;
export const NotaExamenSchema = z.string().trim().regex(/^\d{1,3}(\.\d)?$/, "La nota debe ser un número con hasta 1 decimal");

export const RegistrarResultadoExamenSchema = z.object({
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  fecha_examen: FechaExamenSchema,
  nota: NotaExamenSchema,
  observaciones: z.string().trim().optional(),
}).strict();

export type RegistrarResultadoExamenInput = z.infer<typeof RegistrarResultadoExamenSchema>;

export const CorregirResultadoExamenSchema = z.object({
  fecha_examen: FechaExamenSchema.optional(),
  nota: NotaExamenSchema.optional(),
  motivo: z.string().trim().min(1, "El motivo es obligatorio").max(300, "Máximo 300 caracteres"),
}).strict().refine((valor) => valor.fecha_examen !== undefined || valor.nota !== undefined, {
  message: "Indicá la fecha o la nota a corregir",
  path: ["nota"],
});

export type CorregirResultadoExamenInput = z.infer<typeof CorregirResultadoExamenSchema>;

export const AnularResultadoExamenSchema = z.object({
  motivo: z.string().trim().min(1, "El motivo es obligatorio").max(300, "Máximo 300 caracteres"),
}).strict();

export type AnularResultadoExamenInput = z.infer<typeof AnularResultadoExamenSchema>;
