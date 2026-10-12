import { NextResponse } from "next/server";
import { flattenError, type ZodError } from "zod";
import { obtenerIp } from "@/auth";
import { texto } from "@/lib/textos";
import { construirAltaGerenteSchema } from "@/server/gerentes/gerente.schema";
import { crearGerente, listarGerentes } from "@/server/gerentes/gerente.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { getParametroNumerico } from "@/server/shared/parametros";
import { withPermission } from "@/server/shared/with-permission";

// Gerentes (spec_modulo_G.md §2.1 y §2.3, HU-G-01). Capa delgada (Regla N.° 4):
// permiso, Zod (Regla N.° 6), servicio y { data, error } (Regla N.° 5). Solo
// GERENTE tiene `gerentes:*`; withPermission responde 401 y 403 y agrega
// `Cache-Control: no-store` a toda respuesta.

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
  // Nunca un detalle técnico en el cuerpo.
  return NextResponse.json(
    { data: null, error: { code: "ERROR_INTERNO", message: texto("errores.gerente.interno") } },
    { status: 500 },
  );
}

/**
 * Listado mínimo (HU-G-01, DEC-38): todas las fichas, sin query. La búsqueda
 * y la paginación (`?pagina=&q=`) las suma HU-G-03.
 */
export const GET = withPermission("gerentes:leer", async () => {
  try {
    return NextResponse.json({ data: await listarGerentes(), error: null }, { status: 200 });
  } catch (error) {
    return errorDelServicio(error);
  }
});

/**
 * Alta con cuenta de acceso (HU-G-01 c1 a c3, c5 y c6; HU-A-06 c1 y c2).
 * `201` con la ficha y su `cuenta` (`ResumenCuenta`), nunca la contraseña
 * inicial. La IP va al evento CUENTA_CREADA.
 */
export const POST = withPermission("gerentes:crear", async (req) => {
  const body: unknown = await req.json().catch(() => undefined);
  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);
  const parsed = construirAltaGerenteSchema(dniLongitudMin, dniLongitudMax).safeParse(body);
  if (!parsed.success) return validacion(parsed.error);

  try {
    const gerente = await crearGerente(parsed.data, req.auth!.user.id, obtenerIp(req));
    return NextResponse.json({ data: gerente, error: null }, { status: 201 });
  } catch (error) {
    return errorDelServicio(error);
  }
});
