/**
 * Constantes de la recuperación de contraseña (HU-A-05, spec_modulo_A.md
 * §2.7, P-A8). Son del módulo, no `ParametroSistema`: HU-N-01 solo expone
 * tres parámetros.
 */

/** Vida del enlace de recuperación desde que se crea. */
export const MINUTOS_VALIDEZ_ENLACE_RECUPERACION = 30;

/** Solicitudes de enlace admitidas por email en la última hora, exista o no la cuenta (T6). */
export const MAX_SOLICITUDES_RECUPERACION_POR_HORA = 3;
