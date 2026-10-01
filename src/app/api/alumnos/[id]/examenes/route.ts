import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { RegistrarResultadoExamenSchema } from "@/server/historial/resultado-examen.schema";
import { registrarResultadoExamen } from "@/server/historial/resultado-examen.service";

const ESTADOS: Record<string, number> = {
  SIN_PERMISO: 403,
  ALUMNO_NO_ENCONTRADO: 404,
  ALUMNO_INACTIVO: 409,
  MATERIA_NO_CURSADA: 409,
  FECHA_EXAMEN_FUTURA: 400,
  NOTA_FUERA_DE_RANGO: 422,
};

export const POST = withPermission("examenes:registrar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = RegistrarResultadoExamenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() },
    }, { status: 400 });
  }

  try {
    const resultado = await registrarResultadoExamen(id, parsed.data, req.auth!.user);
    return NextResponse.json({ data: resultado, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError && error.code in ESTADOS) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: ESTADOS[error.code] },
      );
    }
    throw error;
  }
});
