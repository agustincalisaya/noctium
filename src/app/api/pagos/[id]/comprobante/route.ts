import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comprobanteDelPago, leerComprobante } from "@/server/pagos/comprobante.lectura";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { withPermission } from "@/server/shared/with-permission";
import { respuestaDeError } from "@/app/api/pagos/respuesta-error";

/**
 * HU-I-11 (spec_modulo_I.md §2.9.3): el comprobante vigente de la operación
 * del pago o, si el pago está anulado, el último que lo incluyó.
 */
export const GET = withPermission("comprobantes:leer", async (_req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try {
    const { id: comprobanteId } = await comprobanteDelPago(prisma, id);
    const comprobante = await leerComprobante(prisma, comprobanteId);
    if (!comprobante) throw new ErrorDeDominio("errores.comprobante.noEncontrado");
    return NextResponse.json({ data: comprobante, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respuestaDeError(error);
  }
});
