import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { AbrirCajaSchema, ListarCajasQuerySchema } from "@/server/pagos/caja.schema";
import { abrirMiCaja } from "@/server/pagos/caja.flujos";
import { listarCajasYCierres } from "@/server/pagos/caja.lecturas";
import { respuestaDeError, respuestaDeValidacion } from "@/app/api/pagos/respuesta-error";

/** HU-I-12 (spec_modulo_I.md §2.10.1): abre la caja propia con su fondo inicial (puede ser 0). */
export const POST = withPermission("cajas:abrir", async (req) => {
  const parsed = AbrirCajaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten(), "Datos inválidos");
  try {
    const data = await abrirMiCaja(req.auth!.user.id, parsed.data.fondo_inicial);
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    return respuestaDeError(error);
  }
});

/**
 * HU-I-12 (spec_modulo_I.md §2.12, criterio 11): cajas abiertas con su
 * antigüedad y cierres paginados de a 10, filtrados por integrante y por
 * fecha de cierre. Solo el gerente. Un parámetro vacío equivale a no enviado.
 */
export const GET = withPermission("cajas:leer_todas", async (req) => {
  const query = Object.fromEntries([...req.nextUrl.searchParams].filter(([, valor]) => valor.trim() !== ""));
  const parsed = ListarCajasQuerySchema.safeParse(query);
  if (!parsed.success) return respuestaDeValidacion(parsed.error.flatten());
  const { integrante_id, desde, hasta, pagina } = parsed.data;
  try {
    const data = await listarCajasYCierres({ integranteId: integrante_id, desde, hasta, pagina });
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return respuestaDeError(error);
  }
});
