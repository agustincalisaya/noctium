// Preparación de datos exclusivamente en una base descartable con el seed oficial.
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { crearProfesorDePrueba, crearMateriaDePrueba, crearTurnoDePrueba, crearAulaDePrueba, crearAlumnoDePrueba, crearInscripcionDePrueba, crearOperacionDePrueba, abrirCajaDePrueba } from "@/server/testing/fabricas";
config({ path: process.env.D08_ENV || ".env", override: true, quiet: true });
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith("/noctium_d08_revision_")) throw new Error("Solo base descartable D08");
async function main() {
  const origenBase = await crearProfesorDePrueba(prisma), destinoBase = await crearProfesorDePrueba(prisma);
  // Las rutas de ficha validan CUID; las fábricas generales usan ids abreviados.
  const cuid = () => `c${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  const origen = await prisma.profesor.update({ where: { idProfesor: origenBase.idProfesor }, data: { idProfesor: cuid(), nombreProfesor: "Laura", apellidoProfesor: "Selección D08", nombreNormalizadoProfesor: "laura", apellidoNormalizadoProfesor: "seleccion d08" } });
  const destino = await prisma.profesor.update({ where: { idProfesor: destinoBase.idProfesor }, data: { idProfesor: cuid(), nombreProfesor: "Martín", apellidoProfesor: "Destino D08", nombreNormalizadoProfesor: "martin", apellidoNormalizadoProfesor: "destino d08" } });
  const m1 = await crearMateriaDePrueba(prisma), m2 = await crearMateriaDePrueba(prisma);
  await prisma.materia.update({ where: { idMateria: m1.idMateria }, data: { nombreMateria: "Matemática I D08", nombreNormalizadaMateria: "matematica i d08" } });
  await prisma.materia.update({ where: { idMateria: m2.idMateria }, data: { nombreMateria: "Física I D08", nombreNormalizadaMateria: "fisica i d08" } });
  const aula = await crearAulaDePrueba(prisma, { capacidad: 10 });
  await prisma.profesorMateria.createMany({ data: [{ profesorId: origen.idProfesor, materiaId: m1.idMateria }, { profesorId: origen.idProfesor, materiaId: m2.idMateria }, { profesorId: destino.idProfesor, materiaId: m1.idMateria }] });
  const dias = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"] as const;
  await prisma.horarioProfesor.createMany({ data: dias.map(dia => ({ profesorId: destino.idProfesor, diaSemanaHorario: dia, horaDesdeHorario: new Date("1970-01-01T08:00:00Z"), horaHastaHorario: new Date("1970-01-01T12:00:00Z") })) });
  const turns = [];
  for (let n = 0; n < 205; n++) turns.push(await crearTurnoDePrueba(prisma, { profesorId: origen.idProfesor, materiaId: m1.idMateria, aulaId: aula.idAula, enDias: 400 + n, hora: n === 204 ? "15:00" : "10:00" }));
  const extra = await crearTurnoDePrueba(prisma, { profesorId: origen.idProfesor, materiaId: m2.idMateria, aulaId: aula.idAula, enDias: 700 });
  const alumno = await crearAlumnoDePrueba(prisma);
  const ins = await crearInscripcionDePrueba(prisma, { turnoId: turns[204].idTurno, alumnoId: alumno.idAlumno });
  const operacion = await crearOperacionDePrueba(prisma, { cajaId: (await abrirCajaDePrueba(prisma)).idCaja, inscripcionIds: [ins.idInscripcion] });
  writeFileSync(process.env.D08_FIXTURES || "/tmp/d08-fixtures.json", JSON.stringify({ origen: origen.idProfesor, destino: destino.idProfesor, m1: m1.idMateria, m2: m2.idMateria, turns: turns.map(t => t.idTurno), extra: extra.idTurno, inscripcion: ins.idInscripcion, pago: operacion.pagos[0].idPago }));
}
main().finally(() => prisma.$disconnect());
