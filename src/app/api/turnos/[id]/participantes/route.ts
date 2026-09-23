import { NextResponse } from "next/server";
import { z } from "zod";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { AsignarParticipantesTurnoSchema } from "@/server/turnos/turno.schema";
import { asignarParticipantesTurno } from "@/server/turnos/turno.service";

export const PATCH = withPermission("turnos:asignar_participantes", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  if (!z.cuid().safeParse(id).success) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "ID de turno inválido" } }, { status: 400 });
  const parsed = AsignarParticipantesTurnoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  try {
    return NextResponse.json({ data: await asignarParticipantesTurno(id, parsed.data, req.auth!.user.id), error: null });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.code === "TURNO_NO_ENCONTRADO" || error.code === "SIN_PROFESORES_PARA_MATERIA" ? 404 : 409 });
    throw error;
  }
});
