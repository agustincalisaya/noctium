import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { HistorialQuerySchema } from "@/server/historial/historial.schema";
import { obtenerHistorialAlumno } from "@/server/historial/historial.service";

export const GET = withPermission("historial:leer", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = HistorialQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({
      data: null,
      error: { code: "VALIDACION", message: "Parámetros inválidos", detalles: parsed.error.flatten() },
    }, { status: 400 });
  }

  try {
    const historial = await obtenerHistorialAlumno(id, parsed.data, req.auth!.user);
    return NextResponse.json({ data: historial, error: null });
  } catch (error) {
    if (error instanceof ServiceError && ["SIN_PERMISO", "ALUMNO_NO_ENCONTRADO"].includes(error.code)) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: error.code === "SIN_PERMISO" ? 403 : 404 },
      );
    }
    throw error;
  }
});
