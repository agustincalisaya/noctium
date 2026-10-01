import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { ConfigurarTurnoSchema } from "@/server/turnos/turno.schema";
import { listarOpcionesProfesorWizard } from "@/server/turnos/turno.profesor.service";

export const GET = withPermission("turnos:crear", async (req) => {
  const parsed = ConfigurarTurnoSchema.shape.materia_id.safeParse(req.nextUrl.searchParams.get("materia_id"));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: await listarOpcionesProfesorWizard(parsed.data), error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: 409 });
    }
    throw error;
  }
});
