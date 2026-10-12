import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { ReactivarAlumnoSchema } from "@/server/alumnos/alumno.schema";
import { reactivarAlumno } from "@/server/alumnos/alumno.estado.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { actorUsuario } from "@/server/shared/historial";
import { withPermission } from "@/server/shared/with-permission";

export const POST = withPermission("alumnos:cambiar_estado", async (req, ctx) => {
  try {
    const { id } = await ctx.params as { id: string };
    const parsed = ReactivarAlumnoSchema.safeParse(await req.json().catch(() => undefined));
    if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Revisá los datos ingresados", detalles: flattenError(parsed.error) } }, { status: 400 });
    return NextResponse.json({ data: await reactivarAlumno(id, parsed.data, actorUsuario(req.auth!.user.id)), error: null });
  } catch (error) {
    if (error instanceof ErrorDeDominio) return NextResponse.json({ data: null, error: { code: error.code, message: error.message, ...error.datos } }, { status: error.status });
    console.error("[HU-B-07]", error);
    return NextResponse.json({ data: null, error: { code: "ERROR_INTERNO", message: "No se pudo reactivar el alumno" } }, { status: 500 });
  }
});
