import { normalizarTexto } from "@/lib/normalizar-texto";

/**
 * Filtro del selector de materias (HU-D-03 criterio 1: buscar por nombre o
 * código). Compara sin mayúsculas ni acentos vía `normalizarTexto()`, así
 * "matematica" encuentra "Matemática" y "mat101" encuentra "MAT101". Un
 * filtro vacío (o solo espacios) devuelve la lista completa. Función pura,
 * sin imports de servidor: se usa desde el Client Component del formulario.
 */
export function filtrarMaterias<T extends { nombre: string; codigo: string | null }>(
  materias: T[],
  filtro: string,
): T[] {
  const buscado = normalizarTexto(filtro.trim());
  if (buscado === "") return materias;

  return materias.filter(
    (materia) =>
      normalizarTexto(materia.nombre).includes(buscado) ||
      (materia.codigo !== null && normalizarTexto(materia.codigo).includes(buscado)),
  );
}
