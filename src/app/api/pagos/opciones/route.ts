import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { OpcionesPagoQuerySchema } from "@/server/pagos/pago.schema";
import { obtenerOpcionesPago } from "@/server/pagos/pago.service";

export const GET = withPermission("pagos:crear", async (req) => {
  const parsed = OpcionesPagoQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Parámetros inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  }
  try {
    return NextResponse.json({ data: await obtenerOpcionesPago(parsed.data.turno_id), error: null });
  } catch (error) {
    if (error instanceof ServiceError && error.code === "TURNO_NO_ENCONTRADO") {
      return NextResponse.json({ data: null, error: { code: error.code, message: "No se encontró el turno" } }, { status: 404 });
    }
    throw error;
  }
});
