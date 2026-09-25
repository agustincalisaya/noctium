import { prisma } from "@/lib/prisma";
import { estaDentroDeHorarioAtencion, listarProfesoresActivosPorMateria } from "@/server/profesores/profesor.service";
import { ServiceError } from "@/server/shared/service-error";
import { horaDeMinutos, intervaloTurno, profesoresConTurnoSuperpuesto } from "./turno.disponibilidad";

/**
 * HU-C-04 §2.6: profesores activos de la materia del turno cuyo horario de
 * atención cubre el turno completo y que no tienen otro turno DISPONIBLE/
 * COMPLETO superpuesto. Lista de buena fe: §2.2 revalida al confirmar.
 */
export async function listarOpcionesProfesorTurno(turnoId: string) {
  const turno = await prisma.turno.findUnique({
    where: { idTurno: turnoId },
    select: { idTurno: true, estadoTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true, materiaId: true },
  });
  if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
  if (turno.estadoTurno !== "PENDIENTE") throw new ServiceError("TURNO_YA_DISPONIBLE", "El turno ya está confirmado");
  const profesores = await listarProfesoresActivosPorMateria(turno.materiaId);
  // Distingue "la materia no tiene profesores" (HU-C-04 c2) de "ninguno está libre en ese horario" (lista vacía).
  if (profesores.length === 0) throw new ServiceError("SIN_PROFESORES_PARA_MATERIA", "No hay profesores activos asociados a esta materia");

  const intervalo = intervaloTurno(turno);
  const ocupados = await profesoresConTurnoSuperpuesto(prisma, turno, profesores.map(({ id }) => id));
  const disponibles: typeof profesores = [];
  for (const profesor of profesores) {
    if (ocupados.has(profesor.id)) continue;
    if (await estaDentroDeHorarioAtencion(profesor.id, turno.fechaTurno, horaDeMinutos(intervalo.inicio), horaDeMinutos(intervalo.fin))) disponibles.push(profesor);
  }
  return disponibles;
}
