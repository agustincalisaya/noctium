import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { CorregirAsistenciaSchema } from "@/server/historial/clase-dictada.schema";
import { corregirAsistenciaClaseDictada } from "@/server/historial/clase-dictada.service";
export const POST = withPermission("clases:corregir", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const json: unknown = await req.json().catch(() => null);
  const parsed = CorregirAsistenciaSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  try {
    const data = await corregirAsistenciaClaseDictada(id, req.auth!.user, parsed.data);
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error instanceof ErrorDeDominio ? error.status : error.code === "SIN_PERMISO" ? 403 : error.code === "CLASE_NO_REGISTRADA" ? 404 : null;
      if (status) return NextResponse.json({ data: null, error: { code: error.code, message: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) } }, { status });
    }
    throw error;
  }
});
