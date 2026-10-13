import type { Prisma } from "@prisma/client";
import { tokenizarBusqueda } from "@/lib/busqueda-texto";

/**
 * Filtro de búsqueda de los gerentes (HU-G-03, spec_modulo_G.md §2.3; criterio
 * de HU-B-05). Copia del del personal (`personal.busqueda.ts`) sobre las
 * columnas de `FichaGerente`, sin acoplarse a ese módulo: cada palabra tiene
 * que aparecer (coincidencia parcial) en el apellido, el nombre o, si son solo
 * dígitos, el DNI; AND entre palabras y OR entre campos. Las columnas
 * normalizadas y los tokens ya están en minúsculas y sin acentos. `undefined` =
 * sin filtro (menos de 2 caracteres). Opera sobre activos e inactivos.
 */
export function construirFiltroBusquedaGerentes(q: string | undefined): Prisma.FichaGerenteWhereInput | undefined {
  const tokens = tokenizarBusqueda(q);
  if (tokens === null) return undefined;
  return {
    AND: tokens.map((token) => ({
      OR: [
        { apellidoNormalizadoFichaGerente: { contains: token } },
        { nombreNormalizadoFichaGerente: { contains: token } },
        ...(/^\d+$/.test(token) ? [{ dniFichaGerente: { contains: token } }] : []),
      ],
    })),
  };
}
