import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { MisTurnosQuerySchema } from "@/server/turnos/turno.schema";
import { listarTurnosPropios } from "@/server/turnos/turno.service";

/** HU-C-13 §2.14.1: consulta de turnos propios del alumno de la sesión. */
export const GET = withPermission("turnos:leer_propios", async (req) => {
  const parsed = MisTurnosQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({
      data: null,
      error: { code: "VALIDATION_ERROR", message: "Filtros inválidos", detalles: parsed.error.flatten() },
    }, { status: 400 });
  }

  try {
    const data = await listarTurnosPropios(parsed.data, req.auth!.user.id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ServiceError && error.code === "SIN_PERMISO") {
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: 403 });
    }
    throw error;
  }
});
