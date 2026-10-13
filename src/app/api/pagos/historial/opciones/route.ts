import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { OpcionesHistorialPagosQuerySchema } from "@/server/pagos/pago.schema";
import { obtenerOpcionesHistorialPagos } from "@/server/pagos/pago.service";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

export const GET = withPermission("pagos:leer", async (req) => {
  const parsed = OpcionesHistorialPagosQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten());
  try {
    return NextResponse.json({ data: await obtenerOpcionesHistorialPagos(parsed.data.alumno_id), error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});