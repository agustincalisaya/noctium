import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { ActualizarPrioridadSchema } from "@/server/turnos/turno.schema";
import { actualizarPrioridadTurno } from "@/server/turnos/turno.service";

export const PATCH = withPermission("turnos:priorizar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = ActualizarPrioridadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Datos inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  try {
    return NextResponse.json({ data: await actualizarPrioridadTurno(id, parsed.data, req.auth!.user.id), error: null });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, {
      status: error.code === "TURNO_NO_ENCONTRADO" ? 404 : 409,
    });
    throw error;
  }
});
