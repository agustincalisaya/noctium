import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { GenerarTurnosSchema } from "@/server/turnos/turno.generacion.schema";
import { vistaPreviaGeneracion } from "@/server/turnos/turno.generacion.service";

export const POST = withPermission("turnos:crear", async (req) => {
  const parsed = GenerarTurnosSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Datos inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  }
  try {
    return NextResponse.json({ data: await vistaPreviaGeneracion(parsed.data), error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = ["FUERA_DE_FRANJA", "RANGO_EXCEDIDO", "SIN_FECHAS_EN_RANGO"].includes(error.code) ? 400
        : ["PROFESOR_NO_ENCONTRADO", "HORARIO_NO_ENCONTRADO", "SIN_AULAS_ACTIVAS", "AULA_NO_ENCONTRADA"].includes(error.code) ? 404
          : error.code === "CONFIGURACION_GENERACION_INCOMPLETA" ? 503 : 409;
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status });
    }
    throw error;
  }
});
