import { NextResponse } from "next/server";
import { texto } from "@/lib/textos";
import { withPermission } from "@/server/shared/with-permission";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { obtenerImpactoBajaProfesor } from "@/server/profesores/profesor.estado.service";

export const GET = withPermission("profesores:cambiar_estado", async (req, ctx) => {
  try {
    const { id } = await ctx.params as { id: string };
    return NextResponse.json({ data: await obtenerImpactoBajaProfesor(id), error: null });
  } catch (error) {
    if (error instanceof ErrorDeDominio) return NextResponse.json({ data: null, error: { code: error.code, message: error.message, ...error.datos } }, { status: error.status });
    console.error("[HU-D-08]", error);
    return NextResponse.json({ data: null, error: { code: "ERROR_INTERNO", message: texto("ui.profesores.estado.error") } }, { status: 500 });
  }
});
