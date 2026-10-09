import type { ContextoFixtures } from "./index";
import { registrarResultadoExamen } from "../../../src/server/historial/resultado-examen.service";

const OBSERVACION_PROFESOR = "HU-E-10 fixture: profesor corregible";
const OBSERVACION_MESA = "HU-E-10 fixture: mesa corregible";

/** Alta de demostración idempotente: la fixture nunca corrige ni anula por sí sola. */
export async function fixtureHuE10(contexto: ContextoFixtures) {
  const db = contexto.prisma;
  const [profesor, mesa, materia, alumno] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { emailUsuario: "profesor1@noctium.local" } }),
    db.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    db.materia.findUniqueOrThrow({ where: { nombreMateria: "Matemática" } }),
    db.alumno.findFirst({ where: { activoAlumno: true }, orderBy: { dniAlumno: "asc" } }),
  ]);
  if (!alumno) throw new Error("HU-E-10 requiere al menos un alumno activo del seed base");

  const resultados = [
    { actor: profesor, rol: "PROFESOR" as const, fecha: "2026-09-25", nota: "8.0", observaciones: OBSERVACION_PROFESOR },
    { actor: mesa, rol: "MESA_ENTRADA" as const, fecha: "2026-09-26", nota: "7.5", observaciones: OBSERVACION_MESA },
  ];
  for (const resultado of resultados) {
    const existente = await db.resultadoExamen.findFirst({
      where: {
        alumnoId: alumno.idAlumno,
        materiaId: materia.idMateria,
        creadoPorUsuarioId: resultado.actor.idUsuario,
        observaciones: resultado.observaciones,
      },
      select: { idResultadoExamen: true },
    });
    if (existente) continue;
    await registrarResultadoExamen(alumno.idAlumno, {
      materia_id: materia.idMateria,
      fecha_examen: new Date(`${resultado.fecha}T00:00:00.000Z`),
      nota: resultado.nota,
      observaciones: resultado.observaciones,
    }, { id: resultado.actor.idUsuario, rol: resultado.rol });
  }
}
