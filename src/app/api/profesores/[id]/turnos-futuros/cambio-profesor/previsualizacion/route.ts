import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { texto } from "@/lib/textos";
import { withPermission } from "@/server/shared/with-permission";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { previsualizarCambioDeProfesor } from "@/server/profesores/profesor.estado.service";
import { CambiarProfesorLoteSchema } from "@/server/profesores/profesor.schema";

export const POST = withPermission("profesores:cambiar_estado", async (req, ctx) => {
  try {
    const { id } = await ctx.params as { id: string };
    const parsed = CambiarProfesorLoteSchema.safeParse(await req.json().catch(() => undefined));
    if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: texto("ui.profesores.estado.datosInvalidos"), detalles: flattenError(parsed.error) } }, { status: 400 });
    return NextResponse.json({ data: await previsualizarCambioDeProfesor(id, parsed.data), error: null });
  } catch (error) {
    if (error instanceof ErrorDeDominio) return NextResponse.json({ data: null, error: { code: error.code, message: error.message, ...error.datos } }, { status: error.status });
    console.error("[HU-D-08]", error);
    return NextResponse.json({ data: null, error: { code: "ERROR_INTERNO", message: texto("ui.profesores.estado.error") } }, { status: 500 });
  }
});
