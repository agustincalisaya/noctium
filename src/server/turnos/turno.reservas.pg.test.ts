import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { asignarAulaTurno } from "./turno.aula.service";

// Ejecutar solo contra una base temporal con las migraciones aplicadas.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const prefijo = `c15pg${Date.now()}`;
const fecha = (dia: number) => new Date(`2030-10-${String(dia).padStart(2, "0")}T00:00:00.000Z`);
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);
const profesores = [0, 1].map((n) => `${prefijo}-prof-${n}`);
const aulas = [0, 1].map((n) => `${prefijo}-aula-${n}`);
const alumnos = [0, 1, 2].map((n) => `${prefijo}-alumno-${n}`);
const materia = `${prefijo}-materia`;

async function crearTurno(n: number, dia: number, inicio: string, profesor: string, aula: string, inscritos: string[]) {
  const id = `${prefijo}-turno-${n}`;
  await db!.turno.create({ data: { idTurno: id, fechaTurno: fecha(dia), horaInicioTurno: hora(inicio),
    duracionMinutosTurno: 60, cupoMaximoTurno: 3, materiaId: materia, profesorId: profesor, aulaId: aula, estadoTurno: "PENDIENTE" } });
  for (const alumnoId of inscritos) await db!.turnoAlumno.create({ data: { turnoId: id, alumnoId } });
  return id;
}

async function confirmarAmbos(uno: string, dos: string, reservas = 3) {
  const resultados = await Promise.allSettled([uno, dos].map((idTurno) =>
    db!.turno.update({ where: { idTurno }, data: { estadoTurno: "DISPONIBLE" } })));
  expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
  expect(resultados.filter((resultado) => resultado.status === "rejected")).toHaveLength(1);
  expect(await db!.$queryRawUnsafe<{ total: bigint }[]>(
    'SELECT count(*) AS total FROM "reservas_turno" WHERE "turnoId" IN ($1, $2)', uno, dos)).toEqual([{ total: BigInt(reservas) }]);
  expect(await db!.turno.count({ where: { idTurno: { in: [uno, dos] }, estadoTurno: "PENDIENTE" } })).toBe(1);
}

describe.skipIf(!habilitada)("HU-C-15: exclusión real en PostgreSQL aislado", () => {
  beforeAll(async () => {
    await db!.materia.create({ data: { idMateria: materia, nombreMateria: materia, nombreNormalizadaMateria: materia } });
    for (let n = 0; n < 2; n++) {
      await db!.profesor.create({ data: { idProfesor: profesores[n], nombreProfesor: "Profesor", apellidoProfesor: String(n),
        nombreNormalizadoProfesor: "profesor", apellidoNormalizadoProfesor: String(n), dniProfesor: `${Date.now()}${n}`, fechaNacimientoProfesor: fecha(1) } });
      await db!.aula.create({ data: { idAula: aulas[n], nombreAula: `C15 ${prefijo.slice(-12)} ${n}`, nombreNormalizadaAula: `c15 ${prefijo.slice(-12)} ${n}`, capacidadAula: 5 } });
      await db!.profesorMateria.create({ data: { profesorId: profesores[n], materiaId: materia } });
      for (const diaSemanaHorario of ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"] as const) {
        await db!.horarioProfesor.create({ data: { profesorId: profesores[n], diaSemanaHorario, horaDesdeHorario: hora("08:00"), horaHastaHorario: hora("20:00") } });
      }
    }
    for (let n = 0; n < 3; n++) await db!.alumno.create({ data: { idAlumno: alumnos[n], nombreAlumno: "Alumno", apellidoAlumno: String(n),
      nombreNormalizadoAlumno: "alumno", apellidoNormalizadoAlumno: String(n), dniAlumno: `${Date.now()}${n}9`, fechaNacimientoAlumno: fecha(1) } });
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("dos turnos distintos compitiendo por la misma aula: confirma uno", async () => {
    const a = await crearTurno(1, 1, "10:00", profesores[0], aulas[0], [alumnos[0]]);
    const b = await crearTurno(2, 1, "10:30", profesores[1], aulas[0], [alumnos[1]]);
    await confirmarAmbos(a, b);
  });
  it("dos turnos distintos compitiendo por el mismo profesor: confirma uno", async () => {
    const a = await crearTurno(3, 2, "10:00", profesores[0], aulas[0], [alumnos[0]]);
    const b = await crearTurno(4, 2, "10:30", profesores[0], aulas[1], [alumnos[1]]);
    await confirmarAmbos(a, b);
  });
  it("protege cualquiera de varios alumnos y permite horarios contiguos", async () => {
    const a = await crearTurno(5, 3, "10:00", profesores[0], aulas[0], [alumnos[0], alumnos[2]]);
    const b = await crearTurno(6, 3, "10:30", profesores[1], aulas[1], [alumnos[1], alumnos[2]]);
    await confirmarAmbos(a, b, 4);
    const c = await crearTurno(7, 3, "11:30", profesores[0], aulas[0], [alumnos[2]]);
    await expect(db!.turno.update({ where: { idTurno: c }, data: { estadoTurno: "DISPONIBLE" } })).resolves.toBeTruthy();
  });
  it("HU-C-04 agrega y quita reservas; un conflicto revierte el alta", async () => {
    const a = await crearTurno(8, 4, "10:00", profesores[0], aulas[0], [alumnos[0]]);
    const b = await crearTurno(9, 4, "10:00", profesores[1], aulas[1], [alumnos[1]]);
    await db!.turno.update({ where: { idTurno: a }, data: { estadoTurno: "DISPONIBLE" } });
    await db!.turno.update({ where: { idTurno: b }, data: { estadoTurno: "DISPONIBLE" } });
    await expect(db!.turnoAlumno.create({ data: { turnoId: b, alumnoId: alumnos[0] } })).rejects.toThrow();
    expect(await db!.turnoAlumno.count({ where: { turnoId: b } })).toBe(1);
    await db!.turnoAlumno.delete({ where: { turnoId_alumnoId: { turnoId: a, alumnoId: alumnos[0] } } });
    await expect(db!.turnoAlumno.create({ data: { turnoId: b, alumnoId: alumnos[0] } })).resolves.toBeTruthy();
    expect(await db!.$queryRawUnsafe<{ total: bigint }[]>(
      'SELECT count(*) AS total FROM "reservas_turno" WHERE "turnoId" = $1 AND "tipoRecurso" = $2', b, "ALUMNO")).toEqual([{ total: 2n }]);
  });
  it("el servicio guarda aula pendiente sin reservar y rechaza capacidad insuficiente", async () => {
    const turnoId = await crearTurno(10, 10, "10:00", profesores[0], aulas[0], []);
    const pendiente = await asignarAulaTurno(turnoId, { aula_id: aulas[1] }, "usuario-prueba");
    expect(pendiente).toMatchObject({ estado: "PENDIENTE", aula_id: aulas[1] });
    expect(await db!.$queryRawUnsafe<{ total: bigint }[]>(
      'SELECT count(*) AS total FROM "reservas_turno" WHERE "turnoId" = $1', turnoId)).toEqual([{ total: 0n }]);
    const aulaPequena = `${prefijo}-aula-pequena`;
    await db!.aula.create({ data: { idAula: aulaPequena, nombreAula: `C15 ${prefijo.slice(-12)} P`, nombreNormalizadaAula: `c15 ${prefijo.slice(-12)} p`, capacidadAula: 2 } });
    await expect(asignarAulaTurno(turnoId, { aula_id: aulaPequena }, "usuario-prueba"))
      .rejects.toMatchObject({ code: "AULA_CAPACIDAD_INSUFICIENTE", message: "La capacidad del aula es menor que el cupo máximo del turno" });
    expect((await db!.turno.findUniqueOrThrow({ where: { idTurno: turnoId } })).aulaId).toBe(aulas[1]);
  });
  it("el servicio confirma Disponible o Completo y revalida todos los alumnos", async () => {
    const disponible = await crearTurno(11, 11, "10:00", profesores[0], aulas[0], [alumnos[0], alumnos[1]]);
    await expect(asignarAulaTurno(disponible, { aula_id: aulas[0] }, "usuario-prueba"))
      .resolves.toMatchObject({ estado: "DISPONIBLE", mensaje: "Turno confirmado correctamente" });
    const completo = await crearTurno(12, 12, "10:00", profesores[0], aulas[0], alumnos);
    await expect(asignarAulaTurno(completo, { aula_id: aulas[0] }, "usuario-prueba"))
      .resolves.toMatchObject({ estado: "COMPLETO", mensaje: "Turno confirmado correctamente" });
    const invalido = await crearTurno(13, 13, "10:00", profesores[0], aulas[0], [alumnos[0], alumnos[2]]);
    await db!.alumno.update({ where: { idAlumno: alumnos[2] }, data: { activoAlumno: false } });
    await expect(asignarAulaTurno(invalido, { aula_id: aulas[1] }, "usuario-prueba"))
      .rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", detalles: { alumno_id: alumnos[2] } });
    expect((await db!.turno.findUniqueOrThrow({ where: { idTurno: invalido } })).estadoTurno).toBe("PENDIENTE");
    expect((await db!.turno.findUniqueOrThrow({ where: { idTurno: invalido } })).aulaId).toBe(aulas[0]);
  });
  it("dos confirmaciones del servicio sobre turnos distintos dejan un único ganador", async () => {
    const a = await crearTurno(14, 14, "10:00", profesores[0], aulas[0], [alumnos[0]]);
    const b = await crearTurno(15, 14, "10:30", profesores[1], aulas[0], [alumnos[1]]);
    const resultados = await Promise.allSettled([a, b].map((turnoId) => asignarAulaTurno(turnoId, { aula_id: aulas[0] }, "usuario-prueba")));
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    const fallidos = resultados.filter((resultado) => resultado.status === "rejected");
    expect(fallidos).toHaveLength(1);
    expect(fallidos[0].reason).toMatchObject({ code: "AULA_NO_DISPONIBLE" });
    expect(await db!.turno.count({ where: { idTurno: { in: [a, b] }, estadoTurno: "PENDIENTE" } })).toBe(1);
    expect(await db!.$queryRawUnsafe<{ total: bigint }[]>(
      'SELECT count(*) AS total FROM "reservas_turno" WHERE "turnoId" IN ($1, $2)', a, b)).toEqual([{ total: 3n }]);
  });
});
