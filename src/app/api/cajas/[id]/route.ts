import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { idCajaSchema } from "@/server/pagos/caja.schema";
import { obtenerDetalleCierre } from "@/server/pagos/caja.lecturas";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/** HU-I-12 (spec_modulo_I.md §2.12): detalle de cualquier cierre (409 CAJA_NO_CERRADA si la caja sigue abierta). */
export const GET = withPermission("cajas:leer_todas", async (req, ctx) => {
  const parsed = idCajaSchema.safeParse((await ctx.params as { id: string }).id);
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten());
  try {
    const data = await obtenerDetalleCierre(parsed.data, { usuarioId: req.auth!.user.id, esGerente: true });
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
