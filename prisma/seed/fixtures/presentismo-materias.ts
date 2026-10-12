import type { ContextoFixtures } from "./index";
import { sembrarClaseAsistencia } from "./hu-e-09";

/**
 * Demo del gráfico «Índice de presentismo por materia» (HU-H-07) con más de dos
 * materias: los demás fixtures solo dictan Matemática y Física (profesor1).
 * Dos clases dictadas con asistencia por materia, julio y agosto de 2026, con
 * índices distintos para ver el orden de menor a mayor. Usa el flujo de E09
 * (servicios de dominio) y no vuelve a registrar una clase ya dictada.
 */
const P = "PRESENTE" as const;
const A = "AUSENTE" as const;
const CLASES = [
  // Programación I: 14/16 = 87,5 %
  { materia: "Programación I", dni: "28100002", hora: "10:00", fecha: "2026-07-07", estados: [P, P, P, P, P, P, P, P] },
  { materia: "Programación I", dni: "28100002", hora: "10:00", fecha: "2026-07-14", estados: [P, P, P, P, P, P, A, A] },
  // Química: 12/16 = 75 %
  { materia: "Química", dni: "29100003", hora: "15:00", fecha: "2026-07-09", estados: [P, P, P, P, P, P, A, A] },
  { materia: "Química", dni: "29100003", hora: "15:00", fecha: "2026-07-16", estados: [P, P, P, P, P, P, A, A] },
  // Bases de Datos: 10/16 = 62,5 %
  { materia: "Bases de Datos", dni: "28100002", hora: "12:00", fecha: "2026-08-04", estados: [P, P, P, P, P, A, A, A] },
  { materia: "Bases de Datos", dni: "28100002", hora: "12:00", fecha: "2026-08-11", estados: [P, P, P, P, P, A, A, A] },
  // Inglés Técnico: 6/16 = 37,5 %
  { materia: "Inglés Técnico", dni: "30100004", hora: "17:00", fecha: "2026-08-06", estados: [P, P, P, A, A, A, A, A] },
  { materia: "Inglés Técnico", dni: "30100004", hora: "17:00", fecha: "2026-08-13", estados: [P, P, P, A, A, A, A, A] },
];

export async function fixturePresentismoMaterias(contexto: ContextoFixtures) {
  const db = contexto.prisma;
  const [usuario, aula, alumnos] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    db.aula.findUniqueOrThrow({ where: { nombreAula: "Aula 2" } }),
    db.alumno.findMany({ where: { activoAlumno: true }, orderBy: { dniAlumno: "asc" }, skip: 12, take: 8 }),
  ]);
  if (alumnos.length !== 8) throw new Error("Presentismo por materia necesita ocho alumnos activos después de los doce primeros del seed base");
  for (const clase of CLASES) {
    const [materia, profesor] = await Promise.all([
      db.materia.findUniqueOrThrow({ where: { nombreMateria: clase.materia } }),
      db.profesor.findUniqueOrThrow({ where: { dniProfesor: clase.dni } }),
    ]);
    const existente = await db.claseDictada.findFirst({
      where: { fechaClaseDictada: new Date(`${clase.fecha}T00:00:00Z`), profesorId: profesor.idProfesor, materiaId: materia.idMateria, anuladaEl: null },
    });
    if (existente) continue;
    await sembrarClaseAsistencia(contexto, {
      usuarioId: usuario.idUsuario, profesorId: profesor.idProfesor, materiaId: materia.idMateria, aulaId: aula.idAula,
      alumnoIds: alumnos.map((a) => a.idAlumno), fecha: clase.fecha, hora: clase.hora, estados: clase.estados,
    });
  }
}
