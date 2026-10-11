import type { ContextoFixtures } from "./index";
import { crearProfesor, asociarMateriasAProfesor, registrarHorarioProfesor } from "../../../src/server/profesores/profesor.service";
import { desactivarProfesor } from "../../../src/server/profesores/profesor.estado.service";
import { actorUsuario } from "../../../src/server/shared/historial";

/** Escenarios sin clases: idempotentes, nunca cambian una ficha ya existente.
 * Las clases futuras/ocupadas se construyen en la base descartable de las pruebas.
 */
export async function fixtureHuD08({ prisma }: ContextoFixtures) {
  const mesa = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } });
  const gerente = await prisma.usuario.findFirstOrThrow({ where: { rolUsuario: "GERENTE", activoUsuario: true } });
  const materia = await prisma.materia.findFirst({ where: { activaMateria: true }, orderBy: { nombreNormalizadaMateria: "asc" } });
  for (const escenario of [
    { dni: "88080001", nombre: "Consulta", email: "d08.profesor.activo@noctium.local", inactivo: false },
    { dni: "88080002", nombre: "Regreso", email: "d08.profesor.inactivo@noctium.local", inactivo: true },
  ]) {
    if (await prisma.profesor.findUnique({ where: { dniProfesor: escenario.dni } })) continue;
    const p = await crearProfesor({ nombre: escenario.nombre, apellido: "Prueba D08", dni: escenario.dni,
      email: escenario.email, fechaNacimiento: new Date("1985-05-12T00:00:00Z") }, mesa.idUsuario);
    if (materia) await asociarMateriasAProfesor(p.id, [materia.idMateria], mesa.idUsuario);
    await registrarHorarioProfesor({ profesorId: p.id, diaSemana: "MIERCOLES", horaInicio: "14:00", horaFin: "18:00" }, mesa.idUsuario);
    if (escenario.inactivo) {
      const ficha = await prisma.profesor.findUniqueOrThrow({ where: { idProfesor: p.id } });
      await desactivarProfesor(p.id, { version: ficha.version }, actorUsuario(gerente.idUsuario));
    }
  }
}
