import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ConfirmarCierreSchema, idCajaSchema } from "@/server/pagos/caja.schema";
import { cerrarPorAusencia } from "@/server/pagos/caja.flujos";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/** HU-I-12 cierre por ausencia, confirmación (spec_modulo_I.md §2.12): queda marcado `por_ausencia` con el gerente como responsable. */
export const POST = withPermission("cajas:cerrar_ausencia", async (req, ctx) => {
  const id = idCajaSchema.safeParse((await ctx.params as { id: string }).id);
  if (!id.success) return respuestaDeValidacion(id.error.flatten());
  const parsed = ConfirmarCierreSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    const data = await cerrarPorAusencia(req.auth!.user.id, id.data, parsed.data);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
