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
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: ["TURNO_NO_ENCONTRADO", "PROFESOR_NO_ENCONTRADO"].includes(error.code) ? 404 : ["TURNO_YA_DISPONIBLE", "TURNO_MODIFICADO", "MATERIA_NO_DISPONIBLE", "CUPO_MENOR_A_INSCRIPTOS", "PROFESOR_NO_DICTA_MATERIA", "PROFESOR_FUERA_DE_HORARIO", "PROFESOR_NO_DISPONIBLE"].includes(error.code) ? 409 : 422 });
    throw error;
  }
});
