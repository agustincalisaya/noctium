import { NextResponse } from "next/server";
import { flattenError, type ZodError } from "zod";
import { texto } from "@/lib/textos";

/**
 * 400 de las lecturas de Reservas (HU-C-26, spec_modulo_C.md §2.20):
 * `VALIDATION_ERROR` con los errores por campo y los parámetros ajenos
 * (`.strict()`) en `detalles` (Reglas N.° 5 y 6).
 */
export function respuestaDeValidacionReservas(error: ZodError): NextResponse {
  const { formErrors, fieldErrors } = flattenError(error);
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message: texto("ui.reservas.filtros.invalidos"), detalles: { formErrors, fieldErrors } } },
    { status: 400 },
  );
}
