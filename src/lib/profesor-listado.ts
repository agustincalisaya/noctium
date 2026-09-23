import { normalizarTexto } from "@/lib/normalizar-texto";

/**
 * Helpers puros del listado de profesores (HU-D-05). Sin acceso a base: los
 * usan el servicio, el seed y los tests.
 */

/** Valor ausente en listado y detalle (HU-D-05 criterios 1 y 4). */
export const VALOR_AUSENTE = "—";

/** Materias que se nombran en el resumen del listado antes del contador. */
export const MATERIAS_VISIBLES_EN_LISTADO = 2;

/**
 * Claves de orden del listado (case/acento-insensitivo, `spec_modulo_D.md`
 * §2.5): se guardan en la fila al dar de alta, igual que las de Alumno
 * (HU-B-04). "Álvarez" y "alvarez" producen la misma clave, así que el
 * desempate queda en manos del DNI.
 */
export function clavesOrdenProfesor(identidad: { nombre: string; apellido: string }): {
  nombreNormalizadoProfesor: string;
  apellidoNormalizadoProfesor: string;
} {
  return {
    nombreNormalizadoProfesor: normalizarTexto(identidad.nombre),
    apellidoNormalizadoProfesor: normalizarTexto(identidad.apellido),
  };
}

/** "Apellido, Nombre" (HU-D-05 criterio 1). */
export function formatearApellidoNombre(apellido: string, nombre: string): string {
  return `${apellido}, ${nombre}`;
}

/**
 * Resumen de materias del listado (HU-D-05 criterio 4): las primeras
 * `visibles` por nombre y un contador del resto — "Matemática, Física +2".
 * Sin materias: "—". Recibe los nombres ya ordenados.
 */
export function resumirMaterias(
  nombres: readonly string[],
  visibles: number = MATERIAS_VISIBLES_EN_LISTADO,
): string {
  if (nombres.length === 0) return VALOR_AUSENTE;
  const primeras = nombres.slice(0, visibles).join(", ");
  const resto = nombres.length - visibles;
  return resto > 0 ? `${primeras} +${resto}` : primeras;
}
