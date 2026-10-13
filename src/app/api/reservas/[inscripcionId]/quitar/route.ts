import { NextResponse } from "next/server";
import { respuestaDeError } from "@/app/api/pagos/respuesta-error";
import { withPermission } from "@/server/shared/with-permission";
import { quitarReservaPendiente } from "@/server/turnos/reserva.pendiente.service";

/**
 * HU-C-26 §2.20.4 «Quitar»: sin body. Mismo permiso que quitar un alumno de la
 * clase (2.5), pero con su propia condición atómica: solo una reserva que sigue
 * pendiente (409 RESERVA_NO_PENDIENTE si se pagó o venció; 404 si no existe).
 * Sin chequeo de CUID: un id inexistente lo resuelve el servicio con 404.
 */
export const POST = withPermission("turnos:asignar_participantes", async (req, ctx) => {
  const { inscripcionId } = await ctx.params as { inscripcionId: string };
  try {
    return NextResponse.json({ data: await quitarReservaPendiente(inscripcionId, req.auth!.user.id), error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
