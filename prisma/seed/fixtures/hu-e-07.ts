import type { ContextoFixtures } from "./index";
import { registrarObservacionClase } from "../../../src/server/historial/observacion-clase.service";
import { transaccion } from "../../../src/server/shared/transaccion";

/** La clase de E-09 sirve de soporte estable para demostrar observaciones y su visibilidad. */
export async function fixtureHuE07(contexto: ContextoFixtures): Promise<void> {
  const db = contexto.prisma;
  const [mesa, profesor, materia] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    db.profesor.findFirstOrThrow({ where: { emailProfesor: "profesor1@noctium.local" } }),
    db.materia.findFirstOrThrow({ where: { nombreMateria: "Matemática" } }),
  ]);
  const turno = await db.turno.findFirst({
    where: {
      fechaTurno: new Date("2026-01-06T00:00:00.000Z"),
      horaInicioTurno: new Date("1970-01-01T11:00:00.000Z"),
      profesorId: profesor.idProfesor,
      materiaId: materia.idMateria,
    },
    select: { idTurno: true },
  });
  if (!turno) throw new Error("HU-E-07 requiere la clase de Matemática del fixture HU-E-09.");
  const clase = await db.claseDictada.findFirst({
    where: { turnoId: turno.idTurno, anuladaEl: null },
    select: { idClaseDictada: true },
  });
  if (!clase) throw new Error("HU-E-07 requiere que HU-E-09 registre la clase dictada de muestra.");
  if (await db.observacionClase.findUnique({ where: { claseDictadaId: clase.idClaseDictada }, select: { idObservacionClase: true } })) return;
  await transaccion((tx) => registrarObservacionClase(tx, turno.idTurno, {
    temas_vistos: "Ecuaciones lineales, resolución de problemas y comprobación de resultados.",
    observaciones_internas: "Para la próxima clase, revisar los ejercicios 3 y 4.",
  }, { id: mesa.idUsuario, rol: "MESA_ENTRADA" }), { db });
}
