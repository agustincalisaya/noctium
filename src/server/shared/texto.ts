/**
 * Colapsa espacios múltiples internos a uno solo, sobre un valor ya
 * `trim()`eado. Función pura, sin estado — sin acoplamiento a ninguna
 * entidad (Regla N.° 3 de `docs/RULES.md`: reutilizar una utilidad pura
 * entre módulos no es acoplamiento de dominio).
 */
export function normalizarTextoNombre(valor: string): string {
  return valor.trim().replace(/\s+/g, " ");
}
