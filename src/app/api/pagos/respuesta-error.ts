import { NextResponse } from "next/server";
import { esErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";

/**
 * Sobre de error de los endpoints de HU-I-10 (spec_modulo_I.md §2.7.6): un
 * `ErrorDeDominio` responde con el HTTP de su catálogo y expone sus `datos`
 * como `detalles` (la clase que falló, `precio_vigente`…); un `ServiceError`
 * común, con el fallback por código. Cualquier otro error se relanza.
 */
export function respuestaDeError(error: unknown, fallback: Record<string, number> = {}): NextResponse {
  if (esErrorDeDominio(error)) {
    return NextResponse.json({
      data: null,
      error: { code: error.code, message: error.message, ...(error.datos ? { detalles: error.datos } : {}) },
    }, { status: error.status });
  }
  if (error instanceof ServiceError) {
    return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: fallback[error.code] ?? 409 });
  }
  throw error;
}

export function respuestaDeValidacion(detalles: unknown, message = "Parámetros inválidos"): NextResponse {
  return NextResponse.json({ data: null, error: { code: "VALIDACION", message, detalles } }, { status: 400 });
}
