import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Contrato público de Historial E §2.4, consumido por Turnos. */
export async function obtenerClaseDictadaDeTurno(turnoId: string, db: Prisma.TransactionClient = prisma) {
  const clase = await db.claseDictada.findUnique({
    where: { turnoId },
    select: {
      idClaseDictada: true,
      createdAtClaseDictada: true,
      _count: { select: { alumnos: true } },
    },
  });
  if (!clase) return null;
  return {
    id: clase.idClaseDictada,
    registrada_en: clase.createdAtClaseDictada.toISOString(),
    alumnos_registrados: clase._count.alumnos,
  };
}
