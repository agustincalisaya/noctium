import type { ContextoFixtures } from "./index";
import { sembrarClaseAsistencia } from "./hu-e-09";

/** Repite el seed sin insertar registros de negocio directos: usa el flujo de E09. */
export async function fixtureHuH07(contexto: ContextoFixtures) {
  const db = contexto.prisma;
  const [usuario, profesor, materias, aula, alumnos] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    db.profesor.findFirstOrThrow({ where: { emailProfesor: "profesor1@noctium.local" } }),
    db.materia.findMany({ where: { nombreMateria: { in: ["Matemática", "Física"] } } }),
    db.aula.findFirstOrThrow({ where: { activaAula: true, capacidadAula: { gte: 12 } }, orderBy: { capacidadAula: "desc" } }),
    db.alumno.findMany({ where: { activoAlumno: true }, orderBy: { dniAlumno: "asc" }, take: 12 }),
  ]);
  const matematica = materias.find(m => m.nombreMateria === "Matemática");
  const fisica = materias.find(m => m.nombreMateria === "Física");
  if (!matematica || !fisica || alumnos.length !== 12) throw new Error("HU-H-07 requiere Matemática, Física y doce alumnos activos del seed base");
  const base = { usuarioId: usuario.idUsuario, profesorId: profesor.idProfesor, aulaId: aula.idAula, alumnoIds: alumnos.map(a => a.idAlumno), hora: "11:00" };
  // Once alumnos: 2/4 = 50 %; duodécimo: 3/4 = 75 %, no figura bajo umbral 75.
  for (let d = 4; d <= 7; d++) {
    await sembrarClaseAsistencia(contexto, { ...base, materiaId: matematica.idMateria, fecha: `2026-05-0${d}`, estados: alumnos.map((_, indice) => d <= 5 || (d === 6 && indice === 11) ? "PRESENTE" : "AUSENTE") });
  }
  for (const fecha of ["2026-06-01", "2026-06-02"]) {
    await sembrarClaseAsistencia(contexto, { ...base, materiaId: fisica.idMateria, fecha, estados: alumnos.map(() => "PRESENTE") });
  }
  await sembrarClaseAsistencia(contexto, { ...base, materiaId: fisica.idMateria, fecha: "2026-06-03" });
}
