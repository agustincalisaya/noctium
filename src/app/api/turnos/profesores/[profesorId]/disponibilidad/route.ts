import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { DisponibilidadProfesorQuerySchema } from "@/server/turnos/turno.schema";
import { calcularDisponibilidadProfesor } from "@/server/turnos/turno.profesor.service";

export const GET = withPermission("turnos:crear", async (req, ctx) => {
  const { profesorId } = await ctx.params as { profesorId: string };
  const query = req.nextUrl.searchParams;
  const parsed = DisponibilidadProfesorQuerySchema.safeParse({
    materia_id: query.get("materia_id") ?? undefined,
    duracion_min: query.get("duracion_min") ?? undefined,
    desde: query.get("desde") ?? undefined,
    hasta: query.get("hasta") ?? undefined,
  });
  if (!profesorId?.trim() || !parsed.success) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos" } }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: await calcularDisponibilidadProfesor(profesorId.trim(), parsed.data), error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === "VALIDATION_ERROR" ? 400
        : error.code === "PROFESOR_NO_ENCONTRADO" ? 404
          : error.code === "MATERIA_NO_DISPONIBLE" || error.code === "PROFESOR_NO_DICTA_MATERIA" ? 409 : 422;
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status });
    }
    throw error;
  }
});
