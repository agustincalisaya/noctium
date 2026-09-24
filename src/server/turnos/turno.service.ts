import { prisma } from "@/lib/prisma";
import { getParametroNumerico } from "@/server/shared/parametros";
import type { EstadoTurno, Prisma, RolUsuario } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";
import { verificarMateriaActiva } from "@/server/materias/materia.service";
import { profesorActivoDictaMateria } from "@/server/profesores/profesor.service";
import { estaDentroDeHorarioAtencion, intervalosSeSuperponen, listarProfesoresActivosPorMateria } from "@/server/profesores/profesor.service";
import { verificarAlumnoActivo } from "@/server/alumnos/alumno.service";
import { turnoSigueVigente, validarConfiguracionTurno } from "./turno.validaciones";
import { esConflictoDeReserva } from "./turno.reserva-error";
import type { AgregarAlumnoTurnoInput, AsignarParticipantesTurnoInput, ConfigurarTurnoInput } from "./turno.schema";

const turnoInclude = {
  materia: { select: { idMateria: true, nombreMateria: true, codigoMateria: true } },
  profesor: { select: { idProfesor: true, apellidoProfesor: true, nombreProfesor: true, dniProfesor: true } },
  aula: { select: { idAula: true, nombreAula: true, capacidadAula: true } },
  alumnos: { include: { alumno: { select: { idAlumno: true, apellidoAlumno: true, nombreAlumno: true, dniAlumno: true } } } },
} as const;

function fecha(date: Date) { return date.toISOString().slice(0, 10); }
function hora(date: Date) { return date.toISOString().slice(11, 16); }
function nombre(apellido: string, primero: string) { return `${apellido}, ${primero}`; }

function horaFecha(horaInicio: string) { return new Date(`1970-01-01T${horaInicio}:00.000Z`); }

function intervaloTurno(turno: { horaInicioTurno: Date; duracionMinutosTurno: number }) {
  const inicio = turno.horaInicioTurno.getUTCHours() * 60 + turno.horaInicioTurno.getUTCMinutes();
  return { inicio, fin: inicio + turno.duracionMinutosTurno };
}

function horaDeMinutos(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export async function emitirEventoTurno(tipoEvento: string, turnoId: string, usuarioId: string, payloadEvento: Record<string, unknown>) {
  await prisma.eventoTurno.create({ data: { tipoEvento, turnoId, usuarioId, payloadEvento: JSON.parse(JSON.stringify(payloadEvento)) } });
}

async function prepararConfiguracion(input: ConfigurarTurnoInput) {
  const [materia, validacion] = await Promise.all([verificarMateriaActiva(input.materia_id), validarConfiguracionTurno(input)]);
  if (!materia) throw new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible");
  return { validacion, data: { fechaTurno: input.fecha, horaInicioTurno: horaFecha(input.hora_inicio), duracionMinutosTurno: validacion.duracion_minutos, materiaId: input.materia_id, cupoMaximoTurno: input.cupo_maximo } };
}

export async function configurarTurno(input: ConfigurarTurnoInput, usuarioId: string) {
  const { data, validacion } = await prepararConfiguracion(input);
  const turno = await prisma.turno.create({ data: { ...data, estadoTurno: "PENDIENTE", profesorId: null, aulaId: null, creadoPorUsuarioId: usuarioId } });
  await emitirEventoTurno("turno:configurado", turno.idTurno, usuarioId, { turno_id: turno.idTurno, fecha: validacion.fecha, hora_inicio: input.hora_inicio, hora_fin: validacion.hora_fin, materia_id: input.materia_id, cupo_maximo: turno.cupoMaximoTurno, usuario_id: usuarioId });
  return { id: turno.idTurno, fecha: validacion.fecha, hora_inicio: input.hora_inicio, hora_fin: validacion.hora_fin, cupo_maximo: turno.cupoMaximoTurno, estado: turno.estadoTurno };
}

export async function modificarConfiguracionTurno(id: string, input: ConfigurarTurnoInput, usuarioId: string) {
  const { data, validacion } = await prepararConfiguracion(input);
  const actual = await prisma.turno.findUnique({ where: { idTurno: id }, select: { estadoTurno: true, fechaTurno: true, horaInicioTurno: true, materiaId: true, profesorId: true, cupoMaximoTurno: true, updatedAtTurno: true } });
  if (!actual) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
  if (actual.estadoTurno !== "PENDIENTE") throw new ServiceError("TURNO_YA_DISPONIBLE", "Un turno disponible o completo no admite cambios de configuración");
  // Toda carga de alumnos (HU-C-04) actualiza la fila del turno, así que el
  // updatedAtTurno del updateMany invalida este conteo si cambió entretanto.
  const inscriptos = await prisma.turnoAlumno.count({ where: { turnoId: id } });
  if (input.cupo_maximo < inscriptos) throw new ServiceError("CUPO_MENOR_A_INSCRIPTOS", "El nuevo cupo es menor a la cantidad de alumnos ya agregados");
  const profesorDesasignado = Boolean(actual.profesorId && actual.materiaId !== input.materia_id && !(await profesorActivoDictaMateria(actual.profesorId, input.materia_id)));
  // Estado y versión de la fila se comprueban en la misma sentencia que la mutación.
  const actualizado = await prisma.turno.updateMany({
    where: { idTurno: id, estadoTurno: "PENDIENTE", updatedAtTurno: actual.updatedAtTurno, materiaId: actual.materiaId, profesorId: actual.profesorId, cupoMaximoTurno: actual.cupoMaximoTurno },
    data: { ...data, modificadoPorUsuarioId: usuarioId, ...(profesorDesasignado ? { profesorId: null } : {}) },
  });
  if (actualizado.count === 0) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");
  const camposModificados = [
    actual.fechaTurno.getTime() !== input.fecha.getTime() ? "fecha" : null,
    hora(actual.horaInicioTurno) !== input.hora_inicio ? "hora_inicio" : null,
    actual.materiaId !== input.materia_id ? "materia_id" : null,
    actual.cupoMaximoTurno !== input.cupo_maximo ? "cupo_maximo" : null,
  ].filter((campo): campo is string => campo !== null);
  await emitirEventoTurno("turno:configuracion_modificada", id, usuarioId, { turno_id: id, campos_modificados: camposModificados, profesor_desasignado: profesorDesasignado, usuario_id: usuarioId });
  return { id, fecha: validacion.fecha, hora_inicio: input.hora_inicio, hora_fin: validacion.hora_fin, materia_id: input.materia_id, cupo_maximo: input.cupo_maximo, estado: "PENDIENTE" as const, profesor_desasignado: profesorDesasignado };
}

const ESTADOS_AGENDADOS: EstadoTurno[] = ["DISPONIBLE", "COMPLETO"];

/**
 * Primer alumno de `alumnoIds` (en ese orden) con otro turno DISPONIBLE o
 * COMPLETO superpuesto al intervalo. Los turnos PENDIENTE no reservan
 * recursos (spec_modulo_C.md §3.2); los contiguos no se superponen (§3.3).
 */
async function alumnoConTurnoSuperpuesto(
  tx: Prisma.TransactionClient,
  turnoId: string,
  fechaTurno: Date,
  intervalo: { inicio: number; fin: number },
  alumnoIds: string[],
) {
  const otros = await tx.turno.findMany({
    where: { idTurno: { not: turnoId }, fechaTurno, estadoTurno: { in: ESTADOS_AGENDADOS }, alumnos: { some: { alumnoId: { in: alumnoIds } } } },
    select: { horaInicioTurno: true, duracionMinutosTurno: true, alumnos: { where: { alumnoId: { in: alumnoIds } }, select: { alumnoId: true } } },
  });
  const ocupados = new Set(otros.filter((otro) => intervalosSeSuperponen(intervalo, intervaloTurno(otro))).flatMap((otro) => otro.alumnos.map(({ alumnoId }) => alumnoId)));
  return alumnoIds.find((alumnoId) => ocupados.has(alumnoId)) ?? null;
}

// `detalles.alumno_id` identifica el recurso no disponible (HU-C-04 c8) sin
// que el servicio consulte datos del Módulo B (Regla N.° 3).
function alumnoInactivo(alumnoId: string) {
  return new ServiceError("ALUMNO_NO_DISPONIBLE", "El alumno no existe o no está activo", { alumno_id: alumnoId });
}

function alumnoOcupado(alumnoId: string) {
  return new ServiceError("ALUMNO_NO_DISPONIBLE", "El alumno ya tiene un turno agendado en ese horario", { alumno_id: alumnoId });
}

/**
 * HU-C-04 §2.2: carga o reemplazo del profesor y del conjunto completo de
 * alumnos mientras el turno está PENDIENTE (sustituye todos los vínculos).
 */
export async function asignarParticipantesTurno(turnoId: string, input: AsignarParticipantesTurnoInput, usuarioId: string) {
  const resultado = await prisma.$transaction(async (tx) => {
    const turno = await tx.turno.findUnique({
      where: { idTurno: turnoId },
      select: { idTurno: true, estadoTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true, materiaId: true, cupoMaximoTurno: true, updatedAtTurno: true },
    });
    if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
    if (turno.estadoTurno !== "PENDIENTE") throw new ServiceError("TURNO_YA_DISPONIBLE", "Un turno disponible o completo no admite cambios de participantes");
    if (!turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno)) throw new ServiceError("TURNO_VENCIDO", "El horario del turno ya pasó. Corregí su configuración antes de continuar");
    if (input.alumno_ids.length > turno.cupoMaximoTurno) throw new ServiceError("CUPO_INSUFICIENTE", "El turno alcanzó su cupo máximo");

    for (const alumnoId of input.alumno_ids) {
      if (!(await verificarAlumnoActivo(alumnoId, tx))) throw alumnoInactivo(alumnoId);
    }
    const profesores = await listarProfesoresActivosPorMateria(turno.materiaId, tx);
    if (profesores.length === 0) throw new ServiceError("SIN_PROFESORES_PARA_MATERIA", "No hay profesores activos asociados a esta materia");
    if (!profesores.some(({ id }) => id === input.profesor_id)) {
      throw new ServiceError("PROFESOR_NO_APTO", "El profesor no está activo o no dicta esta materia");
    }

    const intervalo = intervaloTurno(turno);
    if (!(await estaDentroDeHorarioAtencion(input.profesor_id, turno.fechaTurno, horaDeMinutos(intervalo.inicio), horaDeMinutos(intervalo.fin), tx))) {
      throw new ServiceError("PROFESOR_FUERA_DE_HORARIO", "El turno está fuera del horario de atención del profesor");
    }
    const turnosDelProfesor = await tx.turno.findMany({
      where: { idTurno: { not: turnoId }, fechaTurno: turno.fechaTurno, estadoTurno: { in: ESTADOS_AGENDADOS }, profesorId: input.profesor_id },
      select: { horaInicioTurno: true, duracionMinutosTurno: true },
    });
    const conflictoProfesor = turnosDelProfesor.find((otro) => intervalosSeSuperponen(intervalo, intervaloTurno(otro)));
    if (conflictoProfesor) {
      const conflicto = intervaloTurno(conflictoProfesor);
      throw new ServiceError("PROFESOR_NO_DISPONIBLE", `El profesor ya tiene un turno agendado de ${horaDeMinutos(conflicto.inicio)} a ${horaDeMinutos(conflicto.fin)}`);
    }
    const ocupado = await alumnoConTurnoSuperpuesto(tx, turnoId, turno.fechaTurno, intervalo, input.alumno_ids);
    if (ocupado) throw alumnoOcupado(ocupado);

    // La actualización condicionada serializa reemplazos del mismo turno y
    // detecta una configuración/asignación concurrente antes de tocar vínculos.
    const actualizado = await tx.turno.updateMany({
      where: { idTurno: turnoId, estadoTurno: "PENDIENTE", updatedAtTurno: turno.updatedAtTurno },
      data: { profesorId: input.profesor_id, modificadoPorUsuarioId: usuarioId },
    });
    if (actualizado.count === 0) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");
    await tx.turnoAlumno.deleteMany({ where: { turnoId } });
    await tx.turnoAlumno.createMany({ data: input.alumno_ids.map((alumnoId) => ({ turnoId, alumnoId })) });
    return { id: turnoId, alumno_ids: input.alumno_ids, profesor_id: input.profesor_id, cupo_maximo: turno.cupoMaximoTurno, estado: "PENDIENTE" as const };
  });
  await emitirEventoTurno("turno:participantes_asignados", turnoId, usuarioId, {
    turno_id: turnoId, alumno_ids: input.alumno_ids, profesor_id: input.profesor_id, usuario_id: usuarioId,
  });
  // HU-C-15 debe volver a comprobar profesor y alumnos al pasar a DISPONIBLE/COMPLETO.
  return resultado;
}

/**
 * Bloquea la fila del turno hasta el fin de la transacción (spec_modulo_C.md
 * §3.7): serializa altas/bajas concurrentes del mismo turno antes de contar
 * inscriptos. Aplica además el guard de vigencia (extensión de HU-C-04).
 */
async function bloquearTurno(tx: Prisma.TransactionClient, turnoId: string) {
  const [fila] = await tx.$queryRaw<{ idTurno: string; cupoMaximoTurno: number; estadoTurno: EstadoTurno }[]>`
    SELECT "idTurno", "cupoMaximoTurno", "estadoTurno" FROM turnos WHERE "idTurno" = ${turnoId} FOR UPDATE`;
  if (!fila) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
  if (fila.estadoTurno === "PENDIENTE") throw new ServiceError("TURNO_PENDIENTE", "El turno está pendiente: los alumnos se cargan desde la asignación de participantes");
  const horario = await tx.turno.findUniqueOrThrow({ where: { idTurno: turnoId }, select: { fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true } });
  if (!turnoSigueVigente(horario.fechaTurno, horario.horaInicioTurno)) throw new ServiceError("TURNO_VENCIDO", "El horario del turno ya pasó");
  return { ...fila, ...horario };
}

/** HU-C-04 §2.5: alta individual de un alumno en un turno DISPONIBLE. */
export async function agregarAlumnoTurno(turnoId: string, input: AgregarAlumnoTurnoInput, usuarioId: string) {
  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx) => {
    const turno = await bloquearTurno(tx, turnoId);
    if (turno.estadoTurno === "COMPLETO") throw new ServiceError("CUPO_INSUFICIENTE", "El turno alcanzó su cupo máximo");
    if (!(await verificarAlumnoActivo(input.alumno_id, tx))) throw alumnoInactivo(input.alumno_id);
    if (await tx.turnoAlumno.findUnique({ where: { turnoId_alumnoId: { turnoId, alumnoId: input.alumno_id } } })) {
      throw new ServiceError("ALUMNO_YA_ASIGNADO", "El mismo alumno no puede agregarse dos veces al mismo turno", { alumno_id: input.alumno_id });
    }
    if (await alumnoConTurnoSuperpuesto(tx, turnoId, turno.fechaTurno, intervaloTurno(turno), [input.alumno_id])) throw alumnoOcupado(input.alumno_id);

    // Con la fila bloqueada, el conteo no puede quedar desactualizado.
    const inscriptos = await tx.turnoAlumno.count({ where: { turnoId } });
    if (inscriptos >= turno.cupoMaximoTurno) throw new ServiceError("CUPO_INSUFICIENTE", "El turno alcanzó su cupo máximo");
    await tx.turnoAlumno.create({ data: { turnoId, alumnoId: input.alumno_id } });
    const completado = inscriptos + 1 >= turno.cupoMaximoTurno
      && (await tx.turno.updateMany({ where: { idTurno: turnoId, estadoTurno: "DISPONIBLE" }, data: { estadoTurno: "COMPLETO", modificadoPorUsuarioId: usuarioId } })).count > 0;
    const alumnoIds = completado ? (await tx.turnoAlumno.findMany({ where: { turnoId }, select: { alumnoId: true } })).map(({ alumnoId }) => alumnoId) : [];
    return { completado, alumnoIds, cupo: turno.cupoMaximoTurno, inscriptos: inscriptos + 1 };
    });
  } catch (error) {
    if (esConflictoDeReserva(error)) throw alumnoOcupado(input.alumno_id);
    throw error;
  }
  await emitirEventoTurno("turno:alumno_agregado", turnoId, usuarioId, { turno_id: turnoId, alumno_id: input.alumno_id, usuario_id: usuarioId });
  if (resultado.completado) {
    await emitirEventoTurno("turno:completado", turnoId, usuarioId, { turno_id: turnoId, alumno_ids: resultado.alumnoIds, cupo_maximo: resultado.cupo, usuario_id: usuarioId });
  }
  return { id: turnoId, alumno_id: input.alumno_id, alumnos_inscriptos: `${resultado.inscriptos}/${resultado.cupo}`, estado: resultado.completado ? "COMPLETO" as const : "DISPONIBLE" as const };
}

/**
 * HU-C-04 §2.5: baja individual en un turno DISPONIBLE o COMPLETO. Borra
 * solo el vínculo TurnoAlumno (no es entidad de dominio: la Regla N.° 1 no
 * aplica). Puede dejar el turno DISPONIBLE en 0/N inscriptos.
 */
export async function quitarAlumnoTurno(turnoId: string, alumnoId: string, usuarioId: string) {
  const resultado = await prisma.$transaction(async (tx) => {
    const turno = await bloquearTurno(tx, turnoId);
    const borrado = await tx.turnoAlumno.deleteMany({ where: { turnoId, alumnoId } });
    if (borrado.count === 0) throw new ServiceError("ALUMNO_NO_ASIGNADO", "El alumno no está inscripto en este turno", { alumno_id: alumnoId });
    const liberado = turno.estadoTurno === "COMPLETO"
      && (await tx.turno.updateMany({ where: { idTurno: turnoId, estadoTurno: "COMPLETO" }, data: { estadoTurno: "DISPONIBLE", modificadoPorUsuarioId: usuarioId } })).count > 0;
    const inscriptos = await tx.turnoAlumno.count({ where: { turnoId } });
    return { liberado, cupo: turno.cupoMaximoTurno, inscriptos, estado: liberado ? "DISPONIBLE" : turno.estadoTurno };
  });
  await emitirEventoTurno("turno:alumno_quitado", turnoId, usuarioId, { turno_id: turnoId, alumno_id: alumnoId, usuario_id: usuarioId });
  if (resultado.liberado) {
    await emitirEventoTurno("turno:disponible_nuevamente", turnoId, usuarioId, { turno_id: turnoId, alumno_id_liberado: alumnoId, usuario_id: usuarioId });
  }
  return { id: turnoId, alumno_id: alumnoId, alumnos_inscriptos: `${resultado.inscriptos}/${resultado.cupo}`, estado: resultado.estado };
}

type TurnoConRelaciones = NonNullable<Awaited<ReturnType<typeof prisma.turno.findFirst<{ include: typeof turnoInclude }>>>>;

function presentar(turno: TurnoConRelaciones) {
  const fin = new Date(turno.horaInicioTurno.getTime() + turno.duracionMinutosTurno * 60_000);
  const alumnos = turno.alumnos.map(({ alumno }) => ({ id: alumno.idAlumno, nombre: nombre(alumno.apellidoAlumno, alumno.nombreAlumno), dni: alumno.dniAlumno }));
  return {
    id: turno.idTurno,
    fecha: fecha(turno.fechaTurno),
    hora_inicio: hora(turno.horaInicioTurno),
    hora_fin: hora(fin),
    duracion_minutos: turno.duracionMinutosTurno,
    cupo_maximo: turno.cupoMaximoTurno,
    alumnos_inscriptos: `${alumnos.length}/${turno.cupoMaximoTurno}`,
    alumnos,
    profesor: turno.profesor ? nombre(turno.profesor.apellidoProfesor, turno.profesor.nombreProfesor) : "Sin asignar",
    profesor_id: turno.profesorId,
    profesor_dni: turno.profesor?.dniProfesor ?? null,
    materia: turno.materia.nombreMateria,
    materia_id: turno.materiaId,
    materia_codigo: turno.materia.codigoMateria,
    aula: turno.aula?.nombreAula ?? "Sin asignar",
    aula_id: turno.aulaId,
    aula_capacidad: turno.aula?.capacidadAula ?? null,
    estado: turno.estadoTurno,
    creado_en: turno.createdAtTurno.toISOString(),
    actualizado_en: turno.updatedAtTurno.toISOString(),
    creado_por_id: turno.creadoPorUsuarioId,
    modificado_por_id: turno.modificadoPorUsuarioId,
  };
}

export async function listarTurnos(pagina: number, porPaginaSolicitado: number | undefined, usuario: { id: string; rol: RolUsuario }) {
  const configurado = await getParametroNumerico("paginacion_limite_default", 10);
  const porPagina = porPaginaSolicitado ?? Math.min(20, Math.max(1, Math.trunc(configurado)));
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const parte = (tipo: string) => partes.find(({ type }) => type === tipo)!.value;
  const inicioHoy = new Date(`${parte("year")}-${parte("month")}-${parte("day")}T00:00:00.000Z`);
  const where = {
    fechaTurno: { gte: inicioHoy },
    ...(usuario.rol === "PROFESOR" ? { profesor: { is: { usuarioId: usuario.id } } } : {}),
  };
  const total = await prisma.turno.count({ where });
  const paginaActual = total === 0 ? 1 : Math.min(pagina, Math.ceil(total / porPagina));
  const turnos = await prisma.turno.findMany({
      where,
      include: turnoInclude,
      orderBy: [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { profesorId: { sort: "asc", nulls: "last" } }, { idTurno: "asc" }],
      skip: (paginaActual - 1) * porPagina,
      take: porPagina,
    });
  return {
    items: turnos.map(presentar),
    paginacion: { total, pagina_actual: paginaActual, total_paginas: Math.ceil(total / porPagina), por_pagina: porPagina },
  };
}

export async function obtenerTurno(id: string, usuario: { id: string; rol: RolUsuario }) {
  const turno = await prisma.turno.findFirst({
    where: { idTurno: id, ...(usuario.rol === "PROFESOR" ? { profesor: { is: { usuarioId: usuario.id } } } : {}) },
    include: turnoInclude,
  });
  if (!turno) return null;
  const [responsable, modificador] = await Promise.all([
    turno.creadoPorUsuarioId ? prisma.usuario.findUnique({ where: { idUsuario: turno.creadoPorUsuarioId }, select: { emailUsuario: true } }) : null,
    turno.modificadoPorUsuarioId ? prisma.usuario.findUnique({ where: { idUsuario: turno.modificadoPorUsuarioId }, select: { emailUsuario: true } }) : null,
  ]);
  return { ...presentar(turno), creado_por: responsable?.emailUsuario ?? turno.creadoPorUsuarioId ?? "Sin registrar", modificado_por: modificador?.emailUsuario ?? turno.modificadoPorUsuarioId ?? "Sin registrar" };
}
