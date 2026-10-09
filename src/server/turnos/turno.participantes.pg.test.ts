import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { asignarParticipantesTurno } from "./turno.service";

// Inscripción vigente sin plazo de pago (PR-0.md §2.1 y §2.15): los campos que la fila exige desde el PR 0.
const SIN_PLAZO = { estadoPago: "PAGO_SIN_REGISTRAR", precio: 10000, reservadaEl: new Date() } as const;

// Mismo gate que los tests PostgreSQL existentes: nunca escribir en noctium_dev.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const prefijo = `pgparticipantes${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const materiaId = `${prefijo}-materia`;
const profesores = [`${prefijo}-profesor-a`, `${prefijo}-profesor-b`];
const aulaId = `${prefijo}-aula`;
const alumnos = [`${prefijo}-alumno-anterior`, `${prefijo}-alumno-nuevo`];
const turnoId = `${prefijo}-turno`;
const fecha = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
fecha.setUTCHours(0, 0, 0, 0);
const diaSemana = (["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"] as const)[fecha.getUTCDay()];
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);

describe.skipIf(!habilitada)("asignarParticipantesTurno: rollback en PostgreSQL aislado", () => {
  beforeAll(async () => {
    // Con tarifa: inscribir en una materia sin tarifa se rechaza (HU-L-06, PR-0.md §1.1).
    await db!.materia.create({ data: { idMateria: materiaId, nombreMateria: prefijo, nombreNormalizadaMateria: prefijo, tarifaHoraMateria: 10000 } });
    for (const [indice, profesorId] of profesores.entries()) {
      await db!.profesor.create({ data: {
        idProfesor: profesorId, nombreProfesor: "Prueba", apellidoProfesor: String(indice),
        nombreNormalizadoProfesor: "prueba", apellidoNormalizadoProfesor: String(indice),
        dniProfesor: `${prefijo}-dni-profesor-${indice}`, fechaNacimientoProfesor: new Date("1990-01-01T00:00:00.000Z"),
      } });
      await db!.profesorMateria.create({ data: { profesorId, materiaId } });
      await db!.horarioProfesor.create({ data: {
        profesorId, diaSemanaHorario: diaSemana, horaDesdeHorario: hora("08:00"), horaHastaHorario: hora("20:00"),
      } });
    }
    await db!.aula.create({ data: {
      idAula: aulaId, nombreAula: prefijo, nombreNormalizadaAula: prefijo, capacidadAula: 3,
    } });
    for (const [indice, alumnoId] of alumnos.entries()) {
      await db!.alumno.create({ data: {
        idAlumno: alumnoId, nombreAlumno: "Prueba", apellidoAlumno: String(indice),
        nombreNormalizadoAlumno: "prueba", apellidoNormalizadoAlumno: String(indice),
        dniAlumno: `${prefijo}-dni-alumno-${indice}`, fechaNacimientoAlumno: new Date("2000-01-01T00:00:00.000Z"),
      } });
    }
    await db!.turno.create({ data: {
      idTurno: turnoId, fechaTurno: fecha, horaInicioTurno: hora("10:00"), duracionMinutosTurno: 60,
      cupoMaximoTurno: 3, materiaId, profesorId: profesores[0], aulaId, estadoTurno: "PENDIENTE",
    } });
    await db!.turnoAlumno.create({ data: { turnoId, alumnoId: alumnos[0], ...SIN_PLAZO } });
  });

  afterAll(async () => {
    try {
      if (db) {
        await db.eventoTurno.deleteMany({ where: { turnoId } });
        await db.turnoAlumno.deleteMany({ where: { turnoId } });
        await db.turno.deleteMany({ where: { idTurno: turnoId } });
        await db.horarioProfesor.deleteMany({ where: { profesorId: { in: profesores } } });
        await db.profesorMateria.deleteMany({ where: { profesorId: { in: profesores } } });
        await db.alumno.deleteMany({ where: { idAlumno: { in: alumnos } } });
        await db.aula.deleteMany({ where: { idAula: aulaId } });
        await db.profesor.deleteMany({ where: { idProfesor: { in: profesores } } });
        await db.materia.deleteMany({ where: { idMateria: materiaId } });
      }
    } finally { await db?.$disconnect(); }
  });

  it("revierte profesor y participantes previos si falla createMany después del UPDATE y DELETE", async () => {
    // El endpoint impide duplicados con Zod. Acá se llama al servicio directamente
    // para inducir un error dentro de la transacción, luego de escrituras exitosas
    // (profesor, confirmación, QUITADA_CENTRO del participante previo y la primera
    // alta). Desde el PR 0 el repetido lo detecta crearInscripcion antes del índice
    // único (ALUMNO_YA_ASIGNADO en vez de P2002, PR-0.md §2.0); la reversión es la misma.
    await expect(asignarParticipantesTurno(turnoId, {
      profesor_id: profesores[1], alumno_ids: [alumnos[1], alumnos[1]],
    }, `${prefijo}-usuario`)).rejects.toMatchObject({ code: "ALUMNO_YA_ASIGNADO" });

    expect(await db!.turno.findUniqueOrThrow({ where: { idTurno: turnoId } }))
      .toMatchObject({ profesorId: profesores[0], estadoTurno: "PENDIENTE" });
    expect(await db!.turnoAlumno.findMany({ where: { turnoId }, select: { alumnoId: true, vigencia: true } }))
      .toEqual([{ alumnoId: alumnos[0], vigencia: "VIGENTE" }]);
    expect(await db!.eventoTurno.count({ where: { turnoId } })).toBe(0);
  });
});
