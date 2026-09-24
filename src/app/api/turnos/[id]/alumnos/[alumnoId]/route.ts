import { NextResponse } from "next/server";
import { z } from "zod";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { quitarAlumnoTurno } from "@/server/turnos/turno.service";

/** HU-C-04 §2.5: baja individual de un alumno en un turno DISPONIBLE o COMPLETO. */
export const DELETE = withPermission("turnos:asignar_participantes", async (req, ctx) => {
  const { id, alumnoId } = await ctx.params as { id: string; alumnoId: string };
  // Sin chequeo de CUID del turno: los turnos del seed usan ids legibles
  // ("seed-turno-NN"); un id inexistente lo resuelve el servicio con 404,
  // igual que GET /api/turnos/[id] y PATCH .../configuracion.
  if (!z.cuid().safeParse(alumnoId).success) {
    return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "ID de alumno inválido" } }, { status: 400 });
  }
  try {
    return NextResponse.json({ data: await quitarAlumnoTurno(id, alumnoId, req.auth!.user.id), error: null });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) } }, { status: error.code === "TURNO_NO_ENCONTRADO" || error.code === "ALUMNO_NO_ASIGNADO" ? 404 : 409 });
    throw error;
  }
});
