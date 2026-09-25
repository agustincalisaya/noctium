import type { EstadoTurno, Prisma } from "@prisma/client";
import { intervalosSeSuperponen } from "@/server/profesores/profesor.service";

/** Solo los turnos confirmados reservan recursos (spec_modulo_C.md §3.2). */
export const ESTADOS_AGENDADOS: EstadoTurno[] = ["DISPONIBLE", "COMPLETO"];

type Horario = { horaInicioTurno: Date; duracionMinutosTurno: number };
type TurnoConHorario = Horario & { idTurno: string; fechaTurno: Date };

export function intervaloTurno(turno: Horario) {
  const inicio = turno.horaInicioTurno.getUTCHours() * 60 + turno.horaInicioTurno.getUTCMinutes();
  return { inicio, fin: inicio + turno.duracionMinutosTurno };
}

export function horaDeMinutos(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Por cada profesor de `profesorIds`, el intervalo de su primer turno
 * DISPONIBLE/COMPLETO superpuesto con `turno` (los contiguos no chocan, §3.3).
 * Criterio único para revalidar al confirmar (§2.2) y para filtrar opciones (§2.6).
 */
export async function profesoresConTurnoSuperpuesto(db: Prisma.TransactionClient, turno: TurnoConHorario, profesorIds: string[]) {
  const intervalo = intervaloTurno(turno);
  const otros = await db.turno.findMany({
    where: { idTurno: { not: turno.idTurno }, fechaTurno: turno.fechaTurno, estadoTurno: { in: ESTADOS_AGENDADOS }, profesorId: { in: profesorIds } },
    select: { profesorId: true, horaInicioTurno: true, duracionMinutosTurno: true },
    orderBy: { horaInicioTurno: "asc" },
  });
  const conflictos = new Map<string, { inicio: number; fin: number }>();
  for (const otro of otros) {
    const ocupado = intervaloTurno(otro);
    if (otro.profesorId && !conflictos.has(otro.profesorId) && intervalosSeSuperponen(intervalo, ocupado)) conflictos.set(otro.profesorId, ocupado);
  }
  return conflictos;
}

/** El aula ya está tomada por otro turno DISPONIBLE/COMPLETO superpuesto con `turno`. */
export async function aulaConTurnoSuperpuesto(db: Prisma.TransactionClient, turno: TurnoConHorario, aulaId: string) {
  const intervalo = intervaloTurno(turno);
  const otros = await db.turno.findMany({
    where: { idTurno: { not: turno.idTurno }, fechaTurno: turno.fechaTurno, estadoTurno: { in: ESTADOS_AGENDADOS }, aulaId },
    select: { horaInicioTurno: true, duracionMinutosTurno: true },
  });
  return otros.some((otro) => intervalosSeSuperponen(intervalo, intervaloTurno(otro)));
}
