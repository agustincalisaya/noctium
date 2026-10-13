import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { CorregirPagoSchema } from "@/server/pagos/correccion.schema";
import { corregirPagoFlujo } from "@/server/pagos/correccion.flujos";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/**
 * HU-I-06 (spec_modulo_I.md §2.14.2): corrige el monto del pago y/o la forma
 * o la fecha de su operación. El alcance (`FUERA_DE_ALCANCE`) lo decide el
 * servicio con todo bloqueado.
 */
export const POST = withPermission("pagos:corregir", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = CorregirPagoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    const { id: usuarioId, rol } = req.auth!.user;
    const data = await corregirPagoFlujo(id, parsed.data, { id: usuarioId, rol });
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
