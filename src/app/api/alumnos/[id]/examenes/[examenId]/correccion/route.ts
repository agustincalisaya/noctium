import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";
import { CorregirResultadoExamenSchema } from "@/server/historial/resultado-examen.schema";
import { corregirResultadoExamen } from "@/server/historial/resultado-examen.service";

const ESTADOS: Record<string, number> = {
  SIN_PERMISO: 403,
  FECHA_EXAMEN_FUTURA: 400,
  NOTA_FUERA_DE_RANGO: 422,
};

export const POST = withPermission("examenes:corregir", async (req, ctx) => {
  const { id, examenId } = await ctx.params as { id: string; examenId: string };
  const parsed = CorregirResultadoExamenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() },
    }, { status: 400 });
  }

  try {
    const resultado = await corregirResultadoExamen(id, examenId, parsed.data, req.auth!.user);
    return NextResponse.json({ data: resultado, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof ErrorDeDominio) {
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof ServiceError && error.code in ESTADOS) {
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: ESTADOS[error.code] });
    }
    throw error;
  }
});
