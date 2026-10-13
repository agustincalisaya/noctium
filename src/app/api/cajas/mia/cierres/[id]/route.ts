import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { idCajaSchema } from "@/server/pagos/caja.schema";
import { obtenerDetalleCierre } from "@/server/pagos/caja.lecturas";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/** HU-I-12 (spec_modulo_I.md §2.12): detalle de uno de mis cierres (403 FUERA_DE_ALCANCE si es de otro integrante). */
export const GET = withPermission("cajas:leer", async (req, ctx) => {
  const parsed = idCajaSchema.safeParse((await ctx.params as { id: string }).id);
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten());
  try {
    const data = await obtenerDetalleCierre(parsed.data, { usuarioId: req.auth!.user.id, esGerente: false });
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
