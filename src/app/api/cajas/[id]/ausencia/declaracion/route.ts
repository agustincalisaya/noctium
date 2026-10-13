import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { DeclararEfectivoSchema, idCajaSchema } from "@/server/pagos/caja.schema";
import { declararPorAusencia } from "@/server/pagos/caja.flujos";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/** HU-I-12 cierre por ausencia, paso 1 (spec_modulo_I.md §2.12): el gerente declara el efectivo de la caja de otro integrante. */
export const POST = withPermission("cajas:cerrar_ausencia", async (req, ctx) => {
  const id = idCajaSchema.safeParse((await ctx.params as { id: string }).id);
  if (!id.success) return respuestaDeValidacion(id.error.flatten());
  const parsed = DeclararEfectivoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    const data = await declararPorAusencia(req.auth!.user.id, id.data, parsed.data.efectivo_declarado);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
