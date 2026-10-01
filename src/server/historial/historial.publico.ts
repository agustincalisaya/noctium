import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Contratos públicos de Historial para los módulos consumidores. */
export async function obtenerClaseDictadaDeTurno(
  turnoId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<{ id: string; registrada_en: string; alumnos_registrados: number } | null> {
  const clase = await db.claseDictada.findUnique({
    where: { turnoId },
    select: {
      idClaseDictada: true,
      createdAtClaseDictada: true,
      _count: { select: { alumnos: true } },
    },
  });
  return clase
    ? {
        id: clase.idClaseDictada,
        registrada_en: clase.createdAtClaseDictada.toISOString(),
        alumnos_registrados: clase._count.alumnos,
      }
    : null;
}
