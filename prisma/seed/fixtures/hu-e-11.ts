import type { ContextoFixtures } from "./index";
import { sembrarClaseAsistencia } from "./hu-e-09";
import { corregirAsistenciaClaseDictada, anularClaseDictada } from "../../../src/server/historial/clase-dictada.service";
import { conReloj } from "../../../src/server/shared/reloj";

/** Escenarios estables. Una anulación existente nunca se vuelve a registrar al repetir seed. */
export async function fixtureHuE11(contexto: ContextoFixtures) {
  const db = contexto.prisma;
  const [usuario, profesor, materia, aula, alumnos] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    db.profesor.findFirstOrThrow({ where: { emailProfesor: "profesor1@noctium.local" } }),
    db.materia.findFirstOrThrow({ where: { nombreMateria: "Matemática" } }),
    db.aula.findFirstOrThrow({ where: { activaAula: true, capacidadAula: { gte: 4 } }, orderBy: { capacidadAula: "desc" } }),
    db.alumno.findMany({ where: { activoAlumno: true }, orderBy: { dniAlumno: "asc" }, take: 4 }),
  ]);
  if (alumnos.length !== 4) throw new Error("HU-E-11 requiere cuatro alumnos del seed base");
  const base = { usuarioId: usuario.idUsuario, profesorId: profesor.idProfesor, materiaId: materia.idMateria, aulaId: aula.idAula, alumnoIds: alumnos.map(a => a.idAlumno), hora: "11:00" };
  const actor = { id: usuario.idUsuario, rol: "MESA_ENTRADA" as const };
  for (const fecha of ["2026-09-28", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-02"]) {
    const existente = await db.claseDictada.findFirst({ where: { fechaClaseDictada: new Date(`${fecha}T00:00:00Z`), profesorId: base.profesorId, materiaId: base.materiaId,
      turno: { horaInicioTurno: new Date("1970-01-01T11:00:00Z") } } });
    const turnoId = existente?.turnoId ?? (await sembrarClaseAsistencia(contexto, { ...base, fecha,
      estados: fecha === "2026-10-06" ? undefined : ["PRESENTE", "PRESENTE", "AUSENTE", "PRESENTE"] })).turnoId;
    if (fecha === "2026-10-07" && !(await db.correccionAsistencia.findFirst({ where: { clase: { turnoId } } }))) {
      await conReloj(new Date(`${fecha}T16:00:00Z`), () => corregirAsistenciaClaseDictada(turnoId, actor, { motivo: "Corrección de presentación HU-E-11", asistencias: base.alumnoIds.map(alumno_id => ({ alumno_id, estado: "PRESENTE" })) }));
    }
    if (fecha === "2026-10-02" && !existente?.anuladaEl) {
      await conReloj(new Date(`${fecha}T16:00:00Z`), () => anularClaseDictada(turnoId, actor, "La clase no se dio: escenario HU-E-11"));
    }
  }
}
