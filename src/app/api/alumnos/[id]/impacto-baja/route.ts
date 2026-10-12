import { NextResponse } from "next/server";
import { obtenerImpactoBajaAlumno } from "@/server/alumnos/alumno.estado.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { withPermission } from "@/server/shared/with-permission";

export const GET = withPermission("alumnos:cambiar_estado", async (_req, ctx) => {
  try {
    const { id } = await ctx.params as { id: string };
    return NextResponse.json({ data: await obtenerImpactoBajaAlumno(id), error: null });
  } catch (error) {
    if (error instanceof ErrorDeDominio) return NextResponse.json({ data: null, error: { code: error.code, message: error.message, ...error.datos } }, { status: error.status });
    console.error("[HU-B-07]", error);
    return NextResponse.json({ data: null, error: { code: "ERROR_INTERNO", message: "No se pudo obtener el impacto de la baja" } }, { status: 500 });
  }
});
