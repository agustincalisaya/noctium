import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { obtenerImpactoFormaPago } from "@/server/pagos/forma-pago.service";
import { respuestaDeError } from "@/app/api/formas-pago/respuesta-error";

export const GET = withPermission("formas_pago:desactivar", async (_req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try { return NextResponse.json(await obtenerImpactoFormaPago(id)); }
  catch (error) { return respuestaDeError(error); }
});
