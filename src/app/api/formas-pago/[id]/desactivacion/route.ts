import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { transaccion } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/formas-pago/respuesta-error";
import { DesactivarFormaPagoSchema } from "@/server/pagos/forma-pago.schema";
import { desactivarFormaPago } from "@/server/pagos/forma-pago.service";

export const POST = withPermission("formas_pago:desactivar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = DesactivarFormaPagoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    return NextResponse.json(await transaccion((tx) => desactivarFormaPago(tx, id, parsed.data, actorUsuario(req.auth!.user.id))));
  } catch (error) { return respuestaDeError(error); }
});
