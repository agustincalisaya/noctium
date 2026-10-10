import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { BuscarAlumnosCobroQuerySchema } from "@/server/pagos/pago.schema";
import { buscarAlumnosParaCobro } from "@/server/pagos/pago.service";
import { respuestaDeValidacion } from "../respuesta-error";

/** HU-I-10 paso 1 (spec_modulo_I.md §2.7.1): alumnos activos para cobrar. */
export const GET = withPermission("pagos:crear", async (req) => {
  const parsed = BuscarAlumnosCobroQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten());
  return NextResponse.json({ data: await buscarAlumnosParaCobro(parsed.data.q), error: null });
});
