import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { RangoIndicadoresQuerySchema } from "@/server/indicadores/indicadores.schema";
import { obtenerClasesPorProfesor } from "@/server/indicadores/clases.service";

export const GET = withPermission("indicadores:leer", async (req) => {
  const parsed = RangoIndicadoresQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({
      data: null,
      error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos", detalles: parsed.error.flatten() },
    }, { status: 400 });
  }

  const data = await obtenerClasesPorProfesor(parsed.data);
  return NextResponse.json({ data, error: null });
});
