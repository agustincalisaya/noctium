import { prisma } from "@/lib/prisma";
import { getParametroNumerico } from "@/server/shared/parametros";
import type { EstadoTurno, Prisma, PrioridadTurno, RolUsuario, TurnoAlumno } from "@prisma/client";
import type { InscripcionPropia } from "@/types/turno.types";
import { inicioDeTurno, isoCentro } from "@/server/shared/fechas-centro";
import { ServiceError } from "@/server/shared/service-error";
import { listarMateriasActivas, verificarMateriaActiva } from "@/server/materias/materia.service";
import { obtenerOpcionProfesorActivo, profesorActivoDictaMateria, estaDentroDeHorarioAtencion, listarProfesoresActivosPorMateria } from "@/server/profesores/profesor.publico";
import { intervalosSeSuperponen } from "@/lib/horario-atencion";
import { listarIdsAlumnosActivos, obtenerAlumnosBasicos, obtenerAlumnoDeUsuario, verificarAlumnoActivo as verificarAlumnoActivoPublico } from "@/server/alumnos/alumno.publico";
import { obtenerClaseDictadaDeTurno } from "@/server/historial/historial.publico";
import { verificarAulaActiva } from "@/server/aulas/aula.publico";
import { listarOpcionesProfesoresActivos, obtenerOpcionProfesorDeUsuario } from "@/server/profesores/profesor.publico";
import { obtenerEmailDeUsuario } from "@/server/usuarios/usuario.service";
import { turnoSigueVigente, validarConfiguracionTurno } from "./turno.validaciones";
import { alumnosConTurnoSuperpuesto, aulaConTurnoSuperpuesto, ESTADOS_AGENDADOS, horaDeMinutos, intervaloTurno, profesoresConTurnoSuperpuesto } from "./turno.disponibilidad";
import { conflictoDeRecurso, errorDeReserva, esConflictoDeReserva } from "./turno.reserva-error";
import { construirFiltroBusquedaTurno } from "./turno.busqueda";
import type { ActualizarPrioridadInput, AgregarAlumnoTurnoInput, AsignarParticipantesTurnoInput, ConfigurarTurnoInput, MisTurnosQuery, OpcionesInscripcionQuery } from "./turno.schema";
import { bloquear } from "@/server/shared/bloquear";
import { actorUsuario } from "@/server/shared/historial";
import { ahora as relojAhora } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";
import {
  clasesConReservasVencidasDelAlumno,
  crearInscripcion,
  finalizarInscripcion,
  inscripcionVigenteDelPar,
  marcarVencidas,
} from "./inscripcion.service";
import { esVigenteEn, estadoSegunOcupacion, filtroVigenteEn, inscripcionesVigentes } from "./inscripcion.vigencia";

const turnoInclude = {
  materia: { select: { idMateria: true, nombreMateria: true, codigoMateria: true } },
  profesor: { select: { idProfesor: true, apellidoProfesor: true, nombreProfesor: true, dniProfesor: true } },
  aula: { select: { idAula: true, nombreAula: true, capacidadAula: true } },
  alumnos: { include: { alumno: { select: { idAlumno: true, apellidoAlumno: true, nombreAlumno: true, dniAlumno: true } } } },
} as const;

/**
 * `turnoInclude` con solo las inscripciones vigentes a `momento` (PR-0.md
 * §2.0 y §2.2): una inscripción quitada, cancelada o una reserva vencida no
 * figura entre los alumnos del turno.
 */
function incluirTurno(momento: Date) {
  return { ...turnoInclude, alumnos: { ...turnoInclude.alumnos, where: filtroVigenteEn(momento) } };
}

function fecha(date: Date) { return date.toISOString().slice(0, 10); }
function hora(date: Date) { return date.toISOString().slice(11, 16); }
function nombre(apellido: string, primero: string) { return `${apellido}, ${primero}`; }

function horaFecha(horaInicio: string) { return new Date(`1970-01-01T${horaInicio}:00.000Z`); }

const ZONA_TURNOS = "America/Argentina/Buenos_Aires";

function corteLocal(ahora: Date) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_TURNOS,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(ahora);
  const valor = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)!.value);
  return {
    fecha: new Date(Date.UTC(valor("year"), valor("month") - 1, valor("day"))),
    hora: new Date(Date.UTC(1970, 0, 1, valor("hour"), valor("minute"), valor("second"), ahora.getUTCMilliseconds())),
  };
}

function filtroVistaPropia(vista: MisTurnosQuery["vista"], fechaCorte: Date, horaCorte: Date) {
  const esProximo = vista === "proximos";
  return {
    OR: [
      { fechaTurno: esProximo ? { gt: fechaCorte } : { lt: fechaCorte } },
      { fechaTurno: fechaCorte, horaInicioTurno: esProximo ? { gte: horaCorte } : { lt: horaCorte } },
    ],
  };
}

/** HU-C-13 §2.14.1: lista solo los turnos vinculados al alumno de la sesión. */
export async function listarTurnosPropios(
  query: MisTurnosQuery,
  usuarioId: string,
  db: Prisma.TransactionClient = prisma,
  ahora = relojAhora(),
) {
  const alumno = await obtenerAlumnoDeUsuario(usuarioId, db);
  if (!alumno) throw new ServiceError("SIN_PERMISO", "Tu cuenta no tiene una ficha de alumno vinculada");

  const { fecha: fechaCorte, hora: horaCorte } = corteLocal(ahora);
  const vigente = filtroVigenteEn(ahora);
  const propietario = { estadoTurno: { not: "PENDIENTE" as const }, alumnos: { some: { alumnoId: alumno.id } } };
  const filtroProximos = { ...propietario, ...filtroVistaPropia("proximos", fechaCorte, horaCorte) };
  const filtroAnteriores = { ...propietario, ...filtroVistaPropia("anteriores", fechaCorte, horaCorte) };
  const filtroSolicitado = query.vista === "proximos" ? filtroProximos : filtroAnteriores;
  const [proximos, anteriores, turnos] = await Promise.all([
    db.turno.count({ where: filtroProximos }),
    db.turno.count({ where: filtroAnteriores }),
    db.turno.findMany({
      where: filtroSolicitado,
      select: {
        idTurno: true,
        fechaTurno: true,
        horaInicioTurno: true,
        duracionMinutosTurno: true,
        estadoTurno: true,
        cupoMaximoTurno: true,
        materia: { select: { nombreMateria: true } },
        profesor: { select: { apellidoProfesor: true, nombreProfesor: true } },
        aula: { select: { nombreAula: true } },
        _count: { select: { alumnos: { where: vigente } } },
        alumnos: { where: { alumnoId: alumno.id }, orderBy: [{ reservadaEl: "desc" }, { idInscripcion: "desc" }] },
      },
      orderBy: query.vista === "proximos"
        ? [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { idTurno: "asc" }]
        : [{ fechaTurno: "desc" }, { horaInicioTurno: "desc" }, { idTurno: "desc" }],
      skip: (query.pagina - 1) * query.por_pagina,
      take: query.por_pagina,
    }),
  ]);
  const total = query.vista === "proximos" ? proximos : anteriores;
  const items = await Promise.all(turnos.map(async (turno) => {
    const claseDictada = await obtenerClaseDictadaDeTurno(turno.idTurno, db);
    return {
      turno_id: turno.idTurno,
      fecha: fecha(turno.fechaTurno),
      hora_inicio: hora(turno.horaInicioTurno),
      hora_fin: hora(new Date(turno.horaInicioTurno.getTime() + turno.duracionMinutosTurno * 60_000)),
      materia: turno.materia.nombreMateria,
      profesor: turno.profesor ? nombre(turno.profesor.apellidoProfesor, turno.profesor.nombreProfesor) : "Sin asignar",
      aula: turno.aula?.nombreAula ?? "Sin asignar",
      estado: estadoSegunOcupacion(turno.estadoTurno, turno._count.alumnos, turno.cupoMaximoTurno),
      clase_dictada: claseDictada !== null,
      inscripcion: presentarInscripcionPropia(
        turno.alumnos.find((fila) => esVigenteEn({ ...fila, estadoClase: turno.estadoTurno }, ahora)) ?? turno.alumnos[0]!,
        turno, ahora,
      ),
    };
  }));

  return {
    items,
    paginacion: {
      total,
      pagina_actual: query.pagina,
      total_paginas: Math.ceil(total / query.por_pagina),
      por_pagina: query.por_pagina,
    },
    totales: { proximos, anteriores },
  };
}

function presentarInscripcionPropia(
  fila: TurnoAlumno,
  turno: { estadoTurno: EstadoTurno; fechaTurno: Date; horaInicioTurno: Date },
  momento: Date,
): InscripcionPropia {
  let situacion: InscripcionPropia["situacion"];
  if (fila.vigencia !== "VIGENTE") situacion = fila.vigencia;
  else if (!esVigenteEn({ ...fila, estadoClase: turno.estadoTurno }, momento)) situacion = "RESERVA_VENCIDA";
  else if (fila.estadoPago === "PAGADA") situacion = "PAGADA";
  else if (!["DISPONIBLE", "COMPLETO"].includes(turno.estadoTurno) || inicioDeTurno(turno).getTime() <= momento.getTime()) situacion = "PAGO_SIN_REGISTRAR";
  else situacion = fila.estadoPago === "RESERVADA" ? "RESERVADA" : "PAGO_PENDIENTE";
  return { id: fila.idInscripcion, situacion, vence_el: fila.venceEl ? isoCentro(fila.venceEl) : null, precio: fila.precio };
}

/** Confirmación actual independiente de la página del listado; identidad de sesión. */
export async function obtenerConfirmacionReservaPropia(
  inscripcionId: string, usuarioId: string, db: Prisma.TransactionClient = prisma, momento = relojAhora(),
): Promise<InscripcionPropia | null> {
  const alumno = await obtenerAlumnoDeUsuario(usuarioId, db);
  if (!alumno) return null;
  const fila = await db.turnoAlumno.findFirst({
    where: { idInscripcion: inscripcionId, alumnoId: alumno.id }, include: { turno: true },
  });
  return fila ? presentarInscripcionPropia(fila, fila.turno, momento) : null;
}

export async function emitirEventoTurno(tipoEvento: string, turnoId: string, usuarioId: string, payloadEvento: Record<string, unknown>) {
  await prisma.eventoTurno.create({ data: { tipoEvento, turnoId, usuarioId, payloadEvento: JSON.parse(JSON.stringify(payloadEvento)) } });
}

async function prepararConfiguracion(input: ConfigurarTurnoInput) {
  const [materia, validacion] = await Promise.all([verificarMateriaActiva(input.materia_id), validarConfiguracionTurno(input)]);
  if (!materia) throw new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible");
  // Sin cupo: se fija con la capacidad del aula al asignarla (Revisión 3, §2.3).
  // Duración elegida en el formulario (Revisión 4), no un parámetro fijo.
  return { validacion, data: { fechaTurno: input.fecha, horaInicioTurno: horaFecha(input.hora_inicio), duracionMinutosTurno: input.duracion_min, materiaId: input.materia_id } };
}

async function validarProfesorConfiguracion(input: ConfigurarTurnoInput, data: Awaited<ReturnType<typeof prepararConfiguracion>>["data"], db: Prisma.TransactionClient, turnoId?: string) {
  if (!(await obtenerOpcionProfesorActivo(input.profesor_id, db))) throw new ServiceError("PROFESOR_NO_ENCONTRADO", "No se encontró un profesor activo");
  if (!(await profesorActivoDictaMateria(input.profesor_id, input.materia_id, db))) throw new ServiceError("PROFESOR_NO_DICTA_MATERIA", "El profesor no dicta la materia seleccionada");
  const turno = { idTurno: turnoId, fechaTurno: data.fechaTurno, horaInicioTurno: data.horaInicioTurno, duracionMinutosTurno: data.duracionMinutosTurno };
  const intervalo = intervaloTurno(turno);
  if (!(await estaDentroDeHorarioAtencion(input.profesor_id, input.fecha, horaDeMinutos(intervalo.inicio), horaDeMinutos(intervalo.fin), db))) {
    throw new ServiceError("PROFESOR_FUERA_DE_HORARIO", "El profesor no atiende en ese horario");
  }
  const conflicto = (await profesoresConTurnoSuperpuesto(db, turno, [input.profesor_id])).get(input.profesor_id);
  if (conflicto) throw new ServiceError("PROFESOR_NO_DISPONIBLE", "El profesor ya tiene un turno en ese horario");
}

export async function configurarTurno(input: ConfigurarTurnoInput, usuarioId: string) {
  const { data, validacion } = await prepararConfiguracion(input);
  const turno = await prisma.$transaction(async (tx) => {
    await validarProfesorConfiguracion(input, data, tx);
    return tx.turno.create({ data: { ...data, estadoTurno: "PENDIENTE", profesorId: input.profesor_id, aulaId: null, cupoMaximoTurno: null, creadoPorUsuarioId: usuarioId } });
  });
  await emitirEventoTurno("turno:configurado", turno.idTurno, usuarioId, { turno_id: turno.idTurno, fecha: validacion.fecha, hora_inicio: input.hora_inicio, hora_fin: validacion.hora_fin, duracion_min: input.duracion_min, materia_id: input.materia_id, profesor_id: input.profesor_id, usuario_id: usuarioId });
  return { id: turno.idTurno, fecha: validacion.fecha, hora_inicio: input.hora_inicio, hora_fin: validacion.hora_fin, duracion_min: input.duracion_min, profesor_id: input.profesor_id, cupo_maximo: turno.cupoMaximoTurno, estado: turno.estadoTurno };
}

export async function modificarConfiguracionTurno(id: string, input: ConfigurarTurnoInput, usuarioId: string) {
  const { data, validacion } = await prepararConfiguracion(input);
  const { actual, aulaDesasignada } = await prisma.$transaction(async (tx) => {
    const pendiente = await tx.turno.findUnique({ where: { idTurno: id }, select: { estadoTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true, materiaId: true, profesorId: true, aulaId: true, cupoMaximoTurno: true, updatedAtTurno: true } });
    if (!pendiente) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
    if (pendiente.estadoTurno !== "PENDIENTE") throw new ServiceError("TURNO_YA_DISPONIBLE", "Un turno disponible o completo no admite cambios de configuración");
    await validarProfesorConfiguracion(input, data, tx, id);
    // Estado y versión de la fila se comprueban en la misma sentencia que la mutación.
    const actualizado = await tx.turno.updateMany({
      where: { idTurno: id, estadoTurno: "PENDIENTE", updatedAtTurno: pendiente.updatedAtTurno, materiaId: pendiente.materiaId, profesorId: pendiente.profesorId },
      data: { ...data, profesorId: input.profesor_id, modificadoPorUsuarioId: usuarioId },
    });
    if (actualizado.count === 0) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");
    const aulaDesasignada = pendiente.aulaId !== null && await aulaConTurnoSuperpuesto(tx, {
      idTurno: id, fechaTurno: data.fechaTurno, horaInicioTurno: data.horaInicioTurno, duracionMinutosTurno: data.duracionMinutosTurno,
    }, pendiente.aulaId);
    if (aulaDesasignada) {
      const desasignado = await tx.turno.updateMany({
        where: { idTurno: id, estadoTurno: "PENDIENTE", aulaId: pendiente.aulaId },
        data: { aulaId: null, cupoMaximoTurno: null, modificadoPorUsuarioId: usuarioId },
      });
      if (desasignado.count === 0) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");
    }
    return { actual: pendiente, aulaDesasignada };
  });
  const camposModificados = [
    actual.fechaTurno.getTime() !== input.fecha.getTime() ? "fecha" : null,
    hora(actual.horaInicioTurno) !== input.hora_inicio ? "hora_inicio" : null,
    actual.duracionMinutosTurno !== input.duracion_min ? "duracion_min" : null,
    actual.materiaId !== input.materia_id ? "materia_id" : null,
    actual.profesorId !== input.profesor_id ? "profesor_id" : null,
  ].filter((campo): campo is string => campo !== null);
  await emitirEventoTurno("turno:configuracion_modificada", id, usuarioId, { turno_id: id, campos_modificados: camposModificados, aula_desasignada: aulaDesasignada, profesor_desasignado: false, usuario_id: usuarioId });
  return { id, fecha: validacion.fecha, hora_inicio: input.hora_inicio, hora_fin: validacion.hora_fin, duracion_min: input.duracion_min, materia_id: input.materia_id, profesor_id: input.profesor_id, cupo_maximo: aulaDesasignada ? null : actual.cupoMaximoTurno, estado: "PENDIENTE" as const, profesor_desasignado: false, aula_desasignada: aulaDesasignada };
}

function idsAlumnosOcupados(otros: { horaInicioTurno: Date; duracionMinutosTurno: number; alumnos: { alumnoId: string }[] }[], intervalo: { inicio: number; fin: number }) {
  return new Set(otros.filter((otro) => intervalosSeSuperponen(intervalo, intervaloTurno(otro)))
    .flatMap((otro) => otro.alumnos.map(({ alumnoId }) => alumnoId)));
}

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
  const turno = { idTurno: turnoId, fechaTurno, horaInicioTurno: new Date(Date.UTC(1970, 0, 1, 0, intervalo.inicio)), duracionMinutosTurno: intervalo.fin - intervalo.inicio };
  return (await alumnosConTurnoSuperpuesto(tx, turno, alumnoIds, relojAhora()))[0] ?? null;
}

function alumnoOcupado(alumnoId: string) {
  return new ServiceError("ALUMNO_NO_DISPONIBLE", "El alumno ya tiene un turno agendado en ese horario", { alumno_id: alumnoId });
}

/** Lectura preventiva del Paso 5. La confirmación conserva su validación transaccional. */
export async function listarOpcionesAlumnoTurno(turnoId: string) {
  const turno = await prisma.turno.findUnique({
    where: { idTurno: turnoId },
    select: { estadoTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true, aulaId: true, cupoMaximoTurno: true },
  });
  if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
  if (turno.estadoTurno !== "PENDIENTE") throw new ServiceError("TURNO_YA_DISPONIBLE", "Un turno disponible o completo no admite cambios de participantes");
  if (!turno.aulaId || turno.cupoMaximoTurno === null) throw new ServiceError("TURNO_SIN_AULA", "Asigná un aula antes de confirmar el turno");

  const ids = await listarIdsAlumnosActivos();
  if (ids.length === 0) return { turno_id: turnoId, alumnos: [] };
  const vigente = filtroVigenteEn(relojAhora());
  const [basicos, otros] = await Promise.all([
    obtenerAlumnosBasicos(ids),
    prisma.turno.findMany({
      where: { idTurno: { not: turnoId }, fechaTurno: turno.fechaTurno, estadoTurno: { in: ESTADOS_AGENDADOS }, alumnos: { some: { alumnoId: { in: ids }, ...vigente } } },
      select: { horaInicioTurno: true, duracionMinutosTurno: true, alumnos: { where: { alumnoId: { in: ids }, ...vigente }, select: { alumnoId: true } } },
    }),
  ]);
  const intervalo = intervaloTurno(turno);
  const ocupados = idsAlumnosOcupados(otros, intervalo);
  const alumnos = basicos.filter((alumno) => alumno.activo && !ocupados.has(alumno.id))
    .sort((a, b) => a.apellido.localeCompare(b.apellido, "es") || a.nombre.localeCompare(b.nombre, "es") || a.dni.localeCompare(b.dni, "es"))
    .map(({ id, nombre, apellido, dni }) => ({ id, nombre, apellido, dni }));
  return { turno_id: turnoId, alumnos };
}

/**
 * HU-C-04 §2.2 (Revisión 3): último paso del flujo. Con el aula ya asignada,
 * carga profesor + conjunto completo de alumnos y confirma el turno
 * (PENDIENTE → DISPONIBLE o COMPLETO) en la misma transacción.
 */
export async function asignarParticipantesTurno(turnoId: string, input: AsignarParticipantesTurnoInput, usuarioId: string) {
  let resultado;
  try {
    resultado = await transaccion(async (tx) => {
      // Un solo bloqueo en orden canónico (PR-0.md §2.16): los alumnos, la
      // clase y las clases donde tienen reservas vencidas sin marcar.
      const momento = relojAhora();
      const conVencidas = (await Promise.all(input.alumno_ids.map((alumnoId) => clasesConReservasVencidasDelAlumno(tx, alumnoId, momento)))).flat();
      await bloquear(tx, { recursos: { alumnos: input.alumno_ids }, clases: [turnoId, ...conVencidas] });
      const turno = await tx.turno.findUnique({
        where: { idTurno: turnoId },
        select: { idTurno: true, estadoTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true, materiaId: true, profesorId: true, aulaId: true, cupoMaximoTurno: true, updatedAtTurno: true },
      });
      if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
      if (turno.estadoTurno !== "PENDIENTE") throw new ServiceError("TURNO_YA_DISPONIBLE", "Un turno disponible o completo no admite cambios de participantes");
      const { aulaId, cupoMaximoTurno: cupo } = turno;
      // Sin aula no hay cupo contra el cual validar (§2.3 lo fija).
      if (!aulaId || cupo === null) throw new ServiceError("TURNO_SIN_AULA", "Asigná un aula antes de confirmar el turno");
      if (!turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno)) throw new ServiceError("TURNO_VENCIDO", "El horario del turno ya pasó. Corregí su configuración antes de continuar");
      if (input.alumno_ids.length > cupo) throw new ServiceError("CUPO_INSUFICIENTE", "El turno alcanzó su cupo máximo");
      if (!(await verificarMateriaActiva(turno.materiaId, tx))) throw new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible");

      for (const alumnoId of input.alumno_ids) {
        try { await verificarAlumnoActivoPublico(alumnoId, tx); }
        catch (error) {
          if (error instanceof ServiceError) throw new ServiceError(error.code, error.message, { alumno_id: alumnoId });
          throw error;
        }
      }
      const profesorId = input.profesor_id ?? turno.profesorId;
      if (!profesorId) throw new ServiceError("TURNO_SIN_PROFESOR", "Elegí un profesor antes de confirmar el turno");
      if (input.profesor_id && input.profesor_id !== turno.profesorId) {
        const profesores = await listarProfesoresActivosPorMateria(turno.materiaId, tx);
        if (profesores.length === 0) throw new ServiceError("SIN_PROFESORES_PARA_MATERIA", "No hay profesores activos asociados a esta materia");
      }
      if (!(await obtenerOpcionProfesorActivo(profesorId, tx))) throw new ServiceError("PROFESOR_NO_ENCONTRADO", "No se encontró un profesor activo");
      if (!(await profesorActivoDictaMateria(profesorId, turno.materiaId, tx))) {
        throw new ServiceError("PROFESOR_NO_DICTA_MATERIA", "El profesor no dicta la materia seleccionada");
      }

      const intervalo = intervaloTurno(turno);
      if (!(await estaDentroDeHorarioAtencion(profesorId, turno.fechaTurno, horaDeMinutos(intervalo.inicio), horaDeMinutos(intervalo.fin), tx))) {
        throw new ServiceError("PROFESOR_FUERA_DE_HORARIO", "El turno está fuera del horario de atención del profesor");
      }
      const conflictoProfesor = (await profesoresConTurnoSuperpuesto(tx, turno, [profesorId])).get(profesorId);
      if (conflictoProfesor) {
        throw new ServiceError("PROFESOR_NO_DISPONIBLE", `El profesor ya tiene un turno agendado de ${horaDeMinutos(conflictoProfesor.inicio)} a ${horaDeMinutos(conflictoProfesor.fin)}`);
      }
      const ocupado = await alumnoConTurnoSuperpuesto(tx, turnoId, turno.fechaTurno, intervalo, input.alumno_ids);
      if (ocupado) throw alumnoOcupado(ocupado);
      // El aula se eligió con el turno PENDIENTE (sin reservar): puede haber
      // dejado de estar activa o libre desde entonces (§2.2 paso 5).
      if (!(await verificarAulaActiva(aulaId, tx))) throw new ServiceError("AULA_INACTIVA", "El aula asignada ya no está activa. Asigná otra aula");
      if (await aulaConTurnoSuperpuesto(tx, turno, aulaId)) throw conflictoDeRecurso("AULA");

      // La actualización condicionada serializa reemplazos del mismo turno y
      // detecta una configuración/asignación concurrente antes de tocar vínculos.
      const actualizado = await tx.turno.updateMany({
        where: { idTurno: turnoId, estadoTurno: "PENDIENTE", updatedAtTurno: turno.updatedAtTurno },
        data: { ...(profesorId !== turno.profesorId ? { profesorId } : {}), modificadoPorUsuarioId: usuarioId },
      });
      if (actualizado.count === 0) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");

      // Confirmación: el trigger de estadoTurno proyecta profesor y aula en
      // reservas_turno (§3.4); una exclusión GiST revierte toda la transacción.
      const confirmado = await tx.turno.updateMany({ where: { idTurno: turnoId, estadoTurno: "PENDIENTE" }, data: { estadoTurno: "DISPONIBLE" } });
      if (confirmado.count === 0) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");

      // Reemplazo del conjunto (PR-0.md §2.0): la inscripción no se borra. Las
      // vigentes que no siguen pasan a QUITADA_CENTRO y los alumnos nuevos se
      // inscriben con crearInscripcion como reserva con plazo (HU-C-24, 2.18.3),
      // que proyecta su reserva y pasa la clase a COMPLETO al llenar el cupo.
      const actor = actorUsuario(usuarioId);
      const elegidos = new Set(input.alumno_ids);
      for (const vigente of await inscripcionesVigentes(tx, turnoId, momento)) {
        if (elegidos.has(vigente.alumnoId)) elegidos.delete(vigente.alumnoId);
        else await finalizarInscripcion(tx, { inscripcionId: vigente.id, vigencia: "QUITADA_CENTRO", actor, fecha: momento });
      }
      const inscripciones = [];
      for (const alumnoId of input.alumno_ids.filter((id) => elegidos.has(id))) {
        const { inscripcion } = await crearInscripcion(tx, { turnoId, alumnoId, origen: "CENTRO", conReserva: true, actor, bloqueosTomados: true, momento });
        inscripciones.push({
          alumno_id: alumnoId, inscripcion_id: inscripcion.id, estado_pago: inscripcion.estadoPago,
          vence_el: inscripcion.venceEl ? isoCentro(inscripcion.venceEl) : null, precio: inscripcion.precio,
        });
      }
      const estado = input.alumno_ids.length >= cupo ? "COMPLETO" as const : "DISPONIBLE" as const;
      return {
        respuesta: { id: turnoId, alumno_ids: input.alumno_ids, profesor_id: profesorId, cupo_maximo: cupo, estado, inscripciones },
        evento: { fecha: fecha(turno.fechaTurno), hora_inicio: horaDeMinutos(intervalo.inicio), hora_fin: horaDeMinutos(intervalo.fin), aula_id: aulaId, materia_id: turno.materiaId },
      };
    }, { tiempos: { timeoutMs: 15_000 } });
  } catch (error) {
    if (esConflictoDeReserva(error)) throw errorDeReserva(error);
    throw error;
  }
  const { respuesta, evento } = resultado;
  await emitirEventoTurno("turno:participantes_asignados", turnoId, usuarioId, {
    turno_id: turnoId, alumno_ids: input.alumno_ids, profesor_id: respuesta.profesor_id, usuario_id: usuarioId,
  });
  if (respuesta.estado === "COMPLETO") {
    await emitirEventoTurno("turno:completado", turnoId, usuarioId, { turno_id: turnoId, alumno_ids: input.alumno_ids, cupo_maximo: respuesta.cupo_maximo, usuario_id: usuarioId });
  } else {
    await emitirEventoTurno("turno:disponibilizado", turnoId, usuarioId, {
      turno_id: turnoId, fecha: evento.fecha, hora_inicio: evento.hora_inicio, hora_fin: evento.hora_fin, alumno_ids: input.alumno_ids,
      profesor_id: respuesta.profesor_id, aula_id: evento.aula_id, materia_id: evento.materia_id, usuario_id: usuarioId,
    });
  }
  return respuesta;
}

/**
 * Bloquea la fila del turno hasta el fin de la transacción (spec_modulo_C.md
 * §3.7): serializa altas/bajas concurrentes del mismo turno antes de contar
 * inscriptos. Aplica además el guard de vigencia (extensión de HU-C-04).
 */
type OrigenInscripcion = "MESA_ENTRADA" | "AUTOSERVICIO";

async function bloquearTurno(tx: Prisma.TransactionClient, turnoId: string) {
  const [fila] = await tx.$queryRaw<{ idTurno: string; cupoMaximoTurno: number | null; estadoTurno: EstadoTurno }[]>`
    SELECT "idTurno", "cupoMaximoTurno", "estadoTurno" FROM turnos WHERE "idTurno" = ${turnoId} FOR UPDATE`;
  if (!fila) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
  if (fila.estadoTurno === "CANCELADO") throw new ServiceError("TURNO_CANCELADO", "El turno está cancelado");
  if (fila.estadoTurno === "PENDIENTE") throw new ServiceError("TURNO_PENDIENTE", "El turno está pendiente: los alumnos se cargan desde la asignación de participantes");
  // Un turno confirmado siempre tiene aula y, por lo tanto, cupo (§2.2).
  const cupoMaximoTurno = fila.cupoMaximoTurno;
  if (cupoMaximoTurno === null) throw new ServiceError("TURNO_SIN_AULA", "El turno no tiene aula asignada");
  const horario = await tx.turno.findUniqueOrThrow({ where: { idTurno: turnoId }, select: { fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true } });
  if (!turnoSigueVigente(horario.fechaTurno, horario.horaInicioTurno)) throw new ServiceError("TURNO_VENCIDO", "El horario del turno ya pasó");
  return { ...fila, cupoMaximoTurno, ...horario };
}

/**
 * Núcleo común para HU-C-04 §2.5 y HU-C-12 §2.14.2; el caller emite eventos
 * después del commit. Inscribe con `crearInscripcion` (PR-0.md §2.13 y
 * §2.15: C-22 reserva en autoservicio y C-24 en el centro), que bloquea al alumno
 * y la clase, vence perezosamente las reservas, revalida estado, cupo,
 * repetido y superposición con los mismos códigos y textos de hoy, y
 * recalcula el estado guardado de la clase. `tx` lo abre `transaccion()`.
 */
export async function inscribirAlumnoEnTurno(
  turnoId: string,
  alumnoId: string,
  { origen, usuarioId, alumnoActivo }: { origen: OrigenInscripcion; usuarioId: string; alumnoActivo?: boolean },
  tx: Prisma.TransactionClient,
) {
  const creada = await crearInscripcion(tx, {
    turnoId, alumnoId, origen: origen === "AUTOSERVICIO" ? "ALUMNO" : "CENTRO", conReserva: true,
    actor: actorUsuario(usuarioId), alumnoActivo,
  });
  return { completado: creada.completado, alumnoIds: creada.completado ? creada.alumnoIds : [], cupo: creada.cupo, inscriptos: creada.inscriptos, inscripcion: creada.inscripcion };
}

async function emitirEventosInscripcion(turnoId: string, alumnoId: string, usuarioId: string, origen: OrigenInscripcion, resultado: Awaited<ReturnType<typeof inscribirAlumnoEnTurno>>) {
  await emitirEventoTurno("turno:alumno_agregado", turnoId, usuarioId, { turno_id: turnoId, alumno_id: alumnoId, usuario_id: usuarioId, origen });
  if (resultado.completado) {
    await emitirEventoTurno("turno:completado", turnoId, usuarioId, { turno_id: turnoId, alumno_ids: resultado.alumnoIds, cupo_maximo: resultado.cupo, usuario_id: usuarioId });
  }
}

/** HU-C-04 §2.5: alta individual de un alumno en un turno DISPONIBLE. */
export async function agregarAlumnoTurno(turnoId: string, input: AgregarAlumnoTurnoInput, usuarioId: string) {
  let resultado;
  try {
    resultado = await transaccion((tx) => inscribirAlumnoEnTurno(turnoId, input.alumno_id, { origen: "MESA_ENTRADA", usuarioId }, tx));
  } catch (error) {
    if (esConflictoDeReserva(error)) throw alumnoOcupado(input.alumno_id);
    throw error;
  }
  await emitirEventosInscripcion(turnoId, input.alumno_id, usuarioId, "MESA_ENTRADA", resultado);
  return {
    id: turnoId, alumno_id: input.alumno_id, alumnos_inscriptos: `${resultado.inscriptos}/${resultado.cupo}`, estado: resultado.completado ? "COMPLETO" as const : "DISPONIBLE" as const,
    inscripcion: { id: resultado.inscripcion.id, estado_pago: resultado.inscripcion.estadoPago, vence_el: resultado.inscripcion.venceEl ? isoCentro(resultado.inscripcion.venceEl) : null, precio: resultado.inscripcion.precio },
    ofrecer_pago: true as const,
  };
}

/** HU-C-12 §2.14.2: identidad exclusivamente derivada de la sesión. */
export async function solicitarTurnoPropio(turnoId: string, usuarioId: string) {
  const alumno = await obtenerAlumnoDeUsuario(usuarioId);
  if (!alumno) throw new ServiceError("SIN_PERMISO", "Tu cuenta no tiene una ficha de alumno vinculada");
  let resultado;
  try {
    resultado = await transaccion((tx) => inscribirAlumnoEnTurno(turnoId, alumno.id, { origen: "AUTOSERVICIO", usuarioId, alumnoActivo: alumno.activo }, tx));
  } catch (error) {
    if (esConflictoDeReserva(error)) throw new ServiceError("ALUMNO_NO_DISPONIBLE", "Ya tenés otro turno en ese horario");
    if (error instanceof ServiceError && (error.code === "TURNO_PENDIENTE" || error.code === "TURNO_CANCELADO")) {
      throw new ServiceError("TURNO_NO_DISPONIBLE", "El turno ya no está disponible");
    }
    if (error instanceof ServiceError && error.code === "ALUMNO_NO_DISPONIBLE") {
      throw new ServiceError("ALUMNO_NO_DISPONIBLE", "Ya tenés otro turno en ese horario");
    }
    throw error;
  }
  await emitirEventosInscripcion(turnoId, alumno.id, usuarioId, "AUTOSERVICIO", resultado);
  return { id: turnoId, alumnos_inscriptos: `${resultado.inscriptos}/${resultado.cupo}`, estado: resultado.completado ? "COMPLETO" as const : "DISPONIBLE" as const,
    inscripcion: { id: resultado.inscripcion.id, estado_pago: resultado.inscripcion.estadoPago, vence_el: resultado.inscripcion.venceEl ? isoCentro(resultado.inscripcion.venceEl) : null, precio: resultado.inscripcion.precio },
  };
}

/** HU-C-12 §2.14.2: solo ofrece turnos que este alumno puede elegir ahora. */
export async function listarOpcionesInscripcion(query: OpcionesInscripcionQuery, usuarioId: string) {
  const alumno = await obtenerAlumnoDeUsuario(usuarioId);
  if (!alumno) throw new ServiceError("SIN_PERMISO", "Tu cuenta no tiene una ficha de alumno vinculada");
  if (!alumno.activo) throw new ServiceError("ALUMNO_INACTIVO", "Tu ficha de alumno no está activa");

  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)!.value;
  const hoy = new Date(`${valor("year")}-${valor("month")}-${valor("day")}T00:00:00.000Z`);

  // El estado guardado puede estar viejo por el vencimiento perezoso: se
  // ofrecen las clases confirmadas y decide la ocupación vigente (PR-0.md §2.2).
  const vigente = filtroVigenteEn(relojAhora());
  const [turnos, materias] = await Promise.all([
    prisma.turno.findMany({
      where: {
        estadoTurno: { in: ESTADOS_AGENDADOS }, fechaTurno: { gte: hoy },
        ...(query.materia_id ? { materiaId: query.materia_id } : {}),
        ...(query.profesor_id ? { profesorId: query.profesor_id } : {}),
        alumnos: { none: { alumnoId: alumno.id, ...vigente } },
      },
      select: {
        idTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true,
        materiaId: true, profesorId: true, cupoMaximoTurno: true,
        aula: { select: { nombreAula: true } },
        _count: { select: { alumnos: { where: vigente } } },
      },
      orderBy: [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { idTurno: "asc" }],
    }),
    listarMateriasActivas(),
  ]);
  const inscribibles = turnos.filter((turno) =>
    turno.profesorId && turno.cupoMaximoTurno !== null
    && turno._count.alumnos < turno.cupoMaximoTurno
    && turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno));
  const cantidadPorMateria = new Map<string, number>();
  const cantidadPorProfesor = new Map<string, number>();
  for (const turno of inscribibles) {
    cantidadPorMateria.set(turno.materiaId, (cantidadPorMateria.get(turno.materiaId) ?? 0) + 1);
    if (turno.profesorId) cantidadPorProfesor.set(turno.profesorId, (cantidadPorProfesor.get(turno.profesorId) ?? 0) + 1);
  }

  if (!query.materia_id) {
    return { items: materias
      .filter((materia) => cantidadPorMateria.has(materia.idMateria))
      .map((materia) => ({ id: materia.idMateria, nombre: materia.nombreMateria, turnos_con_lugar: cantidadPorMateria.get(materia.idMateria)! })) };
  }

  if (!materias.some((materia) => materia.idMateria === query.materia_id)) return { items: [] };
  const profesores = await listarProfesoresActivosPorMateria(query.materia_id);
  if (!query.profesor_id) {
    return { items: profesores
      .filter((profesor) => cantidadPorProfesor.has(profesor.id))
      .map((profesor) => ({ id: profesor.id, nombre: `${profesor.apellido}, ${profesor.nombre}`, turnos_con_lugar: cantidadPorProfesor.get(profesor.id)! })) };
  }

  if (!profesores.some((profesor) => profesor.id === query.profesor_id)) return { items: [] };
  return { items: inscribibles.map((turno) => ({
    turno_id: turno.idTurno,
    fecha: fecha(turno.fechaTurno),
    hora_inicio: hora(turno.horaInicioTurno),
    hora_fin: hora(new Date(turno.horaInicioTurno.getTime() + turno.duracionMinutosTurno * 60_000)),
    aula: turno.aula?.nombreAula ?? "",
    cupos_libres: turno.cupoMaximoTurno! - turno._count.alumnos,
  })) };
}

/**
 * HU-C-04 §2.5: baja individual en un turno DISPONIBLE o COMPLETO. La
 * inscripción no se borra (PR-0.md §2.0): pasa a QUITADA_CENTRO con fecha y
 * usuario (`finalizarInscripcion`), que libera la franja del alumno y
 * recalcula el estado de la clase. Puede dejar el turno DISPONIBLE en 0/N.
 */
export async function quitarAlumnoTurno(turnoId: string, alumnoId: string, usuarioId: string) {
  const resultado = await transaccion(async (tx) => {
    const momento = relojAhora();
    await bloquear(tx, { clases: [turnoId] });
    const turno = await bloquearTurno(tx, turnoId);
    // Una reserva vencida sin marcar ya no es una inscripción: se marca primero (2.2).
    const marcadas = await marcarVencidas(tx, turnoId, { momento });
    const estadoAntes = marcadas === 0 ? turno.estadoTurno
      : (await tx.turno.findUniqueOrThrow({ where: { idTurno: turnoId }, select: { estadoTurno: true } })).estadoTurno;
    const inscripcion = await inscripcionVigenteDelPar(alumnoId, turnoId, tx);
    if (!inscripcion) throw new ServiceError("ALUMNO_NO_ASIGNADO", "El alumno no está inscripto en este turno", { alumno_id: alumnoId });
    const finalizada = await finalizarInscripcion(tx, { inscripcionId: inscripcion.id, vigencia: "QUITADA_CENTRO", actor: actorUsuario(usuarioId), fecha: momento });
    const estado = finalizada.estadoTurno?.nuevo ?? estadoAntes;
    const liberado = estadoAntes === "COMPLETO" && estado === "DISPONIBLE";
    const inscriptos = (await inscripcionesVigentes(tx, turnoId, momento)).length;
    return { liberado, cupo: turno.cupoMaximoTurno, inscriptos, estado };
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
    // Sin aula no hay cupo todavía (Revisión 3): mismo texto que profesor/aula.
    alumnos_inscriptos: turno.cupoMaximoTurno === null ? "Sin asignar" : `${alumnos.length}/${turno.cupoMaximoTurno}`,
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
    // Estado mostrado según la ocupación vigente (PR-0.md §2.2): el guardado
    // puede estar viejo por una reserva vencida sin marcar.
    estado: estadoSegunOcupacion(turno.estadoTurno, alumnos.length, turno.cupoMaximoTurno),
    prioridad: turno.prioridadTurno,
    creado_en: turno.createdAtTurno.toISOString(),
    actualizado_en: turno.updatedAtTurno.toISOString(),
    creado_por_id: turno.creadoPorUsuarioId,
    modificado_por_id: turno.modificadoPorUsuarioId,
  };
}

/**
 * Filtros opcionales del listado (spec_modulo_C.md §2.7). Cada uno se suma
 * con AND al alcance base (desde hoy + rol). `profesor_id` (HU-C-08) se
 * combina con `q` y con la paginación e incluye turnos en cualquier estado.
 */
export type FiltrosListadoTurnos = { q?: string; profesor_id?: string };

/** Opciones del selector «Profesor» del listado (HU-C-08): activos, por apellido y nombre (Módulo D). */
export async function listarOpcionesFiltroProfesor(): Promise<{ id: string; nombre: string; apellido: string }[]> {
  return (await listarOpcionesProfesoresActivos()).map(({ id, nombre, apellido }) => ({ id, nombre, apellido }));
}

const MENSAJE_SIN_PERMISO_LISTADO = "No tenés permisos para ver los turnos de ese profesor";

/**
 * Alcance por profesor del listado, siempre resuelto en el servidor
 * (spec_modulo_C.md §2.7 y R5-12): el Profesor ve solo sus turnos (la ficha
 * sale de la sesión); su propio `profesor_id` equivale a no enviarlo y uno
 * ajeno o inexistente responde `SIN_PERMISO` sin revelar si existe. Gerente y
 * Mesa de Entrada filtran por cualquier profesor activo.
 */
async function alcanceProfesorListado(usuario: { id: string; rol: RolUsuario }, profesorId: string | undefined): Promise<Prisma.TurnoWhereInput> {
  if (usuario.rol === "PROFESOR") {
    const propio = await obtenerOpcionProfesorDeUsuario(usuario.id);
    if (!propio || (profesorId !== undefined && profesorId !== propio.id)) {
      throw new ServiceError("SIN_PERMISO", MENSAJE_SIN_PERMISO_LISTADO);
    }
    return { profesorId: propio.id };
  }
  if (profesorId === undefined) return {};
  if (!(await obtenerOpcionProfesorActivo(profesorId))) throw new ServiceError("PROFESOR_NO_ENCONTRADO", "No se encontró un profesor activo");
  return { profesorId };
}

export async function listarTurnos(pagina: number, porPaginaSolicitado: number | undefined, usuario: { id: string; rol: RolUsuario }, filtros: FiltrosListadoTurnos = {}) {
  const configurado = await getParametroNumerico("paginacion_limite_default", 10);
  const porPagina = porPaginaSolicitado ?? Math.min(20, Math.max(1, Math.trunc(configurado)));
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const parte = (tipo: string) => partes.find(({ type }) => type === tipo)!.value;
  const inicioHoy = new Date(`${parte("year")}-${parte("month")}-${parte("day")}T00:00:00.000Z`);
  // Sin filtros el `where` es el de HU-C-01; la búsqueda (HU-C-02) mantiene el
  // mismo alcance de fechas y rol. count y findMany usan el mismo `where`, así
  // el total y la paginación son los del resultado filtrado.
  const alcanceProfesor = await alcanceProfesorListado(usuario, filtros.profesor_id);
  const condiciones = [construirFiltroBusquedaTurno(filtros.q)].filter((condicion) => condicion !== undefined);
  const where: Prisma.TurnoWhereInput = {
    fechaTurno: { gte: inicioHoy },
    ...alcanceProfesor,
    ...(condiciones.length ? { AND: condiciones } : {}),
  };
  const total = await prisma.turno.count({ where });
  const paginaActual = total === 0 ? 1 : Math.min(pagina, Math.ceil(total / porPagina));
  const turnos = await prisma.turno.findMany({
      where,
      include: incluirTurno(relojAhora()),
      orderBy: [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { profesorId: { sort: "asc", nulls: "last" } }, { idTurno: "asc" }],
      skip: (paginaActual - 1) * porPagina,
      take: porPagina,
    });
  return {
    items: turnos.map(presentar),
    paginacion: { total, pagina_actual: paginaActual, total_paginas: Math.ceil(total / porPagina), por_pagina: porPagina },
  };
}

export type ResultadoObtenerTurno =
  | { resultado: "ok"; turno: ReturnType<typeof presentar> & { creado_por: string | null } }
  | { resultado: "sin_permiso" }
  | { resultado: "no_encontrado" };

/**
 * Detalle base (spec_modulo_C.md §2.4, HU-C-09). Para el Profesor, la ficha
 * sale de la sesión (Módulo D) y la consulta filtra por id y profesor en el
 * mismo `where`: un turno ajeno, un id inexistente o una cuenta sin ficha dan
 * el mismo `sin_permiso`, sin revelar si el turno existe. Mesa de Entrada y
 * Gerente ven cualquier turno (`no_encontrado` si no existe). `creado_por` es
 * el email vía Módulo A, o `null`; nunca el id como respaldo.
 */
export async function obtenerTurno(id: string, usuario: { id: string; rol: RolUsuario }): Promise<ResultadoObtenerTurno> {
  let alcance: Prisma.TurnoWhereInput = {};
  if (usuario.rol === "PROFESOR") {
    const propio = await obtenerOpcionProfesorDeUsuario(usuario.id);
    if (!propio) return { resultado: "sin_permiso" };
    alcance = { profesorId: propio.id };
  }
  const turno = await prisma.turno.findFirst({ where: { idTurno: id, ...alcance }, include: incluirTurno(relojAhora()) });
  if (!turno) return { resultado: usuario.rol === "PROFESOR" ? "sin_permiso" : "no_encontrado" };
  const creadoPor = turno.creadoPorUsuarioId ? await obtenerEmailDeUsuario(turno.creadoPorUsuarioId) : null;
  return { resultado: "ok", turno: { ...presentar(turno), creado_por: creadoPor } };
}

/** HU-C-10: bloqueo y cambio condicional en una transacción; evento tras el commit. */
export async function actualizarPrioridadTurno(id: string, input: ActualizarPrioridadInput, usuarioId: string) {
  const resultado = await prisma.$transaction(async (tx) => {
    const [turno] = await tx.$queryRaw<{ idTurno: string; estadoTurno: EstadoTurno; prioridadTurno: PrioridadTurno }[]>`
      SELECT "idTurno", "estadoTurno", "prioridadTurno"
      FROM "turnos" WHERE "idTurno" = ${id} FOR UPDATE
    `;
    if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
    if (turno.estadoTurno === "CANCELADO") throw new ServiceError("TURNO_CANCELADO", "Un turno cancelado no admite cambios de prioridad");
    if (turno.prioridadTurno === input.prioridad) return { anterior: turno.prioridadTurno, sinCambios: true };

    const actualizado = await tx.turno.updateMany({
      where: { idTurno: id, estadoTurno: { not: "CANCELADO" } },
      data: { prioridadTurno: input.prioridad, modificadoPorUsuarioId: usuarioId },
    });
    if (actualizado.count === 0) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");
    return { anterior: turno.prioridadTurno, sinCambios: false };
  });

  if (resultado.sinCambios) return { id, prioridad: input.prioridad, sin_cambios: true as const };
  await emitirEventoTurno("turno:prioridad_actualizada", id, usuarioId, {
    turno_id: id, prioridad_anterior: resultado.anterior, prioridad_nueva: input.prioridad, usuario_id: usuarioId,
  });
  return { id, prioridad: input.prioridad };
}
