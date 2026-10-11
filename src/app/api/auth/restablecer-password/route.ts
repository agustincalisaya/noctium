import { NextResponse, type NextRequest } from "next/server";
import { flattenError } from "zod";
import { obtenerIp } from "@/auth";
import { texto } from "@/lib/textos";
import { construirRestablecerPasswordSchema } from "@/server/sesion/sesion.schema";
import { restablecerPassword } from "@/server/sesion/recuperacion.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { getParametroNumerico } from "@/server/shared/parametros";

// Definir la contraseña nueva con el enlace (HU-A-05, spec_modulo_A.md
// §2.7.3). Público: lo autoriza el enlace, no pasa por withPermission(). Capa
// delgada (Regla N.° 4): Zod con la política vigente, servicio y { data, error }
// (Regla N.° 5). No inicia sesión: la interfaz vuelve al login. Errores:
// 400 VALIDATION_ERROR, 410 ENLACE_INVALIDO, 422 PASSWORD_IGUAL_A_ACTUAL y
// 409 TRANSACCION_OCUPADA, con el status del catálogo. Toda respuesta lleva
// `Cache-Control: no-store` (§3.11) y ninguna devuelve el token.

const SIN_CACHE = { "Cache-Control": "no-store, must-revalidate" };

function responder(cuerpo: unknown, status: number) {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const longitudMinima = await getParametroNumerico("password_longitud_minima", 8);
  const parsed = construirRestablecerPasswordSchema(longitudMinima).safeParse(body);
  if (!parsed.success) {
    return responder(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: texto("errores.cuenta.datosInvalidos"), detalles: flattenError(parsed.error).fieldErrors },
      },
      400,
    );
  }

  try {
    await restablecerPassword(parsed.data, obtenerIp(request));
    return responder({ data: { restablecida: true }, error: null }, 200);
  } catch (error) {
    if (error instanceof ErrorDeDominio) {
      return responder({ data: null, error: { code: error.code, message: error.message } }, error.status);
    }
    return responder({ data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } }, 500);
  }
}
