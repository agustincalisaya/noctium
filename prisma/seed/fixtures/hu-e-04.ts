import type { ContextoFixtures } from "./index";
import { registrarIndicacion } from "../../../src/server/historial/indicacion.service";
import { transaccion } from "../../../src/server/shared/transaccion";

/** Indicación ligada a una clase real de HU-E-09; la búsqueda natural vuelve idempotente al seed. */
export async function fixtureHuE04({ prisma }: ContextoFixtures) {
  const [mesa, profesor, materia, alumno] = await Promise.all([
    prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    prisma.profesor.findFirstOrThrow({ where: { emailProfesor: "profesor1@noctium.local" } }),
    prisma.materia.findFirstOrThrow({ where: { nombreMateria: "Matemática" } }),
    prisma.alumno.findFirstOrThrow({ where: { activoAlumno: true }, orderBy: { dniAlumno: "asc" } }),
  ]);
  const clase = await prisma.claseDictada.findFirst({
    where: {
      fechaClaseDictada: new Date("2026-01-06T00:00:00.000Z"),
      materiaId: materia.idMateria,
      profesorId: profesor.idProfesor,
      anuladaEl: null,
      alumnos: { some: { alumnoId: alumno.idAlumno } },
    },
    orderBy: { idClaseDictada: "asc" },
    select: { idClaseDictada: true },
  });
  if (!clase) throw new Error("HU-E-04 necesita la clase dictada del 06/01/2026 de HU-E-09");

  const indicacion = "Reforzar fracciones y proporciones antes de la próxima evaluación.";
  const existente = await prisma.indicacion.findFirst({
    where: { alumnoId: alumno.idAlumno, materiaId: materia.idMateria, claseDictadaId: clase.idClaseDictada, texto: indicacion },
    select: { idIndicacion: true },
  });
  if (!existente) {
    await transaccion((tx) => registrarIndicacion(tx, alumno.idAlumno, {
      materia_id: materia.idMateria,
      indicacion,
      clase_dictada_id: clase.idClaseDictada,
    }, { id: mesa.idUsuario, rol: "MESA_ENTRADA" }), { db: prisma });
  }
}
