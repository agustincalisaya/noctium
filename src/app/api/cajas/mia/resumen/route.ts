import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { obtenerResumenCierre } from "@/server/pagos/caja.lecturas";
import { respuestaDeError } from "@/app/api/pagos/respuesta-error";

/** HU-I-12 paso 2 del cierre (spec_modulo_I.md §2.11): resumen y huella, solo con el efectivo ya declarado. */
export const GET = withPermission("cajas:cerrar", async (req) => {
  try {
    const data = await obtenerResumenCierre({ usuarioId: req.auth!.user.id });
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
