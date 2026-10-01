import type { Prisma } from "@prisma/client";
import { tokenizarBusqueda } from "@/lib/busqueda-texto";

/**
 * Filtro de búsqueda del listado de turnos (HU-C-02, spec_modulo_C.md §2.7),
 * con el mismo criterio que construirFiltroBusquedaAlumno() de HU-B-05. Cada
 * palabra tiene que aparecer (coincidencia parcial) en el apellido o nombre
 * del profesor, el nombre de la materia o el nombre del aula: AND entre
 * palabras y OR entre campos, así "gimenez matematica" y "matematica gimenez"
 * dan lo mismo. No busca por alumno: la relación con los alumnos inscriptos
 * no participa del filtro (decisión del equipo, 29/09/2026). Un turno PENDIENTE
 * sin profesor o sin aula sigue siendo encontrable por los demás campos
 * (esas ramas del OR simplemente no coinciden). Las columnas normalizadas y
 * los tokens ya están en minúsculas y sin acentos, por eso no hace falta
 * `mode: "insensitive"`. Filtra por columnas de otros módulos vía relaciones:
 * excepción de solo lectura a la Regla N.° 3 (R5-7, §3.11). `undefined` =
 * sin filtro (menos de 2 caracteres).
 */
export function construirFiltroBusquedaTurno(q: string | undefined): Prisma.TurnoWhereInput | undefined {
  const tokens = tokenizarBusqueda(q);
  if (tokens === null) return undefined;
  return {
    AND: tokens.map((token) => ({
      OR: [
        { profesor: { is: { OR: [{ apellidoNormalizadoProfesor: { contains: token } }, { nombreNormalizadoProfesor: { contains: token } }] } } },
        { materia: { is: { nombreNormalizadaMateria: { contains: token } } } },
        { aula: { is: { nombreNormalizadaAula: { contains: token } } } },
      ],
    })),
  };
}
