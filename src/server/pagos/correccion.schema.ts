import { z } from "zod";
import { formaPagoIdSchema, montoSchema, motivoSchema } from "@/server/pagos/pago.schema";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

/**
 * HU-I-06 (spec_modulo_I.md §2.14.2): corrige el monto del pago y/o la forma
 * o la fecha de su operación. Llega al menos uno de los tres; el motivo es
 * obligatorio. `fecha_pago` sale de acá ya como `Date` (UTC, medianoche).
 */
export const CorregirPagoSchema = z.object({
  monto: montoSchema.optional(),
  forma_pago_id: formaPagoIdSchema.optional(),
  fecha_pago: fechaCalendarioValidaSchema.optional(),
  motivo: motivoSchema,
  caja_ajuste_id: z.string().cuid().optional(),
}).strict().refine(
  (c) => c.monto !== undefined || c.forma_pago_id !== undefined || c.fecha_pago !== undefined,
  "Indicá qué querés corregir",
);
export type CorregirPagoInput = z.infer<typeof CorregirPagoSchema>;

/** HU-I-06 (spec_modulo_I.md §2.14.3): anula el pago. «Reintegro» es un motivo más (P-I8). */
export const AnularPagoSchema = z.object({
  motivo: motivoSchema,
  caja_ajuste_id: z.string().cuid().optional(),
}).strict();
export type AnularPagoInput = z.infer<typeof AnularPagoSchema>;
