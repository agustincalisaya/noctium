import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";
import { AnularResultadoExamenSchema } from "@/server/historial/resultado-examen.schema";
import { anularResultadoExamen } from "@/server/historial/resultado-examen.service";

export const POST = withPermission("examenes:corregir", async (req, ctx) => {
  const { id, examenId } = await ctx.params as { id: string; examenId: string };
  const parsed = AnularResultadoExamenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() },
    }, { status: 400 });
  }

  try {
    const resultado = await anularResultadoExamen(id, examenId, parsed.data, req.auth!.user);
    return NextResponse.json({ data: resultado, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof ErrorDeDominio) {
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof ServiceError && error.code === "SIN_PERMISO") {
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: 403 });
    }
    throw error;
  }
});
