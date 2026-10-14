import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { OpcionesMisPagosQuerySchema } from "@/server/pagos/pago.schema";
import { obtenerOpcionesMisPagos } from "@/server/pagos/pago.service";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/** HU-I-05 (spec_modulo_I.md §2.15): materias de las clases pagadas por el alumno de la sesión. */
export const GET = withPermission("pagos:leer_propios", async (req) => {
  const parsed = OpcionesMisPagosQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten());
  try {
    const data = await obtenerOpcionesMisPagos(req.auth!.user.id);
    return NextResponse.json({ data, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respuestaDeError(error);
  }
});
