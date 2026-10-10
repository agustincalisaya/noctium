import type { ContextoFixtures } from "./index";
import { configurarTurno, asignarParticipantesTurno } from "../../../src/server/turnos/turno.service";
import { asignarAulaTurno } from "../../../src/server/turnos/turno.aula.service";
import { cancelarTurno } from "../../../src/server/turnos/turno.cancelacion.service";
import { crearInscripcion, finalizarInscripcion, marcarVencidas } from "../../../src/server/turnos/inscripcion.publico";
import { transaccion } from "../../../src/server/shared/transaccion";
import { actorUsuario } from "../../../src/server/shared/historial";
import { conReloj, ahora } from "../../../src/server/shared/reloj";
import { fechaCentro, instanteCentro } from "../../../src/server/shared/fechas-centro";

/** Transiciones del PR0 por servicios públicos; no reemplaza las pantallas C14/B07. */
export async function fixtureHuH10({ prisma }: ContextoFixtures) {
  const [profesor, materias, aula, mesa, alumnos] = await Promise.all([
    prisma.profesor.findUnique({ where: { dniProfesor: "27100001" } }),
    prisma.materia.findMany({ where: { codigoMateria: { in: ["FIS101", "MAT101"] } }, orderBy: { codigoMateria: "asc" } }),
    prisma.aula.findUnique({ where: { nombreAula: "Aula 1" } }),
    prisma.usuario.findUnique({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    prisma.alumno.findMany({ where: { activoAlumno: true }, orderBy: { dniAlumno: "asc" }, take: 40 }),
  ]);
  if (!profesor || materias.length !== 2 || !aula || !mesa || alumnos.length < 34) throw new Error("HU-H-10 necesita profesor1, FIS101/MAT101, Aula 1, mesa y 34 alumnos activos.");
  const actor = actorUsuario(mesa.idUsuario), hoy = fechaCentro(ahora());
  for (let atraso = 1; atraso <= 13; atraso++) {
    const mes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - atraso, 1));
    const lunes = 22 + (8 - new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth(), 22)).getUTCDay()) % 7;
    const materia = materias[atraso % 2];
    for (let numero = 0; numero < 2; numero++) {
      const dia = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth(), lunes + numero));
      const momento = instanteCentro(new Date(dia.getTime() - 2 * 86400000).toISOString().slice(0, 10), "07:00");
      await conReloj(momento, async () => {
        let clase = await prisma.turno.findFirst({ where: { fechaTurno: dia, horaInicioTurno: new Date("1970-01-01T10:00:00Z"), profesorId: profesor.idProfesor, materiaId: materia.idMateria, creadoPorUsuarioId: mesa.idUsuario } });
        if (!clase) {
          const creada = await configurarTurno({ fecha: dia, hora_inicio: "10:00", duracion_min: 60, materia_id: materia.idMateria, profesor_id: profesor.idProfesor }, mesa.idUsuario);
          clase = await prisma.turno.findUniqueOrThrow({ where: { idTurno: creada.id } });
        }
        if (clase.estadoTurno === "PENDIENTE") {
          if (!clase.aulaId) await asignarAulaTurno(clase.idTurno, { aula_id: aula.idAula }, mesa.idUsuario);
          await asignarParticipantesTurno(clase.idTurno, { alumno_ids: [alumnos[0].idAlumno] }, mesa.idUsuario);
        }
        if (clase.estadoTurno === "CANCELADO") return;
        const turnoId = clase.idTurno;
        async function inscribir(indice: number, reserva = false) {
          const alumnoId = alumnos[indice].idAlumno;
          const existente = await prisma.turnoAlumno.findFirst({ where: { turnoId, alumnoId }, orderBy: [{ createdAtInscripcion: "desc" }, { idInscripcion: "desc" }] });
          if (existente) return existente.idInscripcion;
          const creada = await transaccion(tx => crearInscripcion(tx, { turnoId, alumnoId, origen: "CENTRO", conReserva: reserva, actor }), { db: prisma });
          return creada.inscripcion.id;
        }
        async function finalizar(indice: number, vigencia: "CANCELADA_ALUMNO" | "BAJA_ALUMNO" | "QUITADA_CENTRO") {
          if (await prisma.turnoAlumno.findFirst({ where: { turnoId, alumnoId: alumnos[indice].idAlumno, vigencia } })) return;
          const id = await inscribir(indice);
          const existente = await prisma.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: id } });
          if (existente.vigencia === "VIGENTE") await transaccion(tx => finalizarInscripcion(tx, { inscripcionId: id, vigencia, actor }), { db: prisma });
        }
        for (let i = 1; i <= 1 + atraso % 3; i++) await finalizar(i, "CANCELADA_ALUMNO");
        await finalizar(4, "BAJA_ALUMNO");
        await finalizar(5, "QUITADA_CENTRO");
        // Reinscripción del mismo alumno: conserva cancelada anterior y vigente nueva.
        if (!await prisma.turnoAlumno.findFirst({ where: { turnoId, alumnoId: alumnos[1].idAlumno, vigencia: "VIGENTE" } })) {
          await transaccion(tx => crearInscripcion(tx, { turnoId, alumnoId: alumnos[1].idAlumno, origen: "CENTRO", conReserva: false, actor }), { db: prisma });
        }
        const marcada = await inscribir(6, true);
        const reserva = await prisma.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: marcada } });
        if (reserva.vigencia === "VIGENTE") await conReloj(new Date(momento.getTime() + 25 * 3600000), () => transaccion(tx => marcarVencidas(tx, turnoId), { db: prisma }));
        if (numero === 1) {
          // Reserva que aún no venció cuando cancela el centro; no figura luego en las series alumno.
          await conReloj(new Date(momento.getTime() + 25 * 3600000), async () => {
            await inscribir(7, true);
            await cancelarTurno(turnoId, mesa.idUsuario);
          });
        } else {
          // Última operación: vencida sin marcar. Alumno distinto por mes evita que otra alta la marque.
          await conReloj(new Date(momento.getTime() + 25 * 3600000), () => inscribir(20 + atraso, true));
        }
      });
    }
  }
}
