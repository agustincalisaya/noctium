import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { PendientesQuerySchema } from "@/server/pagos/pago.schema";
import { listarClasesPendientesDePago } from "@/server/pagos/pago.service";
import { respuestaDeError, respuestaDeValidacion } from "../respuesta-error";

/** HU-I-10 paso 2 (spec_modulo_I.md §2.7.2): clases del alumno pendientes de pago. */
export const GET = withPermission("pagos:crear", async (req) => {
  const parsed = PendientesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten());
  try {
    return NextResponse.json({ data: await listarClasesPendientesDePago(parsed.data.alumno_id, parsed.data.turno_id), error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
