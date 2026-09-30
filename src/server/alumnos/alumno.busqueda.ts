import type { Prisma } from "@prisma/client";
import { tokenizarBusqueda } from "@/lib/busqueda-texto";

/**
 * Filtro de búsqueda de alumnos (HU-B-05, spec_modulo_B.md §2.7 y §3.9),
 * único para el listado de Mesa de Entrada y el selector de Turnos. Cada
 * palabra tiene que aparecer (coincidencia parcial) en el apellido, el
 * nombre o, si son solo dígitos, el DNI: AND entre palabras y OR entre
 * campos, así "juan perez" y "perez juan" dan lo mismo. Las columnas
 * normalizadas y los tokens ya están en minúsculas y sin acentos, por eso no
 * hace falta `mode: "insensitive"`. `undefined` = sin filtro (menos de 2
 * caracteres).
 */
export function construirFiltroBusquedaAlumno(q: string | undefined): Prisma.AlumnoWhereInput | undefined {
  const tokens = tokenizarBusqueda(q);
  if (tokens === null) return undefined;
  return {
    AND: tokens.map((token) => ({
      OR: [
        { apellidoNormalizadoAlumno: { contains: token } },
        { nombreNormalizadoAlumno: { contains: token } },
        ...(/^\d+$/.test(token) ? [{ dniAlumno: { contains: token } }] : []),
      ],
    })),
  };
}
