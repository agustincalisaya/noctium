import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { idCajaSchema } from "@/server/pagos/caja.schema";
import { obtenerResumenCierre } from "@/server/pagos/caja.lecturas";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/** HU-I-12 cierre por ausencia, paso 2 (spec_modulo_I.md §2.12): resumen y huella de la caja de otro integrante. */
export const GET = withPermission("cajas:cerrar_ausencia", async (req, ctx) => {
  const id = idCajaSchema.safeParse((await ctx.params as { id: string }).id);
  if (!id.success) return respuestaDeValidacion(id.error.flatten());
  try {
    const data = await obtenerResumenCierre({ usuarioId: req.auth!.user.id, cajaId: id.data });
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
