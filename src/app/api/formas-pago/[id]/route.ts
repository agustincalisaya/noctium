import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { transaccion } from "@/server/shared/transaccion";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/formas-pago/respuesta-error";
import { ModificarFormaPagoSchema } from "@/server/pagos/forma-pago.schema";
import { modificarFormaPago } from "@/server/pagos/forma-pago.service";

export const PATCH = withPermission("formas_pago:editar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = ModificarFormaPagoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    const data = await transaccion((tx) => modificarFormaPago(tx, id, parsed.data));
    return NextResponse.json({ data, error: null });
  } catch (error) { return respuestaDeError(error); }
});
