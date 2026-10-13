import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { AnularPagoSchema } from "@/server/pagos/correccion.schema";
import { anularPagoFlujo } from "@/server/pagos/correccion.flujos";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/**
 * HU-I-06 (spec_modulo_I.md §2.14.3): anula el pago. «Reintegro» es un motivo
 * como cualquier otro (P-I8). El alcance lo decide el servicio con todo bloqueado.
 */
export const POST = withPermission("pagos:corregir", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = AnularPagoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    const { id: usuarioId, rol } = req.auth!.user;
    const data = await anularPagoFlujo(id, parsed.data, { id: usuarioId, rol });
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
