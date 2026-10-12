import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { intervalosSeSuperponen } from "@/lib/horario-atencion";
import { listarAulasActivasParaTurno } from "@/server/aulas/aula.publico";
import { ESTADOS_AGENDADOS, intervaloTurno } from "./turno.disponibilidad";
import { compararAulasPorCapacidad } from "./turno.generacion.calculo";
import type { AulaLibre, AulasLibresQuery } from "./turno.generacion.schema";

const iso = (fecha: Date) => fecha.toISOString().slice(0, 10);

/**
 * HU-C-21 (R1): aulas activas libres en cada fecha, para el mismo horario.
 * Una lectura de K y una sola de turnos para todas las fechas; aplica el mismo
 * criterio que `aulaConTurnoSuperpuesto` (agendados, intervalo superpuesto).
 * Solo para ofrecer aulas: la validación de cada fecha sigue siendo
 * `aulaConTurnoSuperpuesto`. Fuera de la transacción: la fachada de K usa el
 * cliente global.
 */
export async function aulasLibresEnFechas(
  db: Prisma.TransactionClient,
  fechas: readonly Date[],
  horaInicio: string,
  duracionMin: number,
): Promise<Map<string, AulaLibre[]>> {
  const libres = new Map<string, AulaLibre[]>(fechas.map((fecha) => [iso(fecha), []]));
  if (fechas.length === 0) return libres;
  const aulas = await listarAulasActivasParaTurno(1);
  if (aulas.length === 0) return libres;

  const intervalo = intervaloTurno({ horaInicioTurno: new Date(`1970-01-01T${horaInicio}:00.000Z`), duracionMinutosTurno: duracionMin });
  const otros = await db.turno.findMany({
    where: { fechaTurno: { in: [...fechas] }, estadoTurno: { in: ESTADOS_AGENDADOS }, aulaId: { in: aulas.map(({ id }) => id) } },
    select: { fechaTurno: true, aulaId: true, horaInicioTurno: true, duracionMinutosTurno: true },
  });
  const ocupadas = new Set(otros
    .filter((otro) => intervalosSeSuperponen(intervalo, intervaloTurno(otro)))
    .map((otro) => `${iso(otro.fechaTurno)}|${otro.aulaId}`));
  const ordenadas = [...aulas].sort(compararAulasPorCapacidad);
  for (const fecha of libres.keys()) {
    libres.set(fecha, ordenadas.filter(({ id }) => !ocupadas.has(`${fecha}|${id}`)));
  }
  return libres;
}

/** GET /api/turnos/generacion/aulas-libres: solo lectura. */
export async function aulasLibresParaGeneracion(query: AulasLibresQuery): Promise<AulaLibre[]> {
  const libres = await aulasLibresEnFechas(prisma, [query.fecha], query.hora_inicio, query.duracion_min);
  return libres.get(iso(query.fecha)) ?? [];
}
