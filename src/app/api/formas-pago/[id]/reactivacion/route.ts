import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { transaccion } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/formas-pago/respuesta-error";
import { reactivarFormaPago } from "@/server/pagos/forma-pago.service";

export const POST = withPermission("formas_pago:desactivar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  if ((await req.text()).trim()) return respuestaDeValidacion(undefined, "Datos inválidos");
  try {
    return NextResponse.json(await transaccion((tx) => reactivarFormaPago(tx, id, actorUsuario(req.auth!.user.id))));
  } catch (error) { return respuestaDeError(error); }
});
