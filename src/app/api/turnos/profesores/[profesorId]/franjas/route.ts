import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { ConfigurarTurnoSchema } from "@/server/turnos/turno.schema";
import { listarFranjasProfesor } from "@/server/turnos/turno.franjas.service";

export const GET = withPermission("turnos:crear", async (req, ctx) => {
  const { profesorId } = await ctx.params as { profesorId: string };
  const materia = ConfigurarTurnoSchema.shape.materia_id.safeParse(req.nextUrl.searchParams.get("materia_id"));
  if (!profesorId?.trim() || !materia.success) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos" } }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: await listarFranjasProfesor(profesorId.trim(), materia.data), error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === "PROFESOR_NO_ENCONTRADO" ? 404 : 409;
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status });
    }
    throw error;
  }
});
