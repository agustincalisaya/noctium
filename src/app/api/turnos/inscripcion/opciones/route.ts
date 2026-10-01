import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { OpcionesInscripcionQuerySchema } from "@/server/turnos/turno.schema";
import { listarOpcionesInscripcion } from "@/server/turnos/turno.service";

/** HU-C-12 §2.14.2: materia → profesor → horario, para el alumno de la sesión. */
export const GET = withPermission("turnos:solicitar_propio", async (req) => {
  const parsed = OpcionesInscripcionQuerySchema.safeParse({
    ...(req.nextUrl.searchParams.has("materia_id") ? { materia_id: req.nextUrl.searchParams.get("materia_id") } : {}),
    ...(req.nextUrl.searchParams.has("profesor_id") ? { profesor_id: req.nextUrl.searchParams.get("profesor_id") } : {}),
  });
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Filtros inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  }
  try {
    const data = await listarOpcionesInscripcion(parsed.data, req.auth!.user.id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.code === "SIN_PERMISO" ? 403 : 409 });
    }
    throw error;
  }
});
