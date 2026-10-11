import type { EstadoAsistencia } from "@prisma/client";
import type { ContextoFixtures } from "./index";
import { configurarTurno, asignarParticipantesTurno } from "../../../src/server/turnos/turno.service";
import { asignarAulaTurno } from "../../../src/server/turnos/turno.aula.service";
import { crearInscripcion, finalizarInscripcion, inscripcionesVigentes, clasesConReservasVencidasDelAlumno } from "../../../src/server/turnos/inscripcion.publico";
import { registrarClaseDictada } from "../../../src/server/historial/clase-dictada.service";
import { actorUsuario } from "../../../src/server/shared/historial";
import { conReloj } from "../../../src/server/shared/reloj";
import { instanteCentro } from "../../../src/server/shared/fechas-centro";
import { bloquear } from "../../../src/server/shared/bloquear";
import { transaccion } from "../../../src/server/shared/transaccion";

/** Datos históricos sin cobro: reemplaza reservas antes de que empiece la clase,
 * mediante el dominio, por inscripciones sin vencimiento. No altera pagos ni clases dictadas. */
export async function prepararInscripcionesHistoricas(contexto: ContextoFixtures, turnoId: string, usuarioId: string, momento: Date) {
  const actor = actorUsuario(usuarioId);
  for (const inscripcion of await inscripcionesVigentes(contexto.prisma, turnoId, momento)) {
    const fila = await contexto.prisma.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: inscripcion.id }, select: { estadoPago: true } });
    if (fila.estadoPago !== "RESERVADA") continue;
    await conReloj(momento, () => transaccion(async (tx) => {
      const vencidas = await clasesConReservasVencidasDelAlumno(tx, inscripcion.alumnoId, momento);
      await bloquear(tx, { recursos: { alumnos: [inscripcion.alumnoId] }, clases: [turnoId, ...vencidas] });
      await finalizarInscripcion(tx, { inscripcionId: inscripcion.id, vigencia: "QUITADA_CENTRO", actor, fecha: momento });
      await crearInscripcion(tx, { turnoId, alumnoId: inscripcion.alumnoId, origen: "CENTRO", conReserva: false, actor, momento, bloqueosTomados: true });
    }, { db: contexto.prisma }));
  }
}

export type DatosClaseAsistenciaFixture = {
  fecha: string; hora: string; materiaId: string; profesorId: string; aulaId: string;
  usuarioId: string; alumnoIds: string[]; estados?: EstadoAsistencia[]; registrar?: boolean;
};

/** Todo el flujo usa servicios y reloj. La clave natural conserva ids al repetir el seed. */
export async function sembrarClaseAsistencia(contexto: ContextoFixtures, datos: DatosClaseAsistenciaFixture) {
  const fecha = new Date(`${datos.fecha}T00:00:00Z`);
  const hora = new Date(`1970-01-01T${datos.hora}:00Z`);
  const inicio = instanteCentro(datos.fecha, datos.hora);
  const antes = new Date(inicio.getTime() - 60 * 60_000);
  const despues = new Date(inicio.getTime() + 61 * 60_000);
  let turno = await contexto.prisma.turno.findFirst({
    where: { fechaTurno: fecha, horaInicioTurno: hora, profesorId: datos.profesorId, materiaId: datos.materiaId },
    select: { idTurno: true, estadoTurno: true, aulaId: true },
  });
  if (!turno) {
    const creado = await conReloj(antes, () => configurarTurno({ fecha, hora_inicio: datos.hora, materia_id: datos.materiaId, profesor_id: datos.profesorId, duracion_min: 60 }, datos.usuarioId));
    turno = { idTurno: creado.id, estadoTurno: "PENDIENTE", aulaId: null };
  }
  const turnoId = turno.idTurno;
  if (turno.estadoTurno === "PENDIENTE") {
    await conReloj(antes, async () => {
      if (!turno.aulaId) await asignarAulaTurno(turnoId, { aula_id: datos.aulaId }, datos.usuarioId);
      await asignarParticipantesTurno(turnoId, { alumno_ids: datos.alumnoIds, profesor_id: datos.profesorId }, datos.usuarioId);
    });
  }
  if (!(await contexto.prisma.claseDictada.findFirst({ where: { turnoId, anuladaEl: null } }))) {
    await prepararInscripcionesHistoricas(contexto, turnoId, datos.usuarioId, antes);
  }
  const inscripciones = await inscripcionesVigentes(contexto.prisma, turnoId, despues);
  if (datos.registrar !== false) {
    if (datos.estados && datos.estados.length !== datos.alumnoIds.length) throw new Error("La fixture debe indicar un estado por alumno");
    const estadosPorAlumno = new Map(datos.alumnoIds.map((id, indice) => [id, datos.estados?.[indice]]));
    await conReloj(despues, () => transaccion((tx) => registrarClaseDictada(tx, {
      turnoId, actor: actorUsuario(datos.usuarioId),
      asistencias: datos.estados ? inscripciones.map(({ id, alumnoId }) => ({ inscripcionId: id, estado: estadosPorAlumno.get(alumnoId)! })) : undefined,
    }), { db: contexto.prisma }));
  }
  return { turnoId, inscripciones };
}

/** Tres clases: lista pendiente de registro, control individual y registro antiguo sin control. */
export async function fixtureHuE09(contexto: ContextoFixtures) {
  const db = contexto.prisma;
  const [usuario, profesor, materia, aula, alumnos] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    db.profesor.findFirstOrThrow({ where: { emailProfesor: "profesor1@noctium.local" } }),
    db.materia.findFirstOrThrow({ where: { nombreMateria: "Matemática" } }),
    db.aula.findFirstOrThrow({ where: { activaAula: true, capacidadAula: { gte: 3 } }, orderBy: { capacidadAula: "desc" } }),
    db.alumno.findMany({ where: { activoAlumno: true }, orderBy: { dniAlumno: "asc" }, take: 3 }),
  ]);
  if (alumnos.length !== 3) throw new Error("HU-E-09 requiere tres alumnos activos del seed base");
  const base = { usuarioId: usuario.idUsuario, profesorId: profesor.idProfesor, materiaId: materia.idMateria, aulaId: aula.idAula, alumnoIds: alumnos.map(({ idAlumno }) => idAlumno), hora: "11:00" };
  await sembrarClaseAsistencia(contexto, { ...base, fecha: "2026-01-05", registrar: false });
  await sembrarClaseAsistencia(contexto, { ...base, fecha: "2026-01-06", estados: ["PRESENTE", "AUSENTE", "PRESENTE"] });
  await sembrarClaseAsistencia(contexto, { ...base, fecha: "2026-01-07" });
}
