import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { obtenerCajaPropia } from "@/server/pagos/caja.lecturas";
import { respuestaDeError } from "@/app/api/pagos/respuesta-error";

/**
 * HU-I-12 (spec_modulo_I.md §2.10.2): la caja abierta propia en arqueo ciego
 * (ítems con su monto individual, sin totales ni esperado), o `{ caja: null }`.
 */
export const GET = withPermission("cajas:leer", async (req) => {
  try {
    const data = await obtenerCajaPropia(req.auth!.user.id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
