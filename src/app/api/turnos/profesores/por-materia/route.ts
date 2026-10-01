import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { ConfigurarTurnoSchema } from "@/server/turnos/turno.schema";
import { listarProfesoresPorMateria } from "@/server/turnos/turno.profesor.service";

export const GET = withPermission("turnos:crear", async (req) => {
  const parsed = ConfigurarTurnoSchema.shape.materia_id.safeParse(req.nextUrl.searchParams.get("materia_id"));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: await listarProfesoresPorMateria(parsed.data), error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === "SIN_PROFESORES_PARA_MATERIA" ? 404 : 409;
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status });
    }
    throw error;
  }
});
