import type { ContextoFixtures } from "./index";
import { sembrarClaseAsistencia } from "./hu-e-09";
import { registrarResultadoExamen } from "../../../src/server/historial/resultado-examen.service";
import { registrarIndicacion } from "../../../src/server/historial/indicacion.service";
import { registrarObservacionClase } from "../../../src/server/historial/observacion-clase.service";
import { transaccion } from "../../../src/server/shared/transaccion";
import { conReloj } from "../../../src/server/shared/reloj";

/** Timeline de más de diez registros y materias múltiples, creada mediante servicios. */
export async function fixtureHuE08(contexto: ContextoFixtures) {
  const db = contexto.prisma;
  const [mesa, profesor, alumno, aula, materias] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    db.profesor.findFirstOrThrow({ where: { emailProfesor: "profesor1@noctium.local" } }),
    db.alumno.findFirstOrThrow({ where: { usuario: { emailUsuario: "alumno01@noctium.local" } } }),
    db.aula.findFirstOrThrow({ where: { activaAula: true }, orderBy: { capacidadAula: "desc" } }),
    db.materia.findMany({ where: { activaMateria: true, profesores: { some: { profesor: { emailProfesor: "profesor1@noctium.local" } } } }, orderBy: { nombreMateria: "asc" }, take: 2 }),
  ]);
  if (materias.length !== 2) throw new Error("HU-E-08 requiere dos materias");
  const actor = { id: mesa.idUsuario, rol: "MESA_ENTRADA" as const };
  for (let i = 0; i < 3; i++) {
    const materia = materias[i % 2]!;
    const fecha = `2026-09-0${i + 1}`;
    const existente = await db.claseDictada.findFirst({ where: { fechaClaseDictada: new Date(`${fecha}T00:00:00Z`), profesorId: profesor.idProfesor, materiaId: materia.idMateria, turno: { horaInicioTurno: new Date("1970-01-01T08:00:00Z") } } });
    const turnoId = existente?.turnoId ?? (await sembrarClaseAsistencia(contexto, { usuarioId: mesa.idUsuario, profesorId: profesor.idProfesor, materiaId: materia.idMateria, aulaId: aula.idAula, alumnoIds: [alumno.idAlumno], fecha, hora: "08:00", estados: i === 2 ? undefined : [i === 0 ? "PRESENTE" : "AUSENTE"] })).turnoId;
    const clase = await db.claseDictada.findFirstOrThrow({ where: { turnoId, anuladaEl: null } });
    if (!(await db.observacionClase.findUnique({ where: { claseDictadaId: clase.idClaseDictada } }))) {
      await conReloj(new Date(`${fecha}T15:00:00Z`), () => transaccion(tx => registrarObservacionClase(tx, turnoId, { temas_vistos: "Funciones y ejercicios de práctica", observaciones_internas: "Contenido interno HU-E-08: nunca debe llegar al alumno" }, actor)));
    }
    const indicacion = "Repasar los ejercicios 4 a 9 de la guía antes de la próxima clase.";
    if (!(await db.indicacion.findFirst({ where: { alumnoId: alumno.idAlumno, claseDictadaId: clase.idClaseDictada, texto: indicacion } }))) {
      await conReloj(new Date(`${fecha}T16:00:00Z`), () => transaccion(tx => registrarIndicacion(tx, alumno.idAlumno, { materia_id: materia.idMateria, clase_dictada_id: clase.idClaseDictada, indicacion }, actor)));
    }
    for (let j = 0; j < 3; j++) {
      const observaciones = `Fixture HU-E-08 examen ${i}-${j}`;
      if (!(await db.resultadoExamen.findFirst({ where: { alumnoId: alumno.idAlumno, observaciones } }))) {
        await conReloj(new Date(`${fecha}T17:00:00Z`), () => registrarResultadoExamen(alumno.idAlumno, { materia_id: materia.idMateria, fecha_examen: new Date(`${fecha}T00:00:00Z`), nota: String(8 - j), observaciones }, actor));
      }
    }
  }
}
