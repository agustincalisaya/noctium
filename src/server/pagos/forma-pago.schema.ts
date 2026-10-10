import { z } from "zod";
import { motivoSchema } from "./pago.schema";

/**
 * Alta de forma de pago (spec_modulo_I.md §2.1, HU-I-03). Primero se recorta
 * y se colapsan los espacios internos; recién después se valida el largo
 * (2 a 40). `.strict()` rechaza cualquier campo extra: no se solicita ni se
 * almacena ningún dato financiero (criterio 1). Con el campo vacío se
 * muestra un solo mensaje (`abort` corta la cadena en el primer fallo).
 */
export const NombreFormaPagoSchema = z.string()
  .transform((valor) => valor.trim().replace(/\s+/g, " "))
  .pipe(z.string()
    .min(1, { error: "Ingresá el nombre de la forma de pago.", abort: true })
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(40, "El nombre no puede superar los 40 caracteres"));

export const CrearFormaPagoSchema = z.object({ nombre: NombreFormaPagoSchema }).strict();
export const ModificarFormaPagoSchema = CrearFormaPagoSchema;
export const DesactivarFormaPagoSchema = z.object({
  motivo: z.preprocess((valor) => typeof valor === "string" && !valor.trim() ? undefined : valor, motivoSchema.optional()),
}).strict();
export type DesactivarFormaPagoInput = z.infer<typeof DesactivarFormaPagoSchema>;
export type CrearFormaPagoInput = z.infer<typeof CrearFormaPagoSchema>;

export const ListarFormasPagoQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
export type ListarFormasPagoQuery = z.infer<typeof ListarFormasPagoQuerySchema>;
