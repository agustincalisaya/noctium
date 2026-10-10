import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { statusDeErrorNuevo } from "@/server/shared/error-dominio";
import { obtenerResumenInscripcion } from "@/server/turnos/turno.resumen-inscripcion.service";

/** C-20: sin body ni identidad aportada por el cliente; wrapper aplica no-store. */
export const GET = withPermission("turnos:solicitar_propio", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try {
    const data = await obtenerResumenInscripcion(id, req.auth!.user.id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = statusDeErrorNuevo(error) ?? (error.code === "SIN_PERMISO" ? 403 : error.code === "TURNO_NO_ENCONTRADO" ? 404 : 409);
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status });
    }
    throw error;
  }
});
