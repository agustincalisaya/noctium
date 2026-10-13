import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { AnularMovimientoSchema, idCajaSchema } from "@/server/pagos/caja.schema";
import { anularMiMovimiento } from "@/server/pagos/caja.flujos";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/**
 * HU-I-12-b (spec_modulo_I.md §2.10.4): anula un movimiento de la caja
 * abierta propia con un registro nuevo (Regla N.° 8). Un movimiento de otra
 * caja es 404 MOVIMIENTO_NO_ENCONTRADO, para no confirmar que existe.
 */
export const POST = withPermission("cajas:movimiento", async (req, ctx) => {
  const id = idCajaSchema.safeParse((await ctx.params as { movimientoId: string }).movimientoId);
  if (!id.success) return respuestaDeValidacion(id.error.flatten());
  const parsed = AnularMovimientoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    const data = await anularMiMovimiento(req.auth!.user.id, id.data, parsed.data.motivo);
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    return respuestaDeError(error);
  }
});
