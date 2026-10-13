import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { DeclararEfectivoSchema } from "@/server/pagos/caja.schema";
import { declararMiEfectivo } from "@/server/pagos/caja.flujos";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/** HU-I-12 paso 1 del cierre (spec_modulo_I.md §2.11): declara el efectivo contado, una sola vez. */
export const POST = withPermission("cajas:cerrar", async (req) => {
  const parsed = DeclararEfectivoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    const data = await declararMiEfectivo(req.auth!.user.id, parsed.data.efectivo_declarado);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
