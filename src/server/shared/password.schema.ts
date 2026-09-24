import { z } from "zod";

/**
 * Política de fortaleza de contraseña (HU-B-08, spec_modulo_B.md §2.6,
 * "Punto abierto — política de contraseña" resuelto: mínimo N caracteres, 1
 * mayúscula, 1 minúscula, 1 número). Factory por el mismo motivo que
 * `crearIdentidadAlumnoSchema` (`alumno.schema.ts`): `password_longitud_minima`
 * es un valor configurable en `ParametroSistema` (sembrado en `"8"`), no una
 * constante hardcodeada — el caller resuelve el parámetro primero (mismo
 * patrón que `getParametroNumerico("dni_longitud_min", ...)`) y arma el
 * schema con él. Sigue siendo `schema.safeParse()` puro (Regla N.° 6 de
 * `docs/RULES.md`), no una validación async por fuera de Zod.
 */
export function politicaPasswordSchema(passwordLongitudMinima: number) {
  return z
    .string()
    .min(passwordLongitudMinima, `La contraseña debe tener al menos ${passwordLongitudMinima} caracteres`)
    .regex(/[A-Z]/, "La contraseña debe tener al menos una mayúscula")
    .regex(/[a-z]/, "La contraseña debe tener al menos una minúscula")
    .regex(/[0-9]/, "La contraseña debe tener al menos un número");
}
export type PoliticaPasswordInput = z.infer<ReturnType<typeof politicaPasswordSchema>>;
