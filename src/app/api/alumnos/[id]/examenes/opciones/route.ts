import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { listarOpcionesExamen } from "@/server/historial/resultado-examen.service";

export const GET = withPermission("examenes:registrar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try {
    const opciones = await listarOpcionesExamen(id, req.auth!.user);
    return NextResponse.json({ data: opciones, error: null });
  } catch (error) {
    if (error instanceof ServiceError && ["SIN_PERMISO", "ALUMNO_NO_ENCONTRADO", "ALUMNO_INACTIVO"].includes(error.code)) {
      const status = error.code === "SIN_PERMISO" ? 403 : error.code === "ALUMNO_NO_ENCONTRADO" ? 404 : 409;
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status });
    }
    throw error;
  }
});
