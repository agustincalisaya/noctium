"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CredentialsSignin } from "next-auth";
import { flattenError } from "zod";
import { auth, obtenerIp, signIn } from "@/auth";
import { texto } from "@/lib/textos";
import {
  CredencialesLoginSchema,
  SolicitarRecuperacionSchema,
  construirCambiarPasswordSchema,
  construirRestablecerPasswordSchema,
} from "@/server/sesion/sesion.schema";
import { cambiarPasswordPropia as cambiarPasswordPropiaEnServicio } from "@/server/sesion/cambio-password.service";
import {
  restablecerPassword as restablecerPasswordEnServicio,
  solicitarRecuperacion as solicitarRecuperacionEnServicio,
} from "@/server/sesion/recuperacion.service";
import { programarProcesamientoRecuperacion } from "@/server/sesion/recuperacion.tarea";
import { getParametroNumerico } from "@/server/shared/parametros";
import { RUTA_PRIMER_INGRESO } from "@/server/shared/rutas-por-rol";
import { ServiceError } from "@/server/shared/service-error";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerEstadoCuenta } from "@/server/usuarios/cuenta.service";
import type {
  EstadoCambioPassword,
  EstadoLogin,
  EstadoRestablecerPassword,
  EstadoSolicitudRecuperacion,
} from "@/types/sesion.types";

// Traducción código de servicio -> texto exacto para el usuario (spec_modulo_A.md §2.1).
// Vive acá, no en el servicio, para no acoplar la capa de negocio al copy de UI.
const MENSAJES_POR_CODIGO: Record<string, string> = {
  CREDENCIALES_INVALIDAS: "Usuario o contraseña incorrectos",
  CUENTA_INACTIVA: "La cuenta está inactiva. Comunicate con la administración",
  RATE_LIMIT_EXCEDIDO: "Demasiados intentos. Esperá unos minutos e intentá nuevamente",
};

export async function iniciarSesion(
  _estadoAnterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const emailIngresado = String(formData.get("email") ?? "");
  const parsed = CredencialesLoginSchema.safeParse({
    email: emailIngresado,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error_validacion",
      errores: parsed.error.flatten().fieldErrors,
      email: emailIngresado,
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      const mensaje = MENSAJES_POR_CODIGO[error.code] ?? MENSAJES_POR_CODIGO.CREDENCIALES_INVALIDAS!;
      return { status: "error", mensaje, email: parsed.data.email };
    }
    // Error de comunicación/infraestructura: nunca un detalle técnico (criterio 6).
    return { status: "error_comunicacion", email: parsed.data.email };
  }

  const session = await auth();
  // HU-A-06 (spec_modulo_A.md §2.6.2): con la marca «Debe cambiar la
  // contraseña», antes de cualquier otra pantalla. La marca se acaba de leer
  // de la cuenta en el callback `jwt` de este mismo ingreso.
  if (!session?.user) redirect("/login");
  redirect(session.user.debeCambiarPassword ? RUTA_PRIMER_INGRESO : "/home");
}

/**
 * Texto del rechazo de cada código de `cambiarPasswordPropia`, junto al campo
 * que corresponde. PASSWORD_IGUAL_A_ACTUAL depende de la pantalla: en el
 * primer ingreso la contraseña vigente es el DNI (spec_modulo_A.md §2.6.3).
 */
function errorDeCambio(error: ServiceError, primerIngreso: boolean): EstadoCambioPassword {
  switch (error.code) {
    case "PASSWORD_ACTUAL_INCORRECTA":
      return { status: "error_validacion", errores: { password_actual: [texto("errores.cuenta.passwordActualIncorrecta")] } };
    case "PASSWORD_IGUAL_A_ACTUAL":
      return {
        status: "error_validacion",
        errores: {
          password_nueva: [texto(primerIngreso ? "ui.sesion.primerIngreso.igualDni" : "errores.cuenta.passwordIgualActual")],
        },
      };
    case "VALIDATION_ERROR":
      // El servicio solo llega acá sin contraseña actual: el resto ya lo
      // rechazó el schema de esta acción.
      return { status: "error_validacion", errores: { password_actual: [texto("ui.sesion.formPassword.actualRequerida")] } };
    case "RATE_LIMIT_EXCEDIDO":
      return { status: "error", mensaje: texto("errores.sesion.rateLimitExcedido") };
    case "TRANSACCION_OCUPADA":
      return { status: "error", mensaje: texto("errores.transaccion.ocupada") };
    default:
      return { status: "error", mensaje: texto("ui.sesion.formPassword.errorComunicacion") };
  }
}

/**
 * Cambio de la propia contraseña, primer ingreso y «Mi cuenta» (HU-A-06,
 * spec_modulo_A.md §2.6.3). Capa delgada (Regla N.° 4) con la firma de
 * `useActionState` (excepción de la Regla N.° 5): permiso, Zod, servicio y,
 * después del commit, la reemisión de la sesión (P-A1).
 *
 * El permiso se verifica con `verificarPermiso`, que no renueva la cookie y
 * por eso no choca con la reemisión. La cuenta sale siempre de la sesión.
 *
 * La reemisión pasa por el login normal (`signIn` con la contraseña nueva,
 * desde el servidor): el token nuevo trae `iat_sesion = ahora` y sin la
 * marca, y se registra un LOGIN_EXITOSO. Las demás sesiones quedan por
 * debajo de `sesionesValidasDesde` y caen en su próxima solicitud. Si la
 * reemisión falla, el cambio ya está hecho: `sesion_conservada: false`.
 */
export async function cambiarPasswordPropia(
  _estadoAnterior: EstadoCambioPassword,
  formData: FormData,
): Promise<EstadoCambioPassword> {
  let usuarioId: string;
  try {
    ({ id: usuarioId } = await verificarPermiso("cuenta:cambiar_password"));
  } catch (error) {
    if (error instanceof PermisoError) return { status: "error", mensaje: error.message };
    return { status: "error", mensaje: texto("ui.sesion.formPassword.errorComunicacion") };
  }

  try {
    const longitudMinima = await getParametroNumerico("password_longitud_minima", 8);
    const parsed = construirCambiarPasswordSchema(longitudMinima).safeParse({
      password_actual: formData.get("password_actual") ?? undefined,
      password_nueva: formData.get("password_nueva"),
      confirmacion: formData.get("confirmacion"),
    });
    if (!parsed.success) {
      return { status: "error_validacion", errores: flattenError(parsed.error).fieldErrors };
    }

    const cuenta = await obtenerEstadoCuenta(usuarioId);
    if (!cuenta) return { status: "error", mensaje: texto("ui.sesion.formPassword.errorComunicacion") };
    const primerIngreso = cuenta.debe_cambiar_password;

    let reemitir: boolean;
    try {
      ({ reemitir_sesion: reemitir } = await cambiarPasswordPropiaEnServicio(parsed.data, usuarioId, await ipDeLaSolicitud()));
    } catch (error) {
      if (error instanceof ServiceError) return errorDeCambio(error, primerIngreso);
      throw error;
    }

    if (!reemitir) return { status: "exito", sesion_conservada: false };
    try {
      await signIn("credentials", { email: cuenta.email, password: parsed.data.password_nueva, redirect: false });
      return { status: "exito", sesion_conservada: true };
    } catch {
      return { status: "exito", sesion_conservada: false };
    }
  } catch {
    // Error de comunicación o de infraestructura: nunca un detalle técnico.
    return { status: "error", mensaje: texto("ui.sesion.formPassword.errorComunicacion") };
  }
}

/**
 * Pedir el enlace de recuperación (HU-A-05, spec_modulo_A.md §2.7.1). Capa
 * delgada, equivalente a `POST /api/auth/recuperar-password`: Zod, servicio
 * y, si la solicitud entró, la tarea de después de responder. Devuelve
 * `enviada` exista o no la cuenta y también con la solicitud limitada
 * (§3.10); solo el formato inválido responde distinto.
 */
export async function solicitarRecuperacion(
  _estadoAnterior: EstadoSolicitudRecuperacion,
  formData: FormData,
): Promise<EstadoSolicitudRecuperacion> {
  const parsed = SolicitarRecuperacionSchema.safeParse({ email: formData.get("email") ?? "" });
  if (!parsed.success) return { status: "error_validacion", errores: flattenError(parsed.error).fieldErrors };

  try {
    const ip = await ipDeLaSolicitud();
    const { entro } = await solicitarRecuperacionEnServicio(parsed.data.email, ip);
    if (entro) programarProcesamientoRecuperacion(parsed.data.email, ip);
    return { status: "enviada" };
  } catch (error) {
    // El bloqueo por email agotó su tiempo (409): depende solo del email.
    if (error instanceof ServiceError && error.code === "TRANSACCION_OCUPADA") {
      return { status: "error", mensaje: texto("errores.transaccion.ocupada") };
    }
    return { status: "error", mensaje: texto("ui.sesion.formPassword.errorComunicacion") };
  }
}

/**
 * Definir la contraseña nueva con el enlace (HU-A-05, spec_modulo_A.md
 * §2.7.3). Capa delgada, equivalente a `POST /api/auth/restablecer-password`.
 * No reemite la sesión ni llama a `signIn`: la interfaz vuelve al login con
 * el aviso de éxito. Un token con largo inválido es un enlace inválido, igual
 * que el 410 del servicio.
 */
export async function restablecerPassword(
  _estadoAnterior: EstadoRestablecerPassword,
  formData: FormData,
): Promise<EstadoRestablecerPassword> {
  try {
    const longitudMinima = await getParametroNumerico("password_longitud_minima", 8);
    const parsed = construirRestablecerPasswordSchema(longitudMinima).safeParse({
      token: formData.get("token") ?? "",
      password_nueva: formData.get("password_nueva") ?? "",
      confirmacion: formData.get("confirmacion") ?? "",
    });
    if (!parsed.success) {
      const { token, password_nueva, confirmacion } = flattenError(parsed.error).fieldErrors;
      if (token) return { status: "enlace_invalido", mensaje: texto("errores.sesion.enlaceInvalido") };
      return { status: "error_validacion", errores: { password_nueva, confirmacion } };
    }

    try {
      await restablecerPasswordEnServicio(parsed.data, await ipDeLaSolicitud());
      return { status: "exito" };
    } catch (error) {
      if (!(error instanceof ServiceError)) throw error;
      switch (error.code) {
        case "ENLACE_INVALIDO":
          return { status: "enlace_invalido", mensaje: error.message };
        case "PASSWORD_IGUAL_A_ACTUAL":
          return { status: "error_validacion", errores: { password_nueva: [error.message] } };
        case "TRANSACCION_OCUPADA":
          return { status: "error", mensaje: texto("errores.transaccion.ocupada") };
        default:
          throw error;
      }
    }
  } catch {
    // Error de comunicación o de infraestructura: nunca un detalle técnico.
    return { status: "error", mensaje: texto("ui.sesion.formPassword.errorComunicacion") };
  }
}

/** IP de la solicitud de la Server Action, con el mismo criterio que el login (`obtenerIp`). */
async function ipDeLaSolicitud(): Promise<string> {
  return obtenerIp(new Request("http://localhost", { headers: await headers() }));
}
