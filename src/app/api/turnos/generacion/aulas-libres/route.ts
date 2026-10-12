import { NextResponse } from "next/server";
import { texto as textoC19 } from "@/lib/textos";
import { withPermission } from "@/server/shared/with-permission";
import { AulasLibresQuerySchema } from "@/server/turnos/turno.generacion.schema";
import { aulasLibresParaGeneracion } from "@/server/turnos/turno.generacion.aulas";

/** HU-C-21 (4.4): aulas activas libres para una fecha y horario de la generación. Solo lectura. */
export const GET = withPermission("turnos:crear", async (req) => {
  const parsed = AulasLibresQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: textoC19("ui.clases.generacion.errores.parametrosInvalidos"), detalles: parsed.error.flatten() } }, { status: 400 });
  }
  return NextResponse.json({ data: await aulasLibresParaGeneracion(parsed.data), error: null });
});
