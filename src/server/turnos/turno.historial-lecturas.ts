import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerNombreAula } from "@/server/aulas/aula.publico";
import { horaDeMinutos, intervaloTurno } from "./turno.disponibilidad";
type Db = Prisma.TransactionClient;

/** Aula y horario de la clase correspondiente; no accede a otros alumnos. */
export async function obtenerDetallesClasesHistorial(ids: string[], db: Db = prisma) {
  const turnos = await db.turno.findMany({ where: { idTurno: { in: ids } },
    select: { idTurno: true, aulaId: true, horaInicioTurno: true, duracionMinutosTurno: true } });
  return new Map(await Promise.all(turnos.map(async t => [t.idTurno, {
    aula: t.aulaId ? (await obtenerNombreAula(t.aulaId, db))?.nombre ?? null : null,
    hora_inicio: t.horaInicioTurno.toISOString().slice(11, 16),
    hora_fin: horaDeMinutos(intervaloTurno(t).fin),
  }] as const)));
}
