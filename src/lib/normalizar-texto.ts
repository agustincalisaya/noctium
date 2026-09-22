/**
 * Normaliza texto para comparaciones de unicidad case/acento-insensitivas
 * ("Matemática" y "matematica" producen el mismo valor). Utilidad
 * transversal (spec_modulo_L.md §2.1) — la usa Materias (HU-L-01) y la
 * reutiliza Aulas (HU-K-01) sin reimplementarla.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
