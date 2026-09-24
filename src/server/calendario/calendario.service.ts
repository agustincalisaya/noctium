import type { RolUsuario } from "@prisma/client";
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
  obtenerOpcionProfesorActivo,
  obtenerOpcionProfesorDeUsuario,
} from "@/server/profesores/profesor.service";
import type { CalendarioProfesor, EventoCalendario } from "@/types/calendario.types";
import type { OpcionProfesor } from "@/types/profesor.types";

/**
 * Módulo J — agenda semanal por profesor (HU-J-01, `spec_modulo_J.md` §2.1).
 * Solo lectura: no crea, modifica ni transiciona turnos.
 */

/**
 * Turnos `DISPONIBLE` o `COMPLETO` de un profesor con fecha en [desde, hasta).
 *
 * TODO(Regla N.° 3): deuda técnica explícita. `spec_modulo_J.md` §3.4 pide
 * leer los turnos vía un servicio público del módulo C
 * (`listarTurnosAgendadosPorProfesor`), pero HU-C-04 y HU-C-15 se cerraron
 * sin que el módulo C lo expusiera. Hasta entonces, esta consulta de solo
 * lectura sobre `turnos` es una excepción consciente a la Regla N.° 3
 * (HU-J-01.md §1 punto 7 y su nota de sincronización). Cuando el módulo C
 * lo exponga, reemplazar el cuerpo por esa llamada, sin cambiar la firma ni
 * la forma del dato.
 *
 * El filtro de estado va en la query (HU-J-01 c4): un turno `PENDIENTE`
 * nunca sale de acá (`spec_modulo_J.md` §3.1).
 */
export async function listarTurnosAgendadosDeProfesor(
  profesorId: string,
  desde: Date,
  hasta: Date,
): Promise<EventoCalendario[]> {
  const turnos = await prisma.turno.findMany({
    where: {
      profesorId,
      estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] },
      fechaTurno: { gte: desde, lt: hasta },
    },
    select: {
      idTurno: true,
      estadoTurno: true,
      fechaTurno: true,
      horaInicioTurno: true,
      duracionMinutosTurno: true,
      materia: { select: { nombreMateria: true } },
      aula: { select: { nombreAula: true } },
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
    const horaInicio = turno.horaInicioTurno.toISOString().slice(11, 16);
    const alumnos = turno.alumnos.map(({ alumno }) =>
      formatearApellidoNombre(alumno.apellidoAlumno, alumno.nombreAlumno),
    );
    return {
      turno_id: turno.idTurno,
      fecha: fechaISO(turno.fechaTurno),
      hora_inicio: horaInicio,
      hora_fin: minutosAHora(horaAMinutos(horaInicio) + turno.duracionMinutosTurno),
      // Turno grupal (TurnoAlumno N:M): se mantiene `alumno: string` de la
      // spec uniendo los nombres.
      alumno: alumnos.length > 0 ? alumnos.join("; ") : VALOR_AUSENTE,
      materia: turno.materia.nombreMateria,
      aula: turno.aula?.nombreAula ?? VALOR_AUSENTE,
      estado: turno.estadoTurno === "COMPLETO" ? "COMPLETO" : "DISPONIBLE",
    };
  });
}

type UsuarioSesion = { id: string; rol: RolUsuario };

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
    const propio = await obtenerOpcionProfesorDeUsuario(usuario.id);
    if (!propio) throw new ServiceError("PROFESOR_SIN_FICHA");
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
  const [profesor, parametros] = await Promise.all([
    resolverProfesorDeLaAgenda(usuario, profesorIdSolicitado, { rechazarAjeno }),
    obtenerParametrosHorarioOperativo(),
  ]);

  const dias = diasOperativosDeLaSemana(lunes, parametros.diasOperativos);
  const rango = rangoDeLaSemana(lunes, parametros.diasOperativos);
  const eventos = await listarTurnosAgendadosDeProfesor(
    profesor.id,
    fechaCalendarioADate(rango.desde),
    fechaCalendarioADate(sumarDias(rango.hasta, 1)),
  );

  return {
    profesor: { id: profesor.id, nombre_completo: profesor.nombreParaMostrar },
    rango,
    dias,
    horario: {
      apertura: parametros.apertura,
      cierre: parametros.cierre,
      granularidadMinutos: parametros.granularidadMinutos,
    },
    eventos,
  };
}
