import { z } from "zod";

/**
 * Contrato único del JSON `Comprobante.datos` (spec_modulo_I.md §2.9.2,
 * R3-PR0-I7): la copia fija de todo lo que muestra el comprobante. Lo
 * escribe solo `emitirComprobante`/`emitirReemplazo` y lo lee HU-I-11; al
 * verlo no se lee nada de la operación, así un comprobante emitido no cambia
 * aunque después se corrija.
 */
const decimal = z.string().regex(/^-?\d+\.\d{2}$/, "monto con dos decimales");
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha AAAA-MM-DD");

export const ComprobanteDatosSchema = z.object({
  version: z.literal(1),
  centro: z.object({ nombre: z.string(), domicilio: z.string(), telefono: z.string() }).strict(),
  alumno: z.object({ id: z.string().min(1), nombre: z.string(), apellido: z.string(), dni: z.string() }).strict(),
  fecha_pago: fecha,
  forma_pago: z.object({ id: z.string().min(1), nombre: z.string() }).strict(),
  // El usuario real que registró el cobro; la vista del alumno lo reemplaza por
  // «Registrado en el centro» (HU-I-11 criterio 2). `null` si la cuenta no tiene ficha del personal.
  registrado_por: z.object({ usuario_id: z.string().min(1), nombre_completo: z.string().nullable() }).strict(),
  clases: z.array(z.object({
    pago_id: z.string().min(1),
    materia: z.object({ id: z.string().min(1), nombre: z.string() }).strict(),
    fecha,
    hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
    precio: z.number().int().positive(),
    monto: decimal,
  }).strict()).min(1),
  total: decimal,
}).strict();

export type ComprobanteDatos = z.infer<typeof ComprobanteDatosSchema>;

/** Número visible: «0001-» y el correlativo con 8 dígitos (por ejemplo, 0001-00000123). */
export function formatearNumeroComprobante(numero: number): string {
  return `0001-${String(numero).padStart(8, "0")}`;
}
