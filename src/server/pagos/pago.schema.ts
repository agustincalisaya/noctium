import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

// Constantes compartidas (spec_modulo_I.md §2.7.3): las validaciones de monto,
// forma de pago y motivo, sin cambiar el comportamiento de RegistrarPagoSchema.
export const montoSchema = z.string().trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, "El monto debe ser un número positivo con hasta 2 decimales")
  .refine((valor) => Number(valor) > 0, "El monto debe ser mayor a cero");

// El catálogo inicial de las migraciones usa ids legibles; las altas nuevas usan CUID.
export const formaPagoIdSchema = z.union([
  z.string().cuid(),
  z.enum(["formapago-efectivo", "formapago-transferencia", "formapago-debito", "formapago-mercado-pago"]),
], { error: "Elegí una forma de pago" });

export const motivoSchema = z.string().trim()
  .min(1, "Ingresá el motivo")
  .max(300, "El motivo no puede superar los 300 caracteres");

export const RegistrarPagoSchema = z.object({
  turno_id: z.string().trim().min(1, "Falta el turno"),
  alumno_id: z.string().cuid("Elegí el alumno que paga"),
  monto: montoSchema,
  forma_pago_id: formaPagoIdSchema,
  fecha_pago: fechaCalendarioValidaSchema.optional(),
}).strict();

export const OpcionesPagoQuerySchema = z.object({
  turno_id: z.string().trim().min(1, "Falta el turno"),
}).strict();

export type RegistrarPagoInput = z.infer<typeof RegistrarPagoSchema>;

// HU-I-10, paso 1 (§2.7.1).
export const BuscarAlumnosCobroQuerySchema = z.object({
  q: z.string().trim().min(2, "Escribí al menos 2 caracteres"),
}).strict();

// HU-I-10, paso 2 (§2.7.2): turno_id solo para «Se inscribe al confirmar el pago» y para marcar una clase.
export const PendientesQuerySchema = z.object({
  alumno_id: z.string().cuid(),
  turno_id: z.string().trim().min(1).optional(),
}).strict();

// HU-I-10, paso 3 (§2.7.3). El body no lleva el precio: lo lee el servidor.
export const RegistrarOperacionSchema = z.object({
  alumno_id: z.string().cuid({ error: "Elegí el alumno que paga" }),
  items: z.array(
    z.object({
      inscripcion_id: z.string().cuid().optional(),
      turno_id: z.string().trim().min(1).optional(),
      monto: montoSchema,
      // Obligatorio si el monto difiere del precio: lo valida el servicio.
      motivo_ajuste: motivoSchema.optional(),
    }).strict().refine((item) => (item.inscripcion_id === undefined) !== (item.turno_id === undefined),
      "Cada clase lleva inscripcion_id o turno_id, no los dos"),
  ).min(1, "Elegí al menos una clase").max(50) // tope técnico, P-I7
    .refine((items) => new Set(items.map((item) => item.inscripcion_id ?? `T:${item.turno_id}`)).size === items.length,
      "No repitas una clase en la misma operación"),
  forma_pago_id: formaPagoIdSchema,
  fecha_pago: fechaCalendarioValidaSchema.optional(),
}).strict();

export type RegistrarOperacionInput = z.infer<typeof RegistrarOperacionSchema>;
