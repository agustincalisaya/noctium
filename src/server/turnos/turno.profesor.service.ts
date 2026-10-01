import { prisma } from "@/lib/prisma";
import { diaSemanaDeFecha, horaAMinutos, intervalosSeSuperponen, minutosAHora } from "@/lib/horario-atencion";
import { verificarMateriaActiva } from "@/server/materias/materia.service";
import { estaDentroDeHorarioAtencion, listarProfesoresActivosPorMateria, obtenerHorariosDeAtencion, obtenerOpcionProfesorActivo, profesorActivoDictaMateria } from "@/server/profesores/profesor.publico";
import { ServiceError } from "@/server/shared/service-error";
import { calcularTramosLibres, ESTADOS_AGENDADOS, horaDeMinutos, iniciosPosibles, intervaloTurno, profesoresConTurnoSuperpuesto } from "./turno.disponibilidad";
import type { DisponibilidadProfesorQuery } from "./turno.schema";
import { horaLocal, parametrosConfiguracionTurno } from "./turno.validaciones";

const fechaCalendario = (fecha: Date) => fecha.toISOString().slice(0, 10);

type FranjaCalculada = {
  hora_inicio: string; hora_fin: string;
  tramos_libres: { desde: string; hasta: string }[];
  tramos_ocupados: { desde: string; hasta: string }[];
  inicios: string[];
  bloques: { inicio: string; fin: string; estado: "LIBRE" | "OCUPADO" | "VENCIDO"; seleccionable: boolean }[];
};

/** Cálculo único de rango, franjas e inicios para C-07 y la agenda visual. */
async function calcularBaseAgendaProfesor(profesorId: string, query: DisponibilidadProfesorQuery) {
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
    operativo: boolean;
    franjas: FranjaCalculada[];
  }>;
  while (fechaActual <= hasta) {
    const fecha = fechaCalendario(fechaActual);
    const dia = diaSemanaDeFecha(fechaActual);
    const esOperativo = operativo.dias_operativos.includes(dia);
    let franjas: FranjaCalculada[] = [];
    if (esOperativo) {
      const ocupados = ocupadosPorFecha.get(fecha) ?? [];
      franjas = horarios.filter((horario) => horario.dia_semana === dia).flatMap((horario) => {
        const inicio = Math.max(horaAMinutos(horario.hora_inicio), apertura);
        const fin = Math.min(horaAMinutos(horario.hora_fin), cierre);
        if (inicio >= fin) return [];
        const franja = { inicio, fin };
        const libres = calcularTramosLibres(franja, ocupados);
        const iniciosValidos = libres.flatMap((tramo) => iniciosPosibles(tramo, query.duracion_min, operativo.granularidad_minutos))
          .filter((minuto) => fecha !== ahora.fecha || minuto > horaAMinutos(ahora.hora));
        const iniciosSet = new Set(iniciosValidos);
        const bloques = iniciosPosibles(franja, query.duracion_min, operativo.granularidad_minutos).map((minuto) => {
          const intervalo = { inicio: minuto, fin: minuto + query.duracion_min };
          const estado = fecha === ahora.fecha && minuto <= horaAMinutos(ahora.hora) ? "VENCIDO"
            : ocupados.some((ocupado) => intervalosSeSuperponen(intervalo, ocupado)) ? "OCUPADO"
              : iniciosSet.has(minuto) ? "LIBRE" : "VENCIDO";
          return { inicio: minutosAHora(minuto), fin: minutosAHora(intervalo.fin), estado, seleccionable: estado === "LIBRE" } as const;
        });
        return [{
          hora_inicio: minutosAHora(inicio), hora_fin: minutosAHora(fin),
          tramos_libres: libres.map((tramo) => ({ desde: minutosAHora(tramo.inicio), hasta: minutosAHora(tramo.fin) })),
          tramos_ocupados: ocupados.filter((ocupado) => intervalosSeSuperponen(franja, ocupado))
            .map((ocupado) => ({ desde: minutosAHora(Math.max(inicio, ocupado.inicio)), hasta: minutosAHora(Math.min(fin, ocupado.fin)) })),
          inicios: iniciosValidos.map(minutosAHora), bloques,
        }];
      });
    }
    fechas.push({ fecha, dia_semana: dia, operativo: esOperativo, franjas });
    fechaActual.setUTCDate(fechaActual.getUTCDate() + 1);
  }
  return {
    profesor: { id: profesor.id, nombre_completo: profesor.nombreParaMostrar },
    duracion_min: query.duracion_min,
    granularidad_min: operativo.granularidad_minutos,
    rango: { desde: fechaCalendario(desde), hasta: fechaCalendario(hasta) },
    franjas_recurrentes: horarios,
    fechas,
  };
}

/** HU-C-07 §2.8.2: mantiene exactamente el DTO y la omisión de fechas sin inicios. */
export async function calcularDisponibilidadProfesor(profesorId: string, query: DisponibilidadProfesorQuery) {
  const base = await calcularBaseAgendaProfesor(profesorId, query);
  return {
    profesor: base.profesor, duracion_min: base.duracion_min, rango: base.rango,
    fechas: base.fechas.filter(({ franjas }) => franjas.some(({ inicios }) => inicios.length > 0))
      .map(({ fecha, dia_semana, franjas }) => ({ fecha, dia_semana, franjas: franjas.map(({ hora_inicio, hora_fin, tramos_libres, inicios }) => ({ hora_inicio, hora_fin, tramos_libres, inicios })) })),
  };
}

/** Lectura visual del Paso 3, sin inferir ocupaciones en el cliente. */
export async function calcularAgendaProfesorWizard(profesorId: string, query: DisponibilidadProfesorQuery) {
  const base = await calcularBaseAgendaProfesor(profesorId, query);
  const porFecha = new Map(base.fechas.map((dia) => [dia.fecha, dia]));
  const meses = [] as Array<{ anio: number; mes: number; etiqueta: string; dias: Array<{
    fecha: string; dia_semana: ReturnType<typeof diaSemanaDeFecha>; numero: number; en_rango: boolean;
    operativo: boolean; tiene_horarios_libres: boolean; seleccionable: boolean; franjas: Omit<FranjaCalculada, "inicios">[];
  }> }>;
  const cursor = new Date(`${base.rango.desde.slice(0, 7)}-01T00:00:00.000Z`);
  const ultimoMes = base.rango.hasta.slice(0, 7);
  while (fechaCalendario(cursor).slice(0, 7) <= ultimoMes) {
    const anio = cursor.getUTCFullYear();
    const mes = cursor.getUTCMonth() + 1;
    const etiqueta = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" }).format(cursor);
    const dias = [] as typeof meses[number]["dias"];
    const finMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    for (let numero = 1; numero <= finMes; numero++) {
      const fechaDate = new Date(Date.UTC(anio, mes - 1, numero));
      const fecha = fechaCalendario(fechaDate);
      const calculado = porFecha.get(fecha);
      const seleccionable = Boolean(calculado?.franjas.some(({ inicios }) => inicios.length > 0));
      dias.push({ fecha, dia_semana: diaSemanaDeFecha(fechaDate), numero,
        en_rango: fecha >= base.rango.desde && fecha <= base.rango.hasta,
        operativo: calculado?.operativo ?? false, tiene_horarios_libres: seleccionable,
        seleccionable, franjas: calculado?.franjas.map(({ hora_inicio, hora_fin, tramos_libres, tramos_ocupados, bloques }) =>
          ({ hora_inicio, hora_fin, tramos_libres, tramos_ocupados, bloques })) ?? [],
      });
    }
    meses.push({ anio, mes, etiqueta: `${etiqueta.charAt(0).toUpperCase()}${etiqueta.slice(1)} ${anio}`, dias });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return { profesor: base.profesor, duracion_min: base.duracion_min, granularidad_min: base.granularidad_min,
    rango: base.rango, franjas_recurrentes: base.franjas_recurrentes, meses };
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

/** Opciones del wizard: exige al menos un horario registrado, sin consultar disponibilidad puntual. */
export async function listarOpcionesProfesorWizard(materiaId: string) {
  if (!(await verificarMateriaActiva(materiaId))) {
    throw new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible");
  }

  const profesores = await listarProfesoresActivosPorMateria(materiaId);
  const opciones = await Promise.all(profesores.map(async ({ id, nombre, apellido }) => ({
    id, nombre, apellido, horarios: await obtenerHorariosDeAtencion(id),
  })));
  return opciones.filter(({ horarios }) => horarios.length > 0);
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
