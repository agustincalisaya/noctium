import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leerComprobante } from "@/server/pagos/comprobante.lectura";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { withPermission } from "@/server/shared/with-permission";
import { respuestaDeError } from "@/app/api/pagos/respuesta-error";

/** HU-I-11 (spec_modulo_I.md §2.9.3): el comprobante pedido, vista completa. */
export const GET = withPermission("comprobantes:leer", async (_req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const comprobante = await leerComprobante(prisma, id);
  if (!comprobante) return respuestaDeError(new ErrorDeDominio("errores.comprobante.noEncontrado"));
  return NextResponse.json({ data: comprobante, error: null }, { headers: { "Cache-Control": "no-store" } });
});
