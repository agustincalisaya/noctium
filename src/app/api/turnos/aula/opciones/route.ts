import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { listarOpcionesAulaTurno } from "@/server/turnos/turno.aula.service";

export const GET = withPermission("turnos:asignar_aula", async (req) => {
  // Opcional: en el alta (pantalla fusionada con §2.1) el turno todavía no existe.
  const turnoId = req.nextUrl.searchParams.get("turno_id") || undefined;
  try {
    return NextResponse.json({ data: await listarOpcionesAulaTurno(turnoId), error: null });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } },
      { status: error.code === "TURNO_NO_ENCONTRADO" || error.code === "SIN_AULAS_ACTIVAS" ? 404 : 409 });
    throw error;
  }
});
