import type { Prisma } from "@prisma/client";
import { tokenizarBusqueda } from "@/lib/busqueda-texto";

/**
 * Filtro de búsqueda del personal de mesa de entrada (HU-F-03, spec_modulo_F.md
 * §2.3; criterio de HU-B-05). Copia del de alumnos (`alumno.busqueda.ts`) sobre
 * las columnas de `FichaMesaEntrada`, sin acoplarse a ese módulo: cada palabra
 * tiene que aparecer (coincidencia parcial) en el apellido, el nombre o, si son
 * solo dígitos, el DNI; AND entre palabras y OR entre campos. Las columnas
 * normalizadas y los tokens ya están en minúsculas y sin acentos. `undefined` =
 * sin filtro (menos de 2 caracteres). Opera sobre activos e inactivos.
 */
export function construirFiltroBusquedaPersonal(q: string | undefined): Prisma.FichaMesaEntradaWhereInput | undefined {
  const tokens = tokenizarBusqueda(q);
  if (tokens === null) return undefined;
  return {
    AND: tokens.map((token) => ({
      OR: [
        { apellidoNormalizadoFichaMesaEntrada: { contains: token } },
        { nombreNormalizadoFichaMesaEntrada: { contains: token } },
        ...(/^\d+$/.test(token) ? [{ dniFichaMesaEntrada: { contains: token } }] : []),
      ],
    })),
  };
}
