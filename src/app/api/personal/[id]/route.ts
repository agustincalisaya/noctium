import { NextResponse } from "next/server";
import { flattenError, type ZodError } from "zod";
import { texto } from "@/lib/textos";
import { construirModificarIntegranteSchema } from "@/server/personal/personal.schema";
import { modificarIntegrante, obtenerDetalleIntegrante } from "@/server/personal/personal.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { getParametroNumerico } from "@/server/shared/parametros";
import { withPermission } from "@/server/shared/with-permission";

// Ficha de un integrante de mesa de entrada (spec_modulo_F.md §2.2 y §2.4,
// HU-F-01). Capa delgada (Regla N.° 4); 401 y 403 los responde withPermission,
// que agrega `Cache-Control: no-store`. Un id inexistente es 404
// INTEGRANTE_NO_ENCONTRADO (lo lanza el servicio).

function validacion(error: ZodError) {
  return NextResponse.json(
    {
      data: null,
      error: { code: "VALIDATION_ERROR", message: texto("errores.personal.datosInvalidos"), detalles: flattenError(error).fieldErrors },
    },
    { status: 400 },
  );
}

function errorDelServicio(error: unknown) {
  if (error instanceof ErrorDeDominio) {
    return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return NextResponse.json(
    { data: null, error: { code: "ERROR_INTERNO", message: texto("errores.personal.interno") } },
    { status: 500 },
  );
}

/** Detalle con `version`, fechas y «Cuenta de acceso» (`ResumenCuenta`). */
export const GET = withPermission("personal:leer", async (_req, ctx) => {
  const { id } = (await ctx.params) as { id: string };
  try {
    return NextResponse.json({ data: await obtenerDetalleIntegrante(id), error: null }, { status: 200 });
  } catch (error) {
    return errorDelServicio(error);
  }
});

/**
 * Modificación (HU-F-01 c5, HU-A-06 c6): campo ausente = no se toca, `version`
 * obligatoria. `200` con `campos_modificados` (vacío si nada cambió).
 */
export const PATCH = withPermission("personal:editar", async (req, ctx) => {
  const { id } = (await ctx.params) as { id: string };
  const body: unknown = await req.json().catch(() => undefined);
  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);
  const parsed = construirModificarIntegranteSchema(dniLongitudMin, dniLongitudMax).safeParse(body);
  if (!parsed.success) return validacion(parsed.error);

  try {
    const resultado = await modificarIntegrante(id, parsed.data, req.auth!.user.id);
    return NextResponse.json({ data: resultado, error: null }, { status: 200 });
  } catch (error) {
    return errorDelServicio(error);
  }
});
