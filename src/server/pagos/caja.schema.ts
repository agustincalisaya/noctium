import { z } from "zod";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

/**
 * Validación HTTP de la caja (HU-I-12, spec_modulo_I.md §2.10.1, §2.11 y
 * §2.12). Corre en la ruta antes del servicio (Regla N.° 6); el servicio
 * repite la verificación del formato del monto.
 */

const montoNoNegativoSchema = (mensaje: string) => z.string().trim().regex(/^\d{1,9}(\.\d{1,2})?$/, mensaje);

export const AbrirCajaSchema = z.object({
  // Puede ser 0 (criterio 1).
  fondo_inicial: montoNoNegativoSchema("El fondo inicial debe ser un número igual o mayor a 0 con hasta 2 decimales"),
}).strict();

export const DeclararEfectivoSchema = z.object({
  efectivo_declarado: montoNoNegativoSchema("El efectivo contado debe ser un número igual o mayor a 0 con hasta 2 decimales"),
}).strict();

export const ConfirmarCierreSchema = z.object({
  huella: z.string().trim().min(1, "Falta la huella del resumen").max(128),
  // Vacío equivale a no enviado; el servicio decide si es obligatorio (criterio 7).
  motivo: z.string().trim().max(300, "El motivo no puede superar los 300 caracteres").optional(),
}).strict();

/** Ids de la ruta y de los filtros: los del seed no son CUID, así que solo se acota el largo (un id inexistente es 404). */
export const idCajaSchema = z.string().trim().min(1).max(64);

const fechaFiltroSchema = z.string().trim().refine((valor) => fechaCalendarioValidaSchema.safeParse(valor).success, {
  message: "La fecha debe ser una fecha válida con el formato AAAA-MM-DD",
});

const paginaSchema = z.coerce.number().int().positive().max(100000).default(1);

/** `GET /api/cajas`: filtros de los cierres (fecha de CIERRE, DEC-30) y página. */
export const ListarCajasQuerySchema = z.object({
  integrante_id: idCajaSchema.optional(),
  desde: fechaFiltroSchema.optional(),
  hasta: fechaFiltroSchema.optional(),
  pagina: paginaSchema,
}).strict().refine((filtros) => !filtros.desde || !filtros.hasta || filtros.desde <= filtros.hasta, {
  message: "La fecha «desde» no puede ser posterior a «hasta»",
  path: ["hasta"],
});

/** `GET /api/cajas/mia/cierres`. */
export const PaginaQuerySchema = z.object({ pagina: paginaSchema }).strict();

export type AbrirCajaInput = z.infer<typeof AbrirCajaSchema>;
export type DeclararEfectivoInput = z.infer<typeof DeclararEfectivoSchema>;
export type ConfirmarCierreInput = z.infer<typeof ConfirmarCierreSchema>;
export type ListarCajasQuery = z.infer<typeof ListarCajasQuerySchema>;
