import type { ContextoFixtures } from "./index";
import { configurarTurno, asignarParticipantesTurno } from "../../../src/server/turnos/turno.service";
import { asignarAulaTurno } from "../../../src/server/turnos/turno.aula.service";
import { cancelarTurno } from "../../../src/server/turnos/turno.cancelacion.service";
import { crearInscripcion, finalizarInscripcion, marcarVencidas } from "../../../src/server/turnos/inscripcion.publico";
import { registrarClaseDictada } from "../../../src/server/historial/clase-dictada.service";
import { actorUsuario } from "../../../src/server/shared/historial";
import { conReloj } from "../../../src/server/shared/reloj";
import { transaccion } from "../../../src/server/shared/transaccion";

/** Estados de C14/C24/B07 mediante fachadas PR0; no implementa esas historias. */
export async function fixtureHuE02({ prisma: db }: ContextoFixtures) {
  const [mesa, profesor, materia, aula, alumno] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    db.profesor.findFirstOrThrow({ where: { emailProfesor: "profesor1@noctium.local" } }),
    db.materia.findUniqueOrThrow({ where: { nombreMateria: "Matemática" } }),
    db.aula.findFirstOrThrow({ where: { activaAula: true }, orderBy: { capacidadAula: "desc" } }),
    db.alumno.findFirstOrThrow({ where: { usuario: { emailUsuario: "alumno01@noctium.local" } } }),
  ]);
  const actor = actorUsuario(mesa.idUsuario);
  const escenarios = [
    { fecha: "2026-09-21", tipo: "PRESENTE" }, { fecha: "2026-09-22", tipo: "AUSENTE" }, { fecha: "2026-09-23", tipo: "LEGACY" }, { fecha: "2026-09-24", tipo: "SIN_REGISTRO" },
    { fecha: "2026-10-12", tipo: "PROXIMA" }, { fecha: "2026-10-13", tipo: "CANCELADA_CENTRO" }, { fecha: "2026-10-14", tipo: "CANCELADA_ALUMNO" }, { fecha: "2026-10-15", tipo: "BAJA_ALUMNO" }, { fecha: "2026-10-16", tipo: "QUITADA_CENTRO" }, { fecha: "2026-10-19", tipo: "RESERVA_VENCIDA" }, { fecha: "2026-10-20", tipo: "BAJA_TRAS_CANCELAR" }, { fecha: "2026-10-21", tipo: "REINSCRIPCION" },
  ] as const;
  for (const e of escenarios) {
    let turno = await db.turno.findFirst({ where: { fechaTurno: new Date(`${e.fecha}T00:00:00Z`), horaInicioTurno: new Date("1970-01-01T08:00:00Z"), profesorId: profesor.idProfesor, materiaId: materia.idMateria } });
    if (!turno) {
      const id = await conReloj(new Date("2026-09-01T12:00:00Z"), async () => {
        const creado = await configurarTurno({ fecha: new Date(`${e.fecha}T00:00:00Z`), hora_inicio: "08:00", materia_id: materia.idMateria, profesor_id: profesor.idProfesor, duracion_min: 60 }, mesa.idUsuario);
        await asignarAulaTurno(creado.id, { aula_id: aula.idAula }, mesa.idUsuario);
        await asignarParticipantesTurno(creado.id, { profesor_id: profesor.idProfesor, alumno_ids: [alumno.idAlumno] }, mesa.idUsuario);
        return creado.id;
      });
      turno = await db.turno.findUniqueOrThrow({ where: { idTurno: id } });
    }
    const turnoId = turno.idTurno;
    const inscripciones = await db.turnoAlumno.findMany({ where: { turnoId: turnoId, alumnoId: alumno.idAlumno }, orderBy: { createdAtInscripcion: "asc" } });
    const original = inscripciones[0]; if (!original) throw new Error("Fixture E02 sin inscripción inicial");
    if (["PRESENTE", "AUSENTE", "LEGACY"].includes(e.tipo) && !(await db.claseDictada.findFirst({ where: { turnoId: turnoId } }))) {
      const estado = e.tipo === "AUSENTE" ? "AUSENTE" : "PRESENTE";
      await conReloj(new Date(`${e.fecha}T15:00:00Z`), () => transaccion(tx => registrarClaseDictada(tx, { turnoId: turnoId, actor, asistencias: e.tipo === "LEGACY" ? undefined : [{ inscripcionId: original.idInscripcion, estado }] })));
    }
    if (["CANCELADA_ALUMNO", "BAJA_ALUMNO", "QUITADA_CENTRO"].includes(e.tipo) && original.vigencia === "VIGENTE") {
      const vigencia = e.tipo === "CANCELADA_ALUMNO" ? "CANCELADA_ALUMNO" : e.tipo === "BAJA_ALUMNO" ? "BAJA_ALUMNO" : "QUITADA_CENTRO";
      await conReloj(new Date("2026-10-07T12:00:00Z"), () => transaccion(tx => finalizarInscripcion(tx, { inscripcionId: original.idInscripcion, vigencia, actor })));
    }
    if (["CANCELADA_CENTRO", "BAJA_TRAS_CANCELAR"].includes(e.tipo)) {
      if (turno.estadoTurno !== "CANCELADO") await conReloj(new Date("2026-10-07T13:00:00Z"), () => cancelarTurno(turnoId, mesa.idUsuario));
      if (e.tipo === "BAJA_TRAS_CANCELAR" && original.vigencia === "VIGENTE") await conReloj(new Date("2026-10-07T14:00:00Z"), () => transaccion(tx => finalizarInscripcion(tx, { inscripcionId: original.idInscripcion, vigencia: "BAJA_ALUMNO", actor })));
    }
    if (e.tipo === "REINSCRIPCION" && inscripciones.length === 1) {
      await conReloj(new Date("2026-10-06T12:00:00Z"), () => transaccion(tx => finalizarInscripcion(tx, { inscripcionId: original.idInscripcion, vigencia: "CANCELADA_ALUMNO", actor })));
      await conReloj(new Date("2026-10-07T12:00:00Z"), () => transaccion(tx => crearInscripcion(tx, { turnoId: turnoId, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor })));
    }
    if (e.tipo === "RESERVA_VENCIDA") {
      if (inscripciones.length === 1) {
        await conReloj(new Date("2026-09-02T12:00:00Z"), () => transaccion(tx => finalizarInscripcion(tx, { inscripcionId: original.idInscripcion, vigencia: "QUITADA_CENTRO", actor })));
        await conReloj(new Date("2026-09-03T12:00:00Z"), () => transaccion(tx => crearInscripcion(tx, { turnoId: turnoId, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: true, actor })));
      }
      await conReloj(new Date("2026-09-07T12:00:00Z"), () => transaccion(tx => marcarVencidas(tx, turnoId, { momento: new Date("2026-09-07T12:00:00Z") })));
    }
  }
}
