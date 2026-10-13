import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { PaginaQuerySchema } from "@/server/pagos/caja.schema";
import { listarMisCierres } from "@/server/pagos/caja.lecturas";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/** HU-I-12 (spec_modulo_I.md §2.12): «Mis cierres», paginados de a 10. */
export const GET = withPermission("cajas:leer", async (req) => {
  const query = Object.fromEntries([...req.nextUrl.searchParams].filter(([, valor]) => valor.trim() !== ""));
  const parsed = PaginaQuerySchema.safeParse(query);
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten());
  try {
    const data = await listarMisCierres(req.auth!.user.id, parsed.data.pagina);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
