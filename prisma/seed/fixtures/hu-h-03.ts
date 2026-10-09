import type { ContextoFixtures } from "./index";
import { configurarTurno, asignarParticipantesTurno } from "../../../src/server/turnos/turno.service";
import { asignarAulaTurno } from "../../../src/server/turnos/turno.aula.service";
import { cancelarTurno } from "../../../src/server/turnos/turno.cancelacion.service";
import { conReloj, ahora } from "../../../src/server/shared/reloj";
import { fechaCentro, instanteCentro } from "../../../src/server/shared/fechas-centro";

/** Clases por servicios C; clave natural fecha/hora/profesor/materia. Repetir no altera hechos existentes. */
export async function fixtureHuH03({ prisma }: ContextoFixtures) {
  const [profesor, materia, aula, mesa, alumnos] = await Promise.all([
    prisma.profesor.findUnique({ where: { dniProfesor: "27100001" } }),
    prisma.materia.findUnique({ where: { codigoMateria: "FIS101" } }),
    prisma.aula.findUnique({ where: { nombreAula: "Aula 1" } }),
    prisma.usuario.findUnique({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    prisma.alumno.findMany({ where: { activoAlumno: true }, orderBy: { dniAlumno: "asc" }, take: 10 }),
  ]);
  if (!profesor || !materia || !aula || !mesa || alumnos.length < 10) throw new Error("HU-H-03 necesita profesor1, FIS101, Aula 1, mesa y diez alumnos del seed base.");
  const hoy = fechaCentro(ahora());
  for (let atraso = 1; atraso <= 6; atraso++) {
    const primerDia = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - atraso, 1));
    const lunes = 22 + (8 - new Date(Date.UTC(primerDia.getUTCFullYear(), primerDia.getUTCMonth(), 22)).getUTCDay()) % 7;
    for (let posicion = 0; posicion < 3; posicion++) {
      const dia = new Date(Date.UTC(primerDia.getUTCFullYear(), primerDia.getUTCMonth(), lunes + posicion));
      const fecha = dia.toISOString().slice(0, 10);
      await conReloj(instanteCentro(fecha, "07:00"), async () => {
        let clase = await prisma.turno.findFirst({ where: { fechaTurno: dia, horaInicioTurno: new Date("1970-01-01T08:00:00Z"), profesorId: profesor.idProfesor, materiaId: materia.idMateria, creadoPorUsuarioId: mesa.idUsuario } });
        if (!clase) {
          const creada = await configurarTurno({ fecha: dia, hora_inicio: "08:00", duracion_min: posicion === 1 ? 120 : 60, materia_id: materia.idMateria, profesor_id: profesor.idProfesor }, mesa.idUsuario);
          clase = await prisma.turno.findUniqueOrThrow({ where: { idTurno: creada.id } });
        }
        // Tercera clase queda Pendiente y demuestra su exclusión.
        if (posicion === 2) return;
        if (clase.estadoTurno === "PENDIENTE") {
          if (!clase.aulaId) await asignarAulaTurno(clase.idTurno, { aula_id: aula.idAula }, mesa.idUsuario);
          await asignarParticipantesTurno(clase.idTurno, { alumno_ids: (posicion === 0 && atraso === 1 ? alumnos : alumnos.slice(0, 2)).map(a => a.idAlumno) }, mesa.idUsuario);
        }
        // Segunda clase cancelada: suma una clase y cero horas.
        if (posicion === 1 && clase.estadoTurno !== "CANCELADO") await cancelarTurno(clase.idTurno, mesa.idUsuario);
      });
    }
  }
}
