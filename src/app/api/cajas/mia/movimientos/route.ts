import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { RegistrarMovimientoSchema } from "@/server/pagos/caja.schema";
import { registrarMiMovimiento } from "@/server/pagos/caja.flujos";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/**
 * HU-I-12-b (spec_modulo_I.md §2.10.3): ingreso o egreso manual de efectivo
 * en la caja abierta propia. Un egreso que supera el efectivo esperado es
 * 409 EGRESO_SUPERA_EFECTIVO, sin mostrar el esperado (arqueo ciego).
 */
export const POST = withPermission("cajas:movimiento", async (req) => {
  const parsed = RegistrarMovimientoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    const data = await registrarMiMovimiento(req.auth!.user.id, parsed.data);
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    return respuestaDeError(error);
  }
});
