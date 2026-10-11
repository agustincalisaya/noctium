import { NextResponse, type NextRequest } from "next/server";
import { flattenError } from "zod";
import { obtenerIp } from "@/auth";
import { texto } from "@/lib/textos";
import { SolicitarRecuperacionSchema } from "@/server/sesion/sesion.schema";
import { solicitarRecuperacion } from "@/server/sesion/recuperacion.service";
import { programarProcesamientoRecuperacion } from "@/server/sesion/recuperacion.tarea";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// Pedir el enlace de recuperación (HU-A-05, spec_modulo_A.md §2.7.1). Público:
// no pasa por withPermission() y el proxy no lo toca, igual que logout. Capa
// delgada (Regla N.° 4): Zod, servicio y, si la solicitud entró, la tarea de
// después de responder. La respuesta es la misma para una cuenta inexistente,
// inactiva, activa o una solicitud limitada (§3.10); el formato inválido es el
// único caso distinto. Toda respuesta lleva `Cache-Control: no-store` (§3.11).

const SIN_CACHE = { "Cache-Control": "no-store, must-revalidate" };

function responder(cuerpo: unknown, status: number) {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = SolicitarRecuperacionSchema.safeParse(body);
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
    const ip = obtenerIp(request);
    const { entro } = await solicitarRecuperacion(parsed.data.email, ip);
    if (entro) programarProcesamientoRecuperacion(parsed.data.email, ip);
    return responder({ data: { solicitada: true }, error: null }, 200);
  } catch (error) {
    // El bloqueo por email agotó su tiempo: 409 TRANSACCION_OCUPADA (depende solo del email).
    if (error instanceof ErrorDeDominio) {
      return responder({ data: null, error: { code: error.code, message: error.message } }, error.status);
    }
    return responder({ data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } }, 500);
  }
}
