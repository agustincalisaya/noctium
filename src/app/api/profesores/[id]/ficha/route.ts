import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { obtenerDetalleProfesor } from "@/server/profesores/profesor.service";

export const GET = withPermission("profesores:leer", async (_req, ctx) => {
  const { id } = (await ctx.params) as { id: string };
  try {
    const data = await obtenerDetalleProfesor(id);
    if (!data) return NextResponse.json({ data: null, error: { code: "PROFESOR_NO_ENCONTRADO", message: "No se encontró el profesor" } }, { status: 404 });
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } }, { status: 500 });
  }
});
