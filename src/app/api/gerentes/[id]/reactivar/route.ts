import { NextResponse } from "next/server";
import { flattenError, type ZodError } from "zod";
import { texto } from "@/lib/textos";
import { ReactivarGerenteSchema } from "@/server/gerentes/gerente.schema";
import { reactivarGerente } from "@/server/gerentes/gerente.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { actorUsuario } from "@/server/shared/historial";
import { withPermission } from "@/server/shared/with-permission";

// Reactivación de un gerente (spec_modulo_G.md §2.6, HU-G-05). Capa delgada
// (Regla N.° 4): 401 y 403 los responde withPermission; los 404 y 409 los
// lanza el servicio.

function validacion(error: ZodError) {
  return NextResponse.json(
    {
      data: null,
      error: { code: "VALIDATION_ERROR", message: texto("errores.gerente.datosInvalidos"), detalles: flattenError(error).fieldErrors },
    },
    { status: 400 },
  );
}

function errorDelServicio(error: unknown) {
  if (error instanceof ErrorDeDominio) {
    return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return NextResponse.json(
    { data: null, error: { code: "ERROR_INTERNO", message: texto("errores.gerente.interno") } },
    { status: 500 },
  );
}

/** `{ version }`; no pide motivo. `200` con `{ id, activo: true, version }`. */
export const POST = withPermission("gerentes:cambiar_estado", async (req, ctx) => {
  const { id } = (await ctx.params) as { id: string };
  const parsed = ReactivarGerenteSchema.safeParse(await req.json().catch(() => undefined));
  if (!parsed.success) return validacion(parsed.error);

  try {
    const resultado = await reactivarGerente(id, parsed.data, actorUsuario(req.auth!.user.id));
    return NextResponse.json({ data: resultado, error: null }, { status: 200 });
  } catch (error) {
    return errorDelServicio(error);
  }
});
