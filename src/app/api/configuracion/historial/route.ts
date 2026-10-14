import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { texto } from "@/lib/textos";
import { ListarHistorialQuerySchema } from "@/server/configuracion/configuracion.schema";
import { listarHistorialConfiguracion } from "@/server/configuracion/configuracion.service";
import { withPermission } from "@/server/shared/with-permission";

export const GET = withPermission("configuracion:leer", async (req) => {
  const parsed = ListarHistorialQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ data: null, error: {
    code: "VALIDATION_ERROR", message: texto("errores.configuracion.datosInvalidos"), detalles: flattenError(parsed.error),
  } }, { status: 400 });
  try {
    return NextResponse.json({ data: await listarHistorialConfiguracion(parsed.data), error: null });
  } catch (error) {
    console.error("[configuracion] falló la lectura del historial", error);
    return NextResponse.json({ data: null, error: {
      code: "INTERNAL_ERROR", message: texto("errores.configuracion.interno"),
    } }, { status: 500 });
  }
});
