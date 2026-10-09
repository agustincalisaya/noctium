import type { EstadoTurno, Prisma, RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { horaAMinutos, minutosAHora } from "@/lib/horario-atencion";
import {
  fechaCalendarioADate,
  fechaISO,
  periodoDeLaVista,
  type VistaCalendario,
} from "@/lib/calendario-semana";
import { formatearApellidoNombre, VALOR_AUSENTE } from "@/lib/profesor-listado";
import { ServiceError } from "@/server/shared/service-error";
import { obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import { ahora } from "@/server/shared/reloj";
import { estadoSegunOcupacion, filtroVigenteEn } from "@/server/turnos/inscripcion.publico";
import {
  obtenerMateriasDelProfesor,
  obtenerOpcionProfesorActivo,
  obtenerOpcionProfesorDeUsuario,
} from "@/server/profesores/profesor.service";
import { listarMateriasActivas, obtenerOpcionMateriaActiva } from "@/server/materias/materia.service";
import type {
  CalendarioMateria,
  CalendarioProfesor,
  EventoCalendario,
  EventoCalendarioBase,
  EventoCalendarioMateria,
  MateriaCalendario,
  ResumenDiaCalendario,
  TurnoDelCalendario,
} from "@/types/calendario.types";
import type { OpcionProfesor } from "@/types/profesor.types";
import type { PrioridadTurno } from "@/types/turno.types";

/**
 * Módulo J — calendario por profesor (HU-J-01, `spec_modulo_J.md` §2.1) y
 * por materia (HU-J-02, §2.2), en vistas día, semana y mes (HU-J-03, §2.3).
 * Solo lectura: no crea, modifica ni transiciona turnos.
 */

// ------------------------------------------------------------
// Lectura de turnos (una sola consulta para las dos pantallas y las tres vistas)
//
// TODO(Regla N.° 3): deuda técnica explícita. `spec_modulo_J.md` §1 y §3.4
// piden leer los turnos con `listarTurnosParaCalendario()` del módulo C
// (`spec_modulo_C.md` §2.15), pero el módulo C todavía no la publica en
// `src/server/turnos/turno.publico.ts`. Hasta entonces, esta consulta de
// solo lectura sobre `turnos` es una excepción consciente a la Regla N.° 3
// (HU-J-01.md §1 punto 7, HU-J-02.md §1 punto 8, HU-J-03.md §1 punto 7).
// `listarTurnosDelCalendario()` tiene la firma, el rango cerrado y la forma
// de dato de ese contrato: cuando C la publique, se reemplaza su cuerpo por
// esa llamada sin tocar nada más.
// ------------------------------------------------------------

/**
 * Estados que entran al calendario: solo turnos confirmados. Lista positiva
 * (`spec_modulo_J.md` §3.1): un turno `PENDIENTE` nunca sale de acá, aunque
 * ya tenga profesor, alumnos o aula, y un `CANCELADO` tampoco (§3.6).
 */
const ESTADOS_CALENDARIO: EstadoTurno[] = ["DISPONIBLE", "COMPLETO"];

export type FiltroTurnosCalendario = {
  /** "AAAA-MM-DD", inclusivo. */
  desde: string;
  /** "AAAA-MM-DD", inclusivo (la vista día usa desde = hasta). */
  hasta: string;
  profesorId?: string;
  materiaId?: string;
};

/**
 * Turnos `DISPONIBLE` o `COMPLETO` con fecha en el rango **cerrado**
 * `[desde, hasta]`, filtrados por profesor y/o materia (se pueden combinar:
 * el rol Profesor en la vista por materia usa los dos). El filtro de estado
 * va en la query (HU-J-01 c4). Orden: fecha, hora, profesor e id, para que
 * los superpuestos queden siempre en el mismo carril de la grilla.
 */
export async function listarTurnosDelCalendario({
  desde,
  hasta,
  profesorId,
  materiaId,
}: FiltroTurnosCalendario): Promise<TurnoDelCalendario[]> {
  const where: Prisma.TurnoWhereInput = {
    ...(profesorId ? { profesorId } : {}),
    ...(materiaId ? { materiaId } : {}),
    estadoTurno: { in: ESTADOS_CALENDARIO },
    fechaTurno: { gte: fechaCalendarioADate(desde), lte: fechaCalendarioADate(hasta) },
  };

  const turnos = await prisma.turno.findMany({
    where,
    select: {
      idTurno: true,
      estadoTurno: true,
      prioridadTurno: true,
      fechaTurno: true,
      horaInicioTurno: true,
      duracionMinutosTurno: true,
      cupoMaximoTurno: true,
      materia: { select: { idMateria: true, nombreMateria: true } },
      profesor: { select: { idProfesor: true, apellidoProfesor: true, nombreProfesor: true } },
      aula: { select: { idAula: true, nombreAula: true } },
      alumnos: {
        // Solo las inscripciones vigentes ahora (PR-0.md §2.0 y §2.2).
        where: filtroVigenteEn(ahora()),
        select: { alumno: { select: { apellidoAlumno: true, nombreAlumno: true } } },
        orderBy: [
          { alumno: { apellidoNormalizadoAlumno: "asc" } },
          { alumno: { nombreNormalizadoAlumno: "asc" } },
          { alumnoId: "asc" },
        ],
      },
    },
    orderBy: [
      { fechaTurno: "asc" },
      { horaInicioTurno: "asc" },
      { profesor: { apellidoNormalizadoProfesor: "asc" } },
      { profesor: { nombreNormalizadoProfesor: "asc" } },
      { idTurno: "asc" },
    ],
  });

  return turnos.map((turno) => {
    const horaInicio = turno.horaInicioTurno.toISOString().slice(11, 16);
    const alumnos = turno.alumnos.map(({ alumno }) =>
      formatearApellidoNombre(alumno.apellidoAlumno, alumno.nombreAlumno),
    );
    return {
      turno_id: turno.idTurno,
      fecha: fechaISO(turno.fechaTurno),
      hora_inicio: horaInicio,
      hora_fin: minutosAHora(horaAMinutos(horaInicio) + turno.duracionMinutosTurno),
      estado: estadoSegunOcupacion(turno.estadoTurno, alumnos.length, turno.cupoMaximoTurno) === "COMPLETO" ? "COMPLETO" : "DISPONIBLE",
      prioridad: turno.prioridadTurno,
      materia: { id: turno.materia.idMateria, nombre: turno.materia.nombreMateria },
      profesor: turno.profesor
        ? {
            id: turno.profesor.idProfesor,
            nombre_para_mostrar: formatearApellidoNombre(turno.profesor.apellidoProfesor, turno.profesor.nombreProfesor),
          }
        : null,
      aula: turno.aula ? { id: turno.aula.idAula, nombre: turno.aula.nombreAula } : null,
      alumnos,
      inscriptos: alumnos.length,
      cupo: turno.cupoMaximoTurno,
      alumnos_inscriptos: `${alumnos.length}/${turno.cupoMaximoTurno ?? VALOR_AUSENTE}`,
    };
  });
}

function eventoBase(turno: TurnoDelCalendario): EventoCalendarioBase {
  return {
    turno_id: turno.turno_id,
    fecha: turno.fecha,
    hora_inicio: turno.hora_inicio,
    hora_fin: turno.hora_fin,
    aula: turno.aula?.nombre ?? VALOR_AUSENTE,
    estado: turno.estado,
    prioridad: turno.prioridad,
  };
}

/**
 * Evento de la agenda por profesor (HU-J-01): `alumno` une los nombres con
 * "; " (turno grupal) o es "—" si no tiene alumnos (`spec_modulo_J.md` §2).
 */
export function eventoDeProfesor(turno: TurnoDelCalendario): EventoCalendario {
  const { aula, estado, ...base } = eventoBase(turno);
  return {
    ...base,
    alumno: turno.alumnos.length > 0 ? turno.alumnos.join("; ") : VALOR_AUSENTE,
    materia: turno.materia.nombre,
    aula,
    estado,
  };
}

/**
 * Evento del calendario por materia (HU-J-02): profesor y ocupación
 * inscriptos/cupo, sin nombres de alumnos.
 */
export function eventoDeMateria(turno: TurnoDelCalendario): EventoCalendarioMateria {
  // Solo llegan turnos DISPONIBLE/COMPLETO (§3.2), y confirmar exige aula, que
  // fija el cupo (spec_modulo_C.md Revisión 3, §2.2). Un null acá es una regresión.
  if (turno.cupo === null) {
    throw new Error(`Turno ${turno.turno_id} en ${turno.estado} sin cupo: viola spec_modulo_C.md §2.2`);
  }
  const { aula, estado, ...base } = eventoBase(turno);
  return {
    ...base,
    profesor: turno.profesor?.nombre_para_mostrar ?? VALOR_AUSENTE,
    alumnos_inscriptos: turno.alumnos_inscriptos,
    inscriptos: turno.inscriptos,
    cupo: turno.cupo,
    aula,
    estado,
  };
}

// ------------------------------------------------------------
// Vista mes: resumen por día (HU-J-03 c2, `spec_modulo_J.md` §2.3 punto 4)
// ------------------------------------------------------------

const ORDEN_PRIORIDAD: Record<PrioridadTurno, number> = { NORMAL: 0, ALTA: 1, URGENTE: 2 };

/**
 * Agrega en memoria los turnos de la grilla del mes (§3.5: misma consulta
 * que las otras vistas, sin reglas propias). Un ítem por fecha de la grilla,
 * relleno incluido (`en_mes: false`).
 * - `estado_predominante`: el estado con más turnos; empate -> `COMPLETO`;
 *   `null` sin turnos (Revisión 2.1).
 * - `prioridad_maxima`: `URGENTE` > `ALTA` > `NORMAL`; `null` sin turnos.
 */
export function resumirDiasDelMes(
  turnos: readonly { fecha: string; estado: "DISPONIBLE" | "COMPLETO"; prioridad: PrioridadTurno }[],
  semanas: readonly (readonly string[])[],
  mes: string,
): ResumenDiaCalendario[] {
  const anioMes = mes.slice(0, 7);
  return semanas.flat().map((fecha) => {
    const delDia = turnos.filter((turno) => turno.fecha === fecha);
    const por_estado = {
      DISPONIBLE: delDia.filter(({ estado }) => estado === "DISPONIBLE").length,
      COMPLETO: delDia.filter(({ estado }) => estado === "COMPLETO").length,
    };
    const prioridad_maxima = delDia.reduce<PrioridadTurno | null>(
      (maxima, { prioridad }) =>
        maxima === null || ORDEN_PRIORIDAD[prioridad] > ORDEN_PRIORIDAD[maxima] ? prioridad : maxima,
      null,
    );
    return {
      fecha,
      en_mes: fecha.slice(0, 7) === anioMes,
      cantidad: delDia.length,
      por_estado,
      estado_predominante:
        delDia.length === 0 ? null : por_estado.COMPLETO >= por_estado.DISPONIBLE ? "COMPLETO" : "DISPONIBLE",
      prioridad_maxima,
    };
  });
}

// ------------------------------------------------------------
// Período consultado (compartido por las dos pantallas)
// ------------------------------------------------------------

type UsuarioSesion = { id: string; rol: RolUsuario };

/**
 * Período de la vista con los parámetros del centro: días operativos (para
 * la semana) y horario de la grilla (día y semana).
 */
async function periodoDelCalendario(vista: VistaCalendario, fecha: string) {
  const parametros = await obtenerParametrosHorarioOperativo();
  return {
    periodo: periodoDeLaVista(vista, fecha, parametros.diasOperativos),
    horario: {
      apertura: parametros.apertura,
      cierre: parametros.cierre,
      granularidadMinutos: parametros.granularidadMinutos,
    },
  };
}

/**
 * Arma el calendario de la vista a partir de los turnos del rango consultado:
 * eventos en día y semana, resumen por día en el mes.
 */
async function calendarioDeLaVista<E>(
  { periodo, horario }: Awaited<ReturnType<typeof periodoDelCalendario>>,
  filtro: { profesorId?: string; materiaId?: string },
  aEvento: (turno: TurnoDelCalendario) => E,
) {
  const turnos = await listarTurnosDelCalendario({ ...periodo.consulta, ...filtro });
  if (periodo.vista === "mes") {
    return {
      vista: periodo.vista,
      rango: periodo.rango,
      dias: resumirDiasDelMes(turnos, periodo.semanas, periodo.rango.desde),
    };
  }
  return {
    vista: periodo.vista,
    rango: periodo.rango,
    dias: periodo.dias,
    horario,
    eventos: turnos.map(aEvento),
  };
}

/** Ficha de profesor de la cuenta de la sesión; `PROFESOR_SIN_FICHA` si no tiene. */
async function profesorDeLaSesion(usuario: UsuarioSesion): Promise<OpcionProfesor> {
  const propio = await obtenerOpcionProfesorDeUsuario(usuario.id);
  if (!propio) throw new ServiceError("PROFESOR_SIN_FICHA");
  return propio;
}

// ------------------------------------------------------------
// Agenda por profesor (HU-J-01)
// ------------------------------------------------------------

/**
 * Único punto donde se decide de quién es la agenda consultada
 * (`spec_modulo_J.md` §3.2, HU-J-01 c2):
 * - `PROFESOR`: siempre la propia, resuelta desde la cuenta de la sesión
 *   (`Profesor.usuarioId`). El `profesorId` recibido se ignora; con
 *   `rechazarAjeno` (Route Handler) uno distinto del propio es
 *   `SIN_PERMISO`, sin revelar si ese profesor existe.
 * - `MESA_ENTRADA` / `GERENTE`: el `profesorId` recibido, que debe ser de
 *   un profesor activo (`PROFESOR_NO_ENCONTRADO` si no).
 * - Cualquier otro rol: `SIN_PERMISO` (defensa en profundidad; ya lo frena
 *   `calendario:leer`).
 */
export async function resolverProfesorDeLaAgenda(
  usuario: UsuarioSesion,
  profesorIdSolicitado: string | undefined,
  { rechazarAjeno }: { rechazarAjeno: boolean },
): Promise<OpcionProfesor> {
  if (usuario.rol === "PROFESOR") {
    const propio = await profesorDeLaSesion(usuario);
    if (rechazarAjeno && profesorIdSolicitado && profesorIdSolicitado !== propio.id) {
      throw new ServiceError("SIN_PERMISO");
    }
    return propio;
  }

  if (usuario.rol === "MESA_ENTRADA" || usuario.rol === "GERENTE") {
    const profesor = profesorIdSolicitado ? await obtenerOpcionProfesorActivo(profesorIdSolicitado) : null;
    if (!profesor) throw new ServiceError("PROFESOR_NO_ENCONTRADO");
    return profesor;
  }

  throw new ServiceError("SIN_PERMISO");
}

/**
 * Agenda de un profesor en la vista pedida (HU-J-01, HU-J-03). `fecha` es
 * la fecha de referencia: el día, cualquier día de la semana o del mes.
 */
export async function obtenerCalendarioProfesor({
  usuario,
  profesorIdSolicitado,
  vista,
  fecha,
  rechazarAjeno,
}: {
  usuario: UsuarioSesion;
  profesorIdSolicitado: string | undefined;
  vista: VistaCalendario;
  fecha: string;
  rechazarAjeno: boolean;
}): Promise<CalendarioProfesor> {
  const [profesor, periodo] = await Promise.all([
    resolverProfesorDeLaAgenda(usuario, profesorIdSolicitado, { rechazarAjeno }),
    periodoDelCalendario(vista, fecha),
  ]);

  const calendario = await calendarioDeLaVista(periodo, { profesorId: profesor.id }, eventoDeProfesor);

  return { profesor: { id: profesor.id, nombre_completo: profesor.nombreParaMostrar }, ...calendario };
}

// ------------------------------------------------------------
// Calendario por materia (HU-J-02)
// ------------------------------------------------------------

/**
 * Materias que puede elegir quien consulta (HU-J-02 c1, HU-J-02.md §1
 * punto 9): Mesa de Entrada y Gerente, todas las activas (módulo L); un
 * Profesor, solo las activas que tiene asociadas (HU-D-03, módulo D).
 */
export async function listarMateriasDelCalendario(usuario: UsuarioSesion): Promise<MateriaCalendario[]> {
  if (usuario.rol === "PROFESOR") {
    const propio = await profesorDeLaSesion(usuario);
    const materias = await obtenerMateriasDelProfesor(propio.id);
    return materias
      .filter((materia) => materia.activa)
      .map(({ id, nombre, codigo }) => ({ id, nombre, codigo }));
  }

  if (usuario.rol === "MESA_ENTRADA" || usuario.rol === "GERENTE") {
    const materias = await listarMateriasActivas();
    return materias.map((materia) => ({
      id: materia.idMateria,
      nombre: materia.nombreMateria,
      codigo: materia.codigoMateria,
    }));
  }

  throw new ServiceError("SIN_PERMISO");
}

/**
 * Único punto que decide el alcance del calendario por materia
 * (`spec_modulo_J.md` §3.2, HU-J-02 c1). Devuelve el `profesorId` con el
 * que hay que filtrar los turnos, o `undefined` para no filtrar:
 * - `PROFESOR`: siempre su propia ficha, resuelta desde la sesión (nunca
 *   desde la URL). Si no dicta la materia pedida: `SIN_PERMISO`, sin
 *   revelar si la materia existe.
 * - `MESA_ENTRADA` / `GERENTE`: `undefined` (todos los turnos).
 * - Cualquier otro rol: `SIN_PERMISO`.
 */
export async function resolverFiltroProfesorDeMateria(
  usuario: UsuarioSesion,
  materiaId: string,
): Promise<string | undefined> {
  if (usuario.rol === "PROFESOR") {
    const propio = await profesorDeLaSesion(usuario);
    const materias = await obtenerMateriasDelProfesor(propio.id);
    if (!materias.some((materia) => materia.id === materiaId)) throw new ServiceError("SIN_PERMISO");
    return propio.id;
  }

  if (usuario.rol === "MESA_ENTRADA" || usuario.rol === "GERENTE") return undefined;

  throw new ServiceError("SIN_PERMISO");
}

/**
 * Calendario de una materia en la vista pedida (HU-J-02, HU-J-03). Primero
 * se resuelve el alcance del rol: un Profesor sin ficha o que no dicta la
 * materia se rechaza antes de mirar la materia o los turnos. Después, la
 * materia debe estar activa (`MATERIA_NO_ENCONTRADA` si no).
 */
export async function obtenerCalendarioMateria({
  usuario,
  materiaId,
  vista,
  fecha,
}: {
  usuario: UsuarioSesion;
  materiaId: string;
  vista: VistaCalendario;
  fecha: string;
}): Promise<CalendarioMateria> {
  const profesorId = await resolverFiltroProfesorDeMateria(usuario, materiaId);

  const [materia, periodo] = await Promise.all([
    obtenerOpcionMateriaActiva(materiaId),
    periodoDelCalendario(vista, fecha),
  ]);
  if (!materia) throw new ServiceError("MATERIA_NO_ENCONTRADA");

  const calendario = await calendarioDeLaVista(
    periodo,
    profesorId ? { materiaId: materia.id, profesorId } : { materiaId: materia.id },
    eventoDeMateria,
  );

  return { materia, ...calendario };
}
