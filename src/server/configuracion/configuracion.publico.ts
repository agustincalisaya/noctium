import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Única lectura pública de N para el agregador de actividad (Regla N.° 3). */
export async function usuarioRegistroOperaciones(
  usuarioId: string,
  db: Pick<Prisma.TransactionClient, "historialParametro"> = prisma,
): Promise<boolean> {
  return (await db.historialParametro.findFirst({ where: { usuarioId }, select: { idHistorialParametro: true } })) !== null;
}
