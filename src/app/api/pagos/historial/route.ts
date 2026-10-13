import { NextResponse } from "next/server";
import { tienePermiso, withPermission } from "@/server/shared/with-permission";
import { HistorialPagosQuerySchema } from "@/server/pagos/pago.schema";
import { listarHistorialDePagos } from "@/server/pagos/pago.service";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

export const GET = withPermission("pagos:leer", async (req) => {
  const parsed = HistorialPagosQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten());
  try {
    const puedeCrearPago = req.auth!.user.rol === "MESA_ENTRADA" && await tienePermiso("pagos:crear");
    const data = await listarHistorialDePagos(parsed.data, { id: req.auth!.user.id, rol: req.auth!.user.rol, puedeCrearPago });
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});