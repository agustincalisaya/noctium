/**
 * Cálculo puro de renovación deslizante (spec_modulo_A.md §2.2), separado de
 * `callbacks.jwt` para poder testearlo sin levantar NextAuth.
 */
export type ClaimsRenovacion = {
  exp: number;
  iat_sesion: number;
};

export type ResultadoRenovacion =
  | { renovar: true; exp: number; iat: number }
  | { renovar: false };

/**
 * @param claims `exp`/`iat_sesion` del token entrante, en segundos (epoch).
 * @param now Segundos (epoch) del momento de la solicitud.
 * @param inactividadMin Parámetro `sesion_inactividad_minutos`.
 * @param maximaHoras Parámetro `sesion_duracion_maxima_horas`.
 */
export function calcularRenovacionSesion(
  claims: ClaimsRenovacion,
  now: number,
  inactividadMin: number,
  maximaHoras: number,
): ResultadoRenovacion {
  if (now >= claims.exp) return { renovar: false };
  if (now - claims.iat_sesion > maximaHoras * 3600) return { renovar: false };
  return { renovar: true, exp: now + inactividadMin * 60, iat: now };
}
