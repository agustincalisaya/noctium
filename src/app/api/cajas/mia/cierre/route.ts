import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ConfirmarCierreSchema } from "@/server/pagos/caja.schema";
import { cerrarMiCaja } from "@/server/pagos/caja.flujos";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/**
 * HU-I-12 paso 2 del cierre (spec_modulo_I.md §2.11): confirma el cierre con
 * la huella del resumen que se mostró. Si la caja cambió, 409 CAJA_CAMBIO con
 * el resumen y la huella nuevos en `detalles`, sin cerrar.
 */
export const POST = withPermission("cajas:cerrar", async (req) => {
  const parsed = ConfirmarCierreSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    const data = await cerrarMiCaja(req.auth!.user.id, parsed.data);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
