import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { listarOpcionesAlumnoTurno } from "@/server/turnos/turno.service";

export const GET = withPermission("turnos:asignar_participantes", async (req) => {
  const turnoId = req.nextUrl.searchParams.get("turno_id")?.trim();
  if (!turnoId) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "El turno_id es obligatorio" } }, { status: 400 });
  try {
    return NextResponse.json({ data: await listarOpcionesAlumnoTurno(turnoId), error: null });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } },
      { status: error.code === "TURNO_NO_ENCONTRADO" ? 404 : 409 });
    throw error;
  }
});
