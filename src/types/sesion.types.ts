export type EstadoLogin =
  | { status: "idle" }
  | { status: "error_validacion"; errores: { email?: string[]; password?: string[] }; email: string }
  | { status: "error"; mensaje: string; email: string }
  | { status: "error_comunicacion"; email: string };

export const ESTADO_INICIAL: EstadoLogin = { status: "idle" };

/**
 * Estado de `cambiarPasswordPropia` (HU-A-06, excepción de la Regla N.° 5
 * para Server Actions con la firma de `useActionState`). `exito` informa si la
 * sesión que hizo el cambio se pudo reemitir: con `sesion_conservada: false`
 * el cambio ya está hecho y la interfaz lleva al login con el aviso de éxito.
 */
export type EstadoCambioPassword =
  | { status: "idle" }
  | {
      status: "error_validacion";
      errores: { password_actual?: string[]; password_nueva?: string[]; confirmacion?: string[] };
    }
  | { status: "error"; mensaje: string }
  | { status: "exito"; sesion_conservada: boolean };

export const ESTADO_INICIAL_CAMBIO_PASSWORD: EstadoCambioPassword = { status: "idle" };

/**
 * Estado de la Server Action `solicitarRecuperacion` (HU-A-05,
 * spec_modulo_A.md §2.7.1). `enviada` es la respuesta uniforme: la misma
 * exista o no la cuenta, y también con la solicitud limitada (§3.10).
 */
export type EstadoSolicitudRecuperacion =
  | { status: "idle" }
  | { status: "enviada" }
  | { status: "error_validacion"; errores: { email?: string[] } }
  | { status: "error"; mensaje: string };

export const ESTADO_INICIAL_SOLICITUD_RECUPERACION: EstadoSolicitudRecuperacion = { status: "idle" };

/**
 * Estado de la Server Action `restablecerPassword` (HU-A-05,
 * spec_modulo_A.md §2.7.3). `enlace_invalido` cubre el enlace vencido, usado,
 * invalidado, inexistente o de una cuenta inactiva (410): la pantalla lo
 * muestra en lugar del formulario. `exito` no inicia sesión.
 */
export type EstadoRestablecerPassword =
  | { status: "idle" }
  | { status: "exito" }
  | { status: "enlace_invalido"; mensaje: string }
  | { status: "error_validacion"; errores: { password_nueva?: string[]; confirmacion?: string[] } }
  | { status: "error"; mensaje: string };

export const ESTADO_INICIAL_RESTABLECER_PASSWORD: EstadoRestablecerPassword = { status: "idle" };
