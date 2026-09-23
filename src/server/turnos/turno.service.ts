import { prisma } from "@/lib/prisma";
import { getParametroNumerico } from "@/server/shared/parametros";
import type { RolUsuario } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";
import { verificarMateriaActiva } from "@/server/materias/materia.service";
import { profesorActivoDictaMateria } from "@/server/profesores/profesor.service";
import { validarConfiguracionTurno } from "./turno.validaciones";
import type { ConfigurarTurnoInput } from "./turno.schema";

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

async function emitirEventoTurno(tipoEvento: string, turnoId: string, usuarioId: string, payloadEvento: Record<string, unknown>) {
  await prisma.eventoTurno.create({ data: { tipoEvento, turnoId, usuarioId, payloadEvento: JSON.parse(JSON.stringify(payloadEvento)) } });
}

async function prepararConfiguracion(input: ConfigurarTurnoInput) {
  const [materia, validacion] = await Promise.all([verificarMateriaActiva(input.materia_id), validarConfiguracionTurno(input)]);
  if (!materia) throw new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible");
  return { validacion, data: { fechaTurno: input.fecha, horaInicioTurno: horaFecha(input.hora_inicio), duracionMinutosTurno: validacion.duracion_minutos, materiaId: input.materia_id } };
}

export async function configurarTurno(input: ConfigurarTurnoInput, usuarioId: string) {
  const { data, validacion } = await prepararConfiguracion(input);
  const turno = await prisma.turno.create({ data: { ...data, estadoTurno: "PENDIENTE", profesorId: null, aulaId: null, creadoPorUsuarioId: usuarioId } });
  await emitirEventoTurno("turno:configurado", turno.idTurno, usuarioId, { turno_id: turno.idTurno, fecha: validacion.fecha, hora_inicio: input.hora_inicio, hora_fin: validacion.hora_fin, materia_id: input.materia_id, usuario_id: usuarioId });
  return { id: turno.idTurno, fecha: validacion.fecha, hora_inicio: input.hora_inicio, hora_fin: validacion.hora_fin, estado: turno.estadoTurno };
}

export async function modificarConfiguracionTurno(id: string, input: ConfigurarTurnoInput, usuarioId: string) {
  const { data, validacion } = await prepararConfiguracion(input);
  const actual = await prisma.turno.findUnique({ where: { idTurno: id }, select: { estadoTurno: true, fechaTurno: true, horaInicioTurno: true, materiaId: true, profesorId: true, updatedAtTurno: true } });
  if (!actual) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
  if (actual.estadoTurno !== "PENDIENTE") throw new ServiceError("TURNO_YA_AGENDADO", "Un turno agendado no admite cambios de configuración");
  const profesorDesasignado = Boolean(actual.profesorId && actual.materiaId !== input.materia_id && !(await profesorActivoDictaMateria(actual.profesorId, input.materia_id)));
  // Estado y versión de la fila se comprueban en la misma sentencia que la mutación.
  const actualizado = await prisma.turno.updateMany({
    where: { idTurno: id, estadoTurno: "PENDIENTE", updatedAtTurno: actual.updatedAtTurno, materiaId: actual.materiaId, profesorId: actual.profesorId },
    data: { ...data, modificadoPorUsuarioId: usuarioId, ...(profesorDesasignado ? { profesorId: null } : {}) },
  });
  if (actualizado.count === 0) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");
  const camposModificados = [
    actual.fechaTurno.getTime() !== input.fecha.getTime() ? "fecha" : null,
    hora(actual.horaInicioTurno) !== input.hora_inicio ? "hora_inicio" : null,
    actual.materiaId !== input.materia_id ? "materia_id" : null,
  ].filter((campo): campo is string => campo !== null);
  await emitirEventoTurno("turno:configuracion_modificada", id, usuarioId, { turno_id: id, campos_modificados: camposModificados, profesor_desasignado: profesorDesasignado, usuario_id: usuarioId });
  return { id, fecha: validacion.fecha, hora_inicio: input.hora_inicio, hora_fin: validacion.hora_fin, materia_id: input.materia_id, estado: "PENDIENTE" as const, profesor_desasignado: profesorDesasignado };
}

type TurnoConRelaciones = NonNullable<Awaited<ReturnType<typeof prisma.turno.findFirst<{ include: typeof turnoInclude }>>>>;

function presentar(turno: TurnoConRelaciones) {
  const fin = new Date(turno.horaInicioTurno.getTime() + turno.duracionMinutosTurno * 60_000);
  const alumnos = turno.alumnos.map(({ alumno }) => ({ id: alumno.idAlumno, nombre: nombre(alumno.apellidoAlumno, alumno.nombreAlumno), dni: alumno.dniAlumno }));
  const alumno = alumnos[0];
  return {
    id: turno.idTurno,
    fecha: fecha(turno.fechaTurno),
    hora_inicio: hora(turno.horaInicioTurno),
    hora_fin: hora(fin),
    duracion_minutos: turno.duracionMinutosTurno,
    alumno: alumnos.length ? alumnos.map(({ nombre }) => nombre).join("; ") : "Sin asignar",
    alumnos,
    alumno_id: alumno?.id ?? null,
    alumno_dni: alumno?.dni ?? null,
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
