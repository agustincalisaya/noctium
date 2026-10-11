import { NextResponse } from "next/server";
import { flattenError, type ZodError } from "zod";
import { obtenerIp } from "@/auth";
import { texto } from "@/lib/textos";
import { ListarPersonalQuerySchema, construirAltaIntegranteSchema } from "@/server/personal/personal.schema";
import { crearIntegrante, listarPersonal } from "@/server/personal/personal.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { getParametroNumerico } from "@/server/shared/parametros";
import { withPermission } from "@/server/shared/with-permission";

// Personal de mesa de entrada (spec_modulo_F.md §2.1 y §2.3, HU-F-01). Capa
// delgada (Regla N.° 4): permiso, Zod (Regla N.° 6), servicio y { data, error }
// (Regla N.° 5). Solo GERENTE tiene `personal:*`; withPermission responde 401
// y 403 y agrega `Cache-Control: no-store` a toda respuesta.

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
  // Nunca un detalle técnico en el cuerpo.
  return NextResponse.json(
    { data: null, error: { code: "ERROR_INTERNO", message: texto("errores.personal.interno") } },
    { status: 500 },
  );
}

/**
 * Listado con búsqueda y paginación (spec_modulo_F.md §2.3, HU-F-03):
 * `?pagina=&q=`. Cualquier otro parámetro (incluido `por_pagina`, que es fijo)
 * es 400 `VALIDATION_ERROR`.
 */
export const GET = withPermission("personal:leer", async (req) => {
  const parsed = ListarPersonalQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return validacion(parsed.error);

  try {
    return NextResponse.json({ data: await listarPersonal(parsed.data), error: null }, { status: 200 });
  } catch (error) {
    return errorDelServicio(error);
  }
});

/**
 * Alta con cuenta de acceso (HU-F-01 c1 a c4 y c6, HU-A-06 c1 y c2). `201` con
 * la ficha y su `cuenta` (`ResumenCuenta`), nunca la contraseña inicial. La IP
 * va al evento CUENTA_CREADA.
 */
export const POST = withPermission("personal:crear", async (req) => {
  const body: unknown = await req.json().catch(() => undefined);
  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);
  const parsed = construirAltaIntegranteSchema(dniLongitudMin, dniLongitudMax).safeParse(body);
  if (!parsed.success) return validacion(parsed.error);

  try {
    const integrante = await crearIntegrante(parsed.data, req.auth!.user.id, obtenerIp(req));
    return NextResponse.json({ data: integrante, error: null }, { status: 201 });
  } catch (error) {
    return errorDelServicio(error);
  }
});
