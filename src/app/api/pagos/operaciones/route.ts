import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { RegistrarOperacionSchema } from "@/server/pagos/pago.schema";
import { registrarOperacionDePago } from "@/server/pagos/pago.service";
import { respuestaDeError, respuestaDeValidacion } from "../respuesta-error";

/** HU-I-10 paso 3 (spec_modulo_I.md §2.7.3-2.7.6): registra la operación de pago. */
export const POST = withPermission("pagos:crear", async (req) => {
  const parsed = RegistrarOperacionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    const data = await registrarOperacionDePago(parsed.data, req.auth!.user.id);
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    return respuestaDeError(error, { TURNO_NO_ENCONTRADO: 404, INSCRIPCION_NO_ENCONTRADA: 404, FORMA_PAGO_NO_ENCONTRADA: 404 });
  }
});
