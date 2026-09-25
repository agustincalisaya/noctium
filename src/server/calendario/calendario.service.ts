import type { EstadoTurno, Prisma, RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { horaAMinutos, minutosAHora } from "@/lib/horario-atencion";
import {
  diasOperativosDeLaSemana,
  fechaCalendarioADate,
  fechaISO,
  rangoDeLaSemana,
  sumarDias,
} from "@/lib/calendario-semana";
import { formatearApellidoNombre, VALOR_AUSENTE } from "@/lib/profesor-listado";
import { ServiceError } from "@/server/shared/service-error";
import { obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
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
} from "@/types/calendario.types";
import type { OpcionProfesor } from "@/types/profesor.types";

/**
 * Módulo J — vistas semanales del calendario: por profesor (HU-J-01,
 * `spec_modulo_J.md` §2.1) y por materia (HU-J-02, §2.2).
 * Solo lectura: no crea, modifica ni transiciona turnos.
 */

// ------------------------------------------------------------
// Lectura de turnos (compartida por las dos vistas)
//
// TODO(Regla N.° 3): deuda técnica explícita. `spec_modulo_J.md` §3.4 pide
// leer los turnos vía servicios públicos del módulo C
// (`listarTurnosAgendadosPorProfesor` / `listarTurnosAgendadosPorMateria`),
// pero el módulo C todavía no los expone. Hasta entonces, estas consultas de
// solo lectura sobre `turnos` son una excepción consciente a la Regla N.° 3
// (HU-J-01.md §1 punto 7, HU-J-02.md §1 punto 8). Cuando el módulo C los
// exponga, reemplazar los cuerpos de `listarTurnosAgendadosDeProfesor()` y
// `listarTurnosAgendadosDeMateria()` por esas llamadas, sin cambiar las
// firmas ni la forma del dato.
// ------------------------------------------------------------

/**
 * Estados que entran al calendario: solo turnos confirmados. Lista positiva
 * (`spec_modulo_J.md` §3.1): un turno `PENDIENTE` nunca sale de acá, aunque
 * ya tenga profesor, alumnos o aula; si el módulo C agrega estados, no
 * aparecen hasta que se decida explícitamente.
 */
const ESTADOS_CALENDARIO: EstadoTurno[] = ["DISPONIBLE", "COMPLETO"];

type FiltroTurnosCalendario = { profesorId: string } | { materiaId: string; profesorId?: string };

/** `where` común: filtro de la vista + estados confirmados + fecha en [desde, hasta). */
function whereTurnosCalendario(filtro: FiltroTurnosCalendario, desde: Date, hasta: Date): Prisma.TurnoWhereInput {
  return {
    ...filtro,
    estadoTurno: { in: ESTADOS_CALENDARIO },
    fechaTurno: { gte: desde, lt: hasta },
  };
}

const SELECT_EVENTO_BASE = {
  idTurno: true,
  estadoTurno: true,
  fechaTurno: true,
  horaInicioTurno: true,
  duracionMinutosTurno: true,
  aula: { select: { nombreAula: true } },
} satisfies Prisma.TurnoSelect;

type FilaEventoBase = Prisma.TurnoGetPayload<{ select: typeof SELECT_EVENTO_BASE }>;

function eventoBase(turno: FilaEventoBase): EventoCalendarioBase {
  const horaInicio = turno.horaInicioTurno.toISOString().slice(11, 16);
  return {
    turno_id: turno.idTurno,
    fecha: fechaISO(turno.fechaTurno),
    hora_inicio: horaInicio,
    hora_fin: minutosAHora(horaAMinutos(horaInicio) + turno.duracionMinutosTurno),
    aula: turno.aula?.nombreAula ?? VALOR_AUSENTE,
    estado: turno.estadoTurno === "COMPLETO" ? "COMPLETO" : "DISPONIBLE",
  };
}

/**
 * Turnos `DISPONIBLE` o `COMPLETO` de un profesor con fecha en [desde, hasta)
 * (HU-J-01). El filtro de estado va en la query (HU-J-01 c4).
 */
export async function listarTurnosAgendadosDeProfesor(
  profesorId: string,
  desde: Date,
  hasta: Date,
): Promise<EventoCalendario[]> {
  const turnos = await prisma.turno.findMany({
    where: whereTurnosCalendario({ profesorId }, desde, hasta),
    select: {
      ...SELECT_EVENTO_BASE,
      materia: { select: { nombreMateria: true } },
      alumnos: {
        select: { alumno: { select: { apellidoAlumno: true, nombreAlumno: true } } },
        orderBy: [
          { alumno: { apellidoNormalizadoAlumno: "asc" } },
          { alumno: { nombreNormalizadoAlumno: "asc" } },
          { alumnoId: "asc" },
        ],
      },
    },
    orderBy: [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { idTurno: "asc" }],
  });

  return turnos.map((turno) => {
    const alumnos = turno.alumnos.map(({ alumno }) =>
      formatearApellidoNombre(alumno.apellidoAlumno, alumno.nombreAlumno),
    );
    const { aula, estado, ...base } = eventoBase(turno);
    return {
      ...base,
      // Turno grupal (TurnoAlumno N:M): se mantiene `alumno: string` de la
      // spec uniendo los nombres.
      alumno: alumnos.length > 0 ? alumnos.join("; ") : VALOR_AUSENTE,
      materia: turno.materia.nombreMateria,
      aula,
      estado,
    };
  });
}

/**
 * Turnos `DISPONIBLE` o `COMPLETO` de una materia con fecha en [desde, hasta)
 * (HU-J-02). Con `profesorId`, solo los de ese profesor: el servicio lo pone
 * siempre cuando consulta un Profesor (`spec_modulo_J.md` §3.2).
 *
 * En lugar de nombres de alumnos devuelve la ocupación (HU-J-02 c2):
 * cantidad de `TurnoAlumno` sobre `cupoMaximoTurno`. Los turnos que
 * coinciden en horario se devuelven todos (§3.3), ordenados por profesor
 * para que los carriles de la grilla sean estables.
 */
export async function listarTurnosAgendadosDeMateria(
  materiaId: string,
  desde: Date,
  hasta: Date,
  profesorId?: string,
): Promise<EventoCalendarioMateria[]> {
  const turnos = await prisma.turno.findMany({
    where: whereTurnosCalendario(profesorId ? { materiaId, profesorId } : { materiaId }, desde, hasta),
    select: {
      ...SELECT_EVENTO_BASE,
      cupoMaximoTurno: true,
      profesor: { select: { apellidoProfesor: true, nombreProfesor: true } },
      _count: { select: { alumnos: true } },
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
    const inscriptos = turno._count.alumnos;
    const cupo = turno.cupoMaximoTurno;
    // Solo llegan turnos DISPONIBLE/COMPLETO (§3.2), y confirmar exige aula, que
    // fija el cupo (spec_modulo_C.md Revisión 3, §2.2). Un null acá es una regresión.
    if (cupo === null) {
      throw new Error(`Turno ${turno.idTurno} en ${turno.estadoTurno} sin cupo: viola spec_modulo_C.md §2.2`);
    }
    const { aula, estado, ...base } = eventoBase(turno);
    return {
      ...base,
      profesor: turno.profesor
        ? formatearApellidoNombre(turno.profesor.apellidoProfesor, turno.profesor.nombreProfesor)
        : VALOR_AUSENTE,
      alumnos_inscriptos: `${inscriptos}/${cupo}`,
      inscriptos,
      cupo,
      aula,
      estado,
    };
  });
}

// ------------------------------------------------------------
// Semana consultada (compartida por las dos vistas)
// ------------------------------------------------------------

type UsuarioSesion = { id: string; rol: RolUsuario };

/**
 * Días, rango y horario de la semana que empieza en `lunes`, y el intervalo
 * [desde, hasta) de fechas a consultar (hasta = día siguiente al último día
 * operativo).
 */
async function semanaDelCalendario(lunes: string) {
  const parametros = await obtenerParametrosHorarioOperativo();
  const rango = rangoDeLaSemana(lunes, parametros.diasOperativos);
  return {
    dias: diasOperativosDeLaSemana(lunes, parametros.diasOperativos),
    rango,
    horario: {
      apertura: parametros.apertura,
      cierre: parametros.cierre,
      granularidadMinutos: parametros.granularidadMinutos,
    },
    desde: fechaCalendarioADate(rango.desde),
    hasta: fechaCalendarioADate(sumarDias(rango.hasta, 1)),
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
 * Agenda semanal de un profesor (HU-J-01). `lunes` es el lunes de la semana
 * consultada; solo se muestran y consultan los días operativos vigentes.
 */
export async function obtenerCalendarioProfesor({
  usuario,
  profesorIdSolicitado,
  lunes,
  rechazarAjeno,
}: {
  usuario: UsuarioSesion;
  profesorIdSolicitado: string | undefined;
  lunes: string;
  rechazarAjeno: boolean;
}): Promise<CalendarioProfesor> {
  const [profesor, semana] = await Promise.all([
    resolverProfesorDeLaAgenda(usuario, profesorIdSolicitado, { rechazarAjeno }),
    semanaDelCalendario(lunes),
  ]);

  const eventos = await listarTurnosAgendadosDeProfesor(profesor.id, semana.desde, semana.hasta);

  return {
    profesor: { id: profesor.id, nombre_completo: profesor.nombreParaMostrar },
    rango: semana.rango,
    dias: semana.dias,
    horario: semana.horario,
    eventos,
  };
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
 * Calendario semanal de una materia (HU-J-02). Primero se resuelve el
 * alcance del rol: un Profesor sin ficha o que no dicta la materia se
 * rechaza antes de mirar la materia o los turnos. Después, la materia debe
 * estar activa (`MATERIA_NO_ENCONTRADA` si no).
 */
export async function obtenerCalendarioMateria({
  usuario,
  materiaId,
  lunes,
}: {
  usuario: UsuarioSesion;
  materiaId: string;
  lunes: string;
}): Promise<CalendarioMateria> {
  const profesorId = await resolverFiltroProfesorDeMateria(usuario, materiaId);

  const [materia, semana] = await Promise.all([obtenerOpcionMateriaActiva(materiaId), semanaDelCalendario(lunes)]);
  if (!materia) throw new ServiceError("MATERIA_NO_ENCONTRADA");

  const eventos = await listarTurnosAgendadosDeMateria(materia.id, semana.desde, semana.hasta, profesorId);

  return {
    materia,
    rango: semana.rango,
    dias: semana.dias,
    horario: semana.horario,
    eventos,
  };
}
