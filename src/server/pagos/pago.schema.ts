import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

export const RegistrarPagoSchema = z.object({
  turno_id: z.string().trim().min(1, "Falta el turno"),
  alumno_id: z.string().cuid("Elegí el alumno que paga"),
  monto: z.string().trim()
    .regex(/^\d{1,9}(\.\d{1,2})?$/, "El monto debe ser un número positivo con hasta 2 decimales")
    .refine((valor) => Number(valor) > 0, "El monto debe ser mayor a cero"),
  // El catálogo inicial de las migraciones usa ids legibles; las altas nuevas usan CUID.
  forma_pago_id: z.union([
    z.string().cuid(),
    z.enum(["formapago-efectivo", "formapago-transferencia", "formapago-debito", "formapago-mercado-pago"]),
  ], { error: "Elegí una forma de pago" }),
  fecha_pago: fechaCalendarioValidaSchema.optional(),
}).strict();

export const OpcionesPagoQuerySchema = z.object({
  turno_id: z.string().trim().min(1, "Falta el turno"),
}).strict();

export type RegistrarPagoInput = z.infer<typeof RegistrarPagoSchema>;
