import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { IndicadoresQuerySchema } from "@/server/indicadores/indicadores.schema";
import { obtenerIndicadoresMensuales } from "@/server/indicadores/indicadores.service";

export const GET = withPermission("indicadores:leer", async (req) => {
  const parsed = IndicadoresQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({
      data: null,
      error: { code: "VALIDACION", message: "Parámetros inválidos", detalles: parsed.error.flatten() },
    }, { status: 400 });
  }

  const data = await obtenerIndicadoresMensuales(parsed.data);
  return NextResponse.json({ data, error: null });
});
