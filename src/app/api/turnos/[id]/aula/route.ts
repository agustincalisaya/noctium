import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { AsignarAulaTurnoSchema } from "@/server/turnos/turno.schema";
import { asignarAulaTurno } from "@/server/turnos/turno.aula.service";

export const PATCH = withPermission("turnos:asignar_aula", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = AsignarAulaTurnoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  try {
    return NextResponse.json({ data: await asignarAulaTurno(id, parsed.data, req.auth!.user.id), error: null });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) } },
      { status: error.code === "TURNO_NO_ENCONTRADO" || error.code === "SIN_AULAS_ACTIVAS" || error.code === "AULA_NO_ENCONTRADA" ? 404 : 409 });
    throw error;
  }
});
