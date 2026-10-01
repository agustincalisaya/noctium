import type { EstadoTurno, Prisma } from "@prisma/client";
import { intervalosSeSuperponen, type IntervaloMinutos } from "@/lib/horario-atencion";

/** Solo los turnos confirmados reservan recursos (spec_modulo_C.md §3.2). */
export const ESTADOS_AGENDADOS: EstadoTurno[] = ["DISPONIBLE", "COMPLETO"];

type Horario = { horaInicioTurno: Date; duracionMinutosTurno: number };
type TurnoConHorario = Horario & { idTurno?: string; fechaTurno: Date };

export function intervaloTurno(turno: Horario) {
  const inicio = turno.horaInicioTurno.getUTCHours() * 60 + turno.horaInicioTurno.getUTCMinutes();
  return { inicio, fin: inicio + turno.duracionMinutosTurno };
}

export function horaDeMinutos(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Resta de una franja los intervalos ocupados, sin alterar los argumentos. */
export function calcularTramosLibres(franja: IntervaloMinutos, ocupados: readonly IntervaloMinutos[]): IntervaloMinutos[] {
  if (franja.inicio >= franja.fin) return [];

  const tramos: IntervaloMinutos[] = [];
  let inicioLibre = franja.inicio;
  const superpuestos = ocupados
    .filter((ocupado) => ocupado.inicio < ocupado.fin && intervalosSeSuperponen(franja, ocupado))
    .sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);

  for (const ocupado of superpuestos) {
    const inicioOcupado = Math.max(franja.inicio, ocupado.inicio);
    if (inicioOcupado > inicioLibre) tramos.push({ inicio: inicioLibre, fin: inicioOcupado });
    inicioLibre = Math.max(inicioLibre, Math.min(franja.fin, ocupado.fin));
    if (inicioLibre === franja.fin) break;
  }

  if (inicioLibre < franja.fin) tramos.push({ inicio: inicioLibre, fin: franja.fin });
  return tramos;
}

/** Inicios alineados desde las 00:00 cuyo turno completo cabe en el tramo. */
export function iniciosPosibles(tramo: IntervaloMinutos, duracion: number, granularidad: number): number[] {
  if (!Number.isInteger(duracion) || duracion <= 0 || !Number.isInteger(granularidad) || granularidad <= 0) {
    return [];
  }

  const inicios: number[] = [];
  const primerInicio = Math.ceil(tramo.inicio / granularidad) * granularidad;
  for (let inicio = primerInicio; inicio + duracion <= tramo.fin; inicio += granularidad) {
    inicios.push(inicio);
  }
  return inicios;
}

/**
 * Por cada profesor de `profesorIds`, el intervalo de su primer turno
 * DISPONIBLE/COMPLETO superpuesto con `turno` (los contiguos no chocan, §3.3).
 * Criterio único para revalidar al confirmar (§2.2) y para filtrar opciones (§2.6).
 */
export async function profesoresConTurnoSuperpuesto(db: Prisma.TransactionClient, turno: TurnoConHorario, profesorIds: string[]) {
  const intervalo = intervaloTurno(turno);
  const otros = await db.turno.findMany({
    where: { ...(turno.idTurno ? { idTurno: { not: turno.idTurno } } : {}), fechaTurno: turno.fechaTurno, estadoTurno: { in: ESTADOS_AGENDADOS }, profesorId: { in: profesorIds } },
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

/** Alumnos ocupados por otro turno confirmado, en el orden recibido. */
export async function alumnosConTurnoSuperpuesto(db: Prisma.TransactionClient, turno: TurnoConHorario, alumnoIds: string[]): Promise<string[]> {
  if (!alumnoIds.length) return [];
  const intervalo = intervaloTurno(turno);
  const otros = await db.turno.findMany({
    where: { ...(turno.idTurno ? { idTurno: { not: turno.idTurno } } : {}), fechaTurno: turno.fechaTurno, estadoTurno: { in: ESTADOS_AGENDADOS }, alumnos: { some: { alumnoId: { in: alumnoIds } } } },
    select: { horaInicioTurno: true, duracionMinutosTurno: true, alumnos: { where: { alumnoId: { in: alumnoIds } }, select: { alumnoId: true } } },
  });
  const ocupados = new Set(otros.filter((otro) => intervalosSeSuperponen(intervalo, intervaloTurno(otro))).flatMap((otro) => otro.alumnos.map(({ alumnoId }) => alumnoId)));
  return alumnoIds.filter((alumnoId) => ocupados.has(alumnoId));
}
