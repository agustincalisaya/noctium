/**
 * Normaliza un teléfono de contacto (HU-B-02 / HU-D-02): elimina espacios,
 * guiones y paréntesis, y conserva el `+` inicial si lo hay. No valida —
 * la validación de caracteres permitidos y longitud vive en
 * `telefonoContactoSchema` (`contacto.schema.ts`). Función pura, sin estado:
 * compartida entre módulos sin acoplamiento de dominio (Regla N.° 3 de
 * `docs/RULES.md`).
 *
 * Ej.: "(0387) 15-412-3456" -> "0387154123456", "+54 9 387 444-5566" -> "+5493874445566".
 */
export function normalizarTelefono(valor: string): string {
  return valor.trim().replace(/[\s\-()]/g, "");
}

/** Cantidad de dígitos de un teléfono (el `+` y los separadores no cuentan). */
export function contarDigitosTelefono(valor: string): number {
  return valor.replace(/\D/g, "").length;
}
