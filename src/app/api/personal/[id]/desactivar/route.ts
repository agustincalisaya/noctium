import { NextResponse } from "next/server";
import { flattenError, type ZodError } from "zod";
import { texto } from "@/lib/textos";
import { DesactivarIntegranteSchema } from "@/server/personal/personal.schema";
import { desactivarIntegrante } from "@/server/personal/personal.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { actorUsuario } from "@/server/shared/historial";
import { withPermission } from "@/server/shared/with-permission";

// Baja de un integrante de mesa de entrada (spec_modulo_F.md §2.5, HU-F-05).
// Capa delgada (Regla N.° 4): 401 y 403 los responde withPermission; los 404,
// 409 y el 400 MOTIVO_REQUERIDO los lanza el servicio.

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

/** `{ motivo?, version }`. `200` con `{ id, activo: false, version }`. */
export const POST = withPermission("personal:cambiar_estado", async (req, ctx) => {
  const { id } = (await ctx.params) as { id: string };
  const parsed = DesactivarIntegranteSchema.safeParse(await req.json().catch(() => undefined));
  if (!parsed.success) return validacion(parsed.error);

  try {
    const resultado = await desactivarIntegrante(id, parsed.data, actorUsuario(req.auth!.user.id));
    return NextResponse.json({ data: resultado, error: null }, { status: 200 });
  } catch (error) {
    return errorDelServicio(error);
  }
});
