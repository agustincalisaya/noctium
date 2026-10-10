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
