import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { statusDeErrorNuevo } from "@/server/shared/error-dominio";
import { solicitarTurnoPropio } from "@/server/turnos/turno.service";

/** HU-C-12 §2.14.2: sin alumno_id ni otro dato de identidad del cliente. */
export const POST = withPermission("turnos:solicitar_propio", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try {
    const data = await solicitarTurnoPropio(id, req.auth!.user.id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = statusDeErrorNuevo(error) ?? (error.code === "SIN_PERMISO" ? 403 : error.code === "TURNO_NO_ENCONTRADO" ? 404 : 409);
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status });
    }
    throw error;
  }
});
