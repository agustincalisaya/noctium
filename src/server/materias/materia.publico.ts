import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Contrato público de Materias (spec_modulo_L.md §2.5). Devuelve las fichas
 * existentes, activas o no, en el orden de los ids recibidos. Los ids
 * inexistentes se omiten y los repetidos se resuelven una sola vez.
 */
export async function obtenerMateriasPorIds(
  ids: string[],
  db: Prisma.TransactionClient = prisma,
): Promise<{ id: string; nombre: string; codigo: string | null; activa: boolean }[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return [];

  const materias = await db.materia.findMany({
    where: { idMateria: { in: unicos } },
    select: {
      idMateria: true,
      nombreMateria: true,
      codigoMateria: true,
      activaMateria: true,
    },
  });
  const porId = new Map(materias.map((materia) => [materia.idMateria, materia]));
  return unicos.flatMap((id) => {
    const materia = porId.get(id);
    return materia
      ? [{ id: materia.idMateria, nombre: materia.nombreMateria, codigo: materia.codigoMateria, activa: materia.activaMateria }]
      : [];
  });
}

/**
 * Tarifas por hora de las materias pedidas (spec_modulo_L.md §2.10, P-L5):
 * activas o inactivas, `tarifaHora: null` si la materia no tiene tarifa (el
 * consumidor rechaza con MATERIA_SIN_TARIFA). Los ids inexistentes se omiten
 * y los repetidos cuentan una vez; no bloquea filas. C e I calculan el precio
 * con `precioClase` (src/server/shared/precio-clase.ts) y no leen
 * `Materia.tarifaHoraMateria` directo (Regla N.° 3).
 */
export async function obtenerTarifasPorIds(
  ids: string[],
  db: Prisma.TransactionClient = prisma,
): Promise<{ id: string; tarifaHora: number | null }[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return [];
  const materias = await db.materia.findMany({
    where: { idMateria: { in: unicos } },
    select: { idMateria: true, tarifaHoraMateria: true },
  });
  const porId = new Map(materias.map((materia) => [materia.idMateria, materia.tarifaHoraMateria]));
  return unicos.flatMap((id) => (porId.has(id) ? [{ id, tarifaHora: porId.get(id)! }] : []));
}
