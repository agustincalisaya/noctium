import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { listarOpcionesProfesorTurno } from "@/server/turnos/turno.profesor.service";

export const GET = withPermission("turnos:asignar_participantes", async (req) => {
  const turnoId = req.nextUrl.searchParams.get("turno_id");
  if (!turnoId) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Falta el turno" } }, { status: 400 });
  try {
    return NextResponse.json({ data: await listarOpcionesProfesorTurno(turnoId), error: null });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } },
      { status: error.code === "TURNO_NO_ENCONTRADO" || error.code === "SIN_PROFESORES_PARA_MATERIA" ? 404 : 409 });
    throw error;
  }
});
