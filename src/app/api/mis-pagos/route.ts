import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { MisPagosQuerySchema } from "@/server/pagos/pago.schema";
import { listarMisPagos } from "@/server/pagos/pago.service";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/**
 * HU-I-05 (spec_modulo_I.md §2.15): pagos del alumno de la sesión. La query
 * es estricta: `alumno_id` o cualquier otro campo es 400; el alumno nunca sale
 * del cliente. Respuesta personal, sin caché compartida.
 */
export const GET = withPermission("pagos:leer_propios", async (req) => {
  const parsed = MisPagosQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten());
  try {
    const data = await listarMisPagos(req.auth!.user.id, parsed.data);
    return NextResponse.json({ data, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respuestaDeError(error);
  }
});
