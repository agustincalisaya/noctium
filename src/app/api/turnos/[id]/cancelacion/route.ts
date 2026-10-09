import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { statusDeErrorNuevo } from "@/server/shared/error-dominio";
import { cancelarTurno } from "@/server/turnos/turno.cancelacion.service";

/** HU-C-05 (spec_modulo_C.md §2.10): cancelar o descartar un turno. Sin body. */
export const POST = withPermission("turnos:cancelar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try {
    return NextResponse.json({ data: await cancelarTurno(id, req.auth!.user.id), error: null });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, {
      status: statusDeErrorNuevo(error) ?? (error.code === "TURNO_NO_ENCONTRADO" ? 404 : 409),
    });
    throw error;
  }
});
