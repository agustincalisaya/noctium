import { NextResponse } from "next/server";
import { statusDeErrorNuevo } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";
import { withPermission } from "@/server/shared/with-permission";
import { cancelarInscripcionPropia } from "@/server/turnos/turno.cancelacion-propia.service";

export const POST = withPermission("turnos:cancelar_propia", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try {
    const data = await cancelarInscripcionPropia(id, req.auth!.user.id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = statusDeErrorNuevo(error) ?? (error.code === "SIN_PERMISO" ? 403 : error.code.endsWith("NO_ENCONTRADO") || error.code.endsWith("NO_ENCONTRADA") ? 404 : 409);
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status });
    }
    throw error;
  }
});
