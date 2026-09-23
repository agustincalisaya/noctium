import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ConfigurarTurnoSchema } from "@/server/turnos/turno.schema";
import { modificarConfiguracionTurno } from "@/server/turnos/turno.service";
import { ServiceError } from "@/server/shared/service-error";

export const PATCH = withPermission("turnos:crear", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = ConfigurarTurnoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  try {
    return NextResponse.json({ data: await modificarConfiguracionTurno(id, parsed.data, req.auth!.user.id), error: null });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.code === "TURNO_NO_ENCONTRADO" ? 404 : ["TURNO_YA_AGENDADO", "TURNO_MODIFICADO", "MATERIA_NO_DISPONIBLE"].includes(error.code) ? 409 : 422 });
    throw error;
  }
});
