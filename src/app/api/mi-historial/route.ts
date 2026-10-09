import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { MiHistorialQuerySchema } from "@/server/historial/historial.schema";
import { obtenerMiHistorial } from "@/server/historial/historial.service";

export const GET = withPermission("historial:leer_propio", async req => {
  if (req.nextUrl.searchParams.has("alumno_id") || req.nextUrl.searchParams.has("alumnoId")) {
    return NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "No tenés permisos para consultar otro historial" } }, { status: 403 });
  }
  const parsed = MiHistorialQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Parámetros inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  try {
    return NextResponse.json({ data: await obtenerMiHistorial(parsed.data, req.auth!.user), error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ServiceError && error.code === "SIN_PERMISO") return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: 403 });
    throw error;
  }
});
