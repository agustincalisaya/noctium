import { prisma } from "@/lib/prisma";
import { diaSemanaDeFecha, horaAMinutos, minutosAHora } from "@/lib/horario-atencion";
import { verificarMateriaActiva } from "@/server/materias/materia.service";
import { estaDentroDeHorarioAtencion, listarProfesoresActivosPorMateria, obtenerHorariosDeAtencion, obtenerOpcionProfesorActivo, profesorActivoDictaMateria } from "@/server/profesores/profesor.publico";
import { ServiceError } from "@/server/shared/service-error";
import { calcularTramosLibres, ESTADOS_AGENDADOS, horaDeMinutos, iniciosPosibles, intervaloTurno, profesoresConTurnoSuperpuesto } from "./turno.disponibilidad";
import type { DisponibilidadProfesorQuery } from "./turno.schema";
import { horaLocal, parametrosConfiguracionTurno } from "./turno.validaciones";

const fechaCalendario = (fecha: Date) => fecha.toISOString().slice(0, 10);

/** HU-C-07 §2.8.2: consulta de buena fe; la creación y confirmación revalidan. */
export async function calcularDisponibilidadProfesor(profesorId: string, query: DisponibilidadProfesorQuery) {
  if (!(await verificarMateriaActiva(query.materia_id))) {
    throw new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible");
  }
  const profesor = await obtenerOpcionProfesorActivo(profesorId);
  if (!profesor) throw new ServiceError("PROFESOR_NO_ENCONTRADO", "No se encontró un profesor activo");
  if (!(await profesorActivoDictaMateria(profesorId, query.materia_id))) {
    throw new ServiceError("PROFESOR_NO_DICTA_MATERIA", "El profesor no dicta la materia seleccionada");
  }

  const operativo = await parametrosConfiguracionTurno();
  const ahora = horaLocal(new Date());
  const hoy = new Date(`${ahora.fecha}T00:00:00.000Z`);
  const tope = new Date(hoy);
  tope.setUTCDate(tope.getUTCDate() + operativo.anticipacion_maxima_dias);
  const desde = new Date(Math.max(query.desde?.getTime() ?? hoy.getTime(), hoy.getTime()));
  const hasta = new Date(Math.min(query.hasta?.getTime() ?? tope.getTime(), tope.getTime()));
  if (desde > hasta) throw new ServiceError("VALIDATION_ERROR", "El rango de fechas no es válido");

  const horarios = await obtenerHorariosDeAtencion(profesorId);
  const turnos = await prisma.turno.findMany({
    where: { profesorId, fechaTurno: { gte: desde, lte: hasta }, estadoTurno: { in: ESTADOS_AGENDADOS } },
    select: { fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true },
  });
  const ocupadosPorFecha = new Map<string, ReturnType<typeof intervaloTurno>[]>();
  for (const turno of turnos) {
    const fecha = fechaCalendario(turno.fechaTurno);
    const ocupados = ocupadosPorFecha.get(fecha) ?? [];
    ocupados.push(intervaloTurno(turno));
    ocupadosPorFecha.set(fecha, ocupados);
  }

  const apertura = horaAMinutos(operativo.apertura);
  const cierre = horaAMinutos(operativo.cierre);
  const fechaActual = new Date(desde);
  const fechas = [] as Array<{
    fecha: string;
    dia_semana: ReturnType<typeof diaSemanaDeFecha>;
    franjas: Array<{ hora_inicio: string; hora_fin: string; tramos_libres: Array<{ desde: string; hasta: string }>; inicios: string[] }>;
  }>;
  while (fechaActual <= hasta) {
    const fecha = fechaCalendario(fechaActual);
    const dia = diaSemanaDeFecha(fechaActual);
    if (operativo.dias_operativos.includes(dia)) {
      const franjas = horarios.filter((horario) => horario.dia_semana === dia).flatMap((horario) => {
        const inicio = Math.max(horaAMinutos(horario.hora_inicio), apertura);
        const fin = Math.min(horaAMinutos(horario.hora_fin), cierre);
        if (inicio >= fin) return [];
        const libres = calcularTramosLibres({ inicio, fin }, ocupadosPorFecha.get(fecha) ?? []);
        const inicios = libres.flatMap((tramo) => iniciosPosibles(tramo, query.duracion_min, operativo.granularidad_minutos))
          .filter((minuto) => fecha !== ahora.fecha || minuto > horaAMinutos(ahora.hora))
          .map(minutosAHora);
        return [{
          hora_inicio: minutosAHora(inicio), hora_fin: minutosAHora(fin),
          tramos_libres: libres.map((tramo) => ({ desde: minutosAHora(tramo.inicio), hasta: minutosAHora(tramo.fin) })),
          inicios,
        }];
      });
      if (franjas.some((franja) => franja.inicios.length > 0)) fechas.push({ fecha, dia_semana: dia, franjas });
    }
    fechaActual.setUTCDate(fechaActual.getUTCDate() + 1);
  }
  return {
    profesor: { id: profesor.id, nombre_completo: profesor.nombreParaMostrar },
    duracion_min: query.duracion_min,
    rango: { desde: fechaCalendario(desde), hasta: fechaCalendario(hasta) },
    fechas,
  };
}

/** HU-C-07 §2.8.1: profesores activos asociados a una materia activa. */
export async function listarProfesoresPorMateria(materiaId: string) {
  if (!(await verificarMateriaActiva(materiaId))) {
    throw new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible");
  }

  const profesores = await listarProfesoresActivosPorMateria(materiaId);
  if (profesores.length === 0) {
    throw new ServiceError("SIN_PROFESORES_PARA_MATERIA", "No hay profesores activos asociados a esta materia");
  }
  return profesores.map(({ id, nombre, apellido }) => ({ id, nombre, apellido }));
}

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
