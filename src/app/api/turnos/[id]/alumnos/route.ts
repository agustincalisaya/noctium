import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { AgregarAlumnoTurnoSchema } from "@/server/turnos/turno.schema";
import { agregarAlumnoTurno } from "@/server/turnos/turno.service";

/** HU-C-04 §2.5: alta individual de un alumno en un turno DISPONIBLE. */
export const POST = withPermission("turnos:asignar_participantes", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  // Sin chequeo de CUID del turno: los turnos del seed usan ids legibles
  // ("seed-turno-NN"); un id inexistente lo resuelve el servicio con 404,
  // igual que GET /api/turnos/[id] y PATCH .../configuracion.
  const parsed = AgregarAlumnoTurnoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  try {
    return NextResponse.json({ data: await agregarAlumnoTurno(id, parsed.data, req.auth!.user.id), error: null });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) } }, { status: error.code === "TURNO_NO_ENCONTRADO" ? 404 : 409 });
    throw error;
  }
});
