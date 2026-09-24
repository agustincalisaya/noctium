"use server";

import { headers } from "next/headers";
import { flattenError } from "zod";
import {
  construirAutorregistroAlumnoSchema,
  VerificarCodigoAutorregistroSchema,
  ReenviarCodigoAutorregistroSchema,
} from "@/server/alumnos/alumno.schema";
import {
  iniciarAutorregistro as iniciarAutorregistroEnServicio,
  confirmarCodigoAutorregistro as confirmarCodigoAutorregistroEnServicio,
  reenviarCodigoAutorregistro as reenviarCodigoAutorregistroEnServicio,
} from "@/server/alumnos/autorregistro.service";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico } from "@/server/shared/parametros";
import type {
  ResultadoAutorregistro,
  ResultadoConfirmacionAutorregistro,
  ResultadoReenvioCodigo,
} from "@/types/alumno.types";

const MENSAJE_ERROR_INTERNO = "No se pudo completar la operación";

type ResultadoGenerico<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string; detalles?: unknown } };

/**
 * Mismo cálculo que `obtenerIp()` de `src/auth.ts`, duplicado acá a
 * propósito: una Server Action no recibe un `Request` (a diferencia de un
 * Route Handler), solo `headers()` de `next/headers` — y este archivo no
 * debía tocar `src/auth.ts` (Módulo A) más allá de lo ya autorizado
 * (`crearCuentaConCredenciales()` en `usuario.service.ts`).
 */
async function obtenerIpDesdeHeaders(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Server Action equivalente a `POST /api/auth/autorregistro` (HU-B-08,
 * spec_modulo_B.md §2.6). Ninguna de las 3 actions de este archivo está
 * ligada a `useActionState` (a diferencia de `iniciarSesion` de
 * `login-form.tsx`, que sí tiene un shape custom por su UX específica) —
 * aplica el shape genérico `{ data, error }` de la Regla N.° 5 de
 * `docs/RULES.md`. Sin `verificarPermiso()`: superficie pública, sin
 * sesión, la cuenta ni existe todavía.
 *
 * A diferencia de `crearAlumno()`/`modificarAlumno()` de
 * `src/server/alumnos/actions.ts` (que relanzan un error no-`ServiceError`,
 * confiando en que el formulario que las invoca lo atrapa con su propio
 * `try/catch`): acá cualquier error que no sea `ServiceError` se traduce a
 * `ERROR_INTERNO` en vez de relanzarse — mismo criterio que los route
 * handlers hermanos (`POST /api/auth/autorregistro`, etc.). No hay
 * `error.tsx` bajo `src/app/(auth)/` (ni uno raíz en el repo) y el
 * formulario de `/registro` todavía no existe, así que no hay ningún
 * boundary que garantice ocultar el detalle técnico si se relanzara
 * (criterio 9 de la HU: nunca un detalle técnico en un error de
 * comunicación).
 */
export async function iniciarAutorregistro(input: unknown): Promise<ResultadoGenerico<ResultadoAutorregistro>> {
  const [dniLongitudMin, dniLongitudMax, passwordLongitudMinima] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
    getParametroNumerico("password_longitud_minima", 8),
  ]);

  const parsed = construirAutorregistroAlumnoSchema(
    dniLongitudMin,
    dniLongitudMax,
    passwordLongitudMinima,
  ).safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(parsed.error) },
    };
  }

  try {
    const ip = await obtenerIpDesdeHeaders();
    const resultado = await iniciarAutorregistroEnServicio(parsed.data, ip);
    return { data: resultado, error: null };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    // Nunca se relanza (a diferencia de crearAlumno()/modificarAlumno()):
    // no hay error.tsx bajo (auth)/ ni formulario propio todavía que
    // atrape esto con un mensaje seguro (criterio 9 de la HU).
    return { data: null, error: { code: "ERROR_INTERNO", message: MENSAJE_ERROR_INTERNO } };
  }
}

/** Server Action equivalente a `POST /api/auth/autorregistro/verificar-codigo`. */
export async function confirmarCodigoAutorregistro(
  input: unknown,
): Promise<ResultadoGenerico<ResultadoConfirmacionAutorregistro>> {
  const parsed = VerificarCodigoAutorregistroSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(parsed.error) },
    };
  }

  try {
    const ip = await obtenerIpDesdeHeaders();
    const resultado = await confirmarCodigoAutorregistroEnServicio(
      parsed.data.solicitud_id,
      parsed.data.codigo,
      ip,
    );
    return { data: resultado, error: null };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    // Nunca se relanza (a diferencia de crearAlumno()/modificarAlumno()):
    // no hay error.tsx bajo (auth)/ ni formulario propio todavía que
    // atrape esto con un mensaje seguro (criterio 9 de la HU).
    return { data: null, error: { code: "ERROR_INTERNO", message: MENSAJE_ERROR_INTERNO } };
  }
}

/** Server Action equivalente a `POST /api/auth/autorregistro/reenviar-codigo`. */
export async function reenviarCodigoAutorregistro(
  input: unknown,
): Promise<ResultadoGenerico<ResultadoReenvioCodigo>> {
  const parsed = ReenviarCodigoAutorregistroSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(parsed.error) },
    };
  }

  try {
    const ip = await obtenerIpDesdeHeaders();
    const resultado = await reenviarCodigoAutorregistroEnServicio(parsed.data.solicitud_id, ip);
    return { data: resultado, error: null };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    // Nunca se relanza (a diferencia de crearAlumno()/modificarAlumno()):
    // no hay error.tsx bajo (auth)/ ni formulario propio todavía que
    // atrape esto con un mensaje seguro (criterio 9 de la HU).
    return { data: null, error: { code: "ERROR_INTERNO", message: MENSAJE_ERROR_INTERNO } };
  }
}
