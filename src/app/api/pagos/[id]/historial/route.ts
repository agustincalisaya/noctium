import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { obtenerHistorialDePago } from "@/server/pagos/correccion.lecturas";
import { respuestaDeError } from "@/app/api/pagos/respuesta-error";

/** HU-I-06 (DEC-27, spec_modulo_I.md §2.14.6): historial de cambios del pago, de solo lectura. */
export const GET = withPermission("pagos:leer", async (_req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try {
    const data = await obtenerHistorialDePago(id);
    return NextResponse.json({ data, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respuestaDeError(error);
  }
});
