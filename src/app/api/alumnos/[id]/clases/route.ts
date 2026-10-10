import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { ClasesAlumnoQuerySchema } from "@/server/historial/clases-alumno.schema";
import { listarClasesDelAlumno } from "@/server/historial/clases-alumno.service";
export const GET = withPermission("alumnos:leer", async (req, ctx) => {
  if (!["MESA_ENTRADA", "GERENTE"].includes(req.auth!.user.rol)) return NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "No tenés permisos para consultar las clases de este alumno" } }, { status: 403 });
  const { id } = await ctx.params as { id: string };
  const parsed = ClasesAlumnoQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Parámetros inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  try { return NextResponse.json({ data: await listarClasesDelAlumno(id, parsed.data, req.auth!.user), error: null }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    if (error instanceof ServiceError && ["SIN_PERMISO", "ALUMNO_NO_ENCONTRADO"].includes(error.code)) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.code === "SIN_PERMISO" ? 403 : 404 });
    throw error;
  }
});
