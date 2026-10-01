import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { listarTurnosPropios } from "./turno.service";

// Este test solo usa la URL declarada como aislada y ejecuta los fixtures en
// una transacción que siempre revierte, incluso si una aserción falla.
const urlAislada = process.env.HU_C13_TEST_DATABASE_URL;
const habilitada = Boolean(urlAislada && process.env.DATABASE_URL === urlAislada);
const db = habilitada ? new PrismaClient({ datasources: { db: { url: urlAislada } } }) : null;
const prefijo = `huc13${Date.now().toString(36)}`;
const fecha = (dia: number) => new Date(Date.UTC(2026, 8, dia));
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);
const ahora = new Date("2026-09-29T12:00:00.000Z"); // 09:00 en Argentina.
const idMateria = `${prefijo}-materia`;
const idProfesor = `${prefijo}-profesor`;
const idAula = `${prefijo}-aula`;
const idUsuario = `${prefijo}-usuario`;
const idAlumno = `${prefijo}-alumno`;
const idOtroAlumno = `${prefijo}-otro-alumno`;
const idTurnoPasado = `${prefijo}-pasado`;
const idTurnoCompleto = `${prefijo}-completo`;
const idTurnoPendiente = `${prefijo}-pendiente`;
const idTurnoLimite = `${prefijo}-limite`;
const idTurnoAjeno = `${prefijo}-ajeno`;
const rollback = new Error("rollback de fixtures HU-C-13");

describe.skipIf(!habilitada)("listarTurnosPropios: PostgreSQL aislado", () => {
  beforeAll(async () => { await db!.$connect(); });
  afterAll(async () => { await db!.$disconnect(); });

  it("consulta relaciones, límite temporal inclusivo, aislamiento y clase dictada sin persistir fixtures", async () => {
    try {
      await db!.$transaction(async (tx) => {
        await tx.materia.create({
          data: { idMateria, nombreMateria: `${prefijo} Matemática`, nombreNormalizadaMateria: `${prefijo} matematica` },
        });
        await tx.profesor.create({
          data: {
            idProfesor, nombreProfesor: "Martín", apellidoProfesor: "Ríos",
            nombreNormalizadoProfesor: "martin", apellidoNormalizadoProfesor: "rios",
            dniProfesor: `${prefijo}-dni-p`, fechaNacimientoProfesor: fecha(1),
          },
        });
        await tx.aula.create({
          data: { idAula, nombreAula: `${prefijo} Aula`, nombreNormalizadaAula: `${prefijo} aula`, capacidadAula: 5 },
        });
        await tx.usuario.create({
          data: { idUsuario, emailUsuario: `${prefijo}@example.test`, passwordHashUsuario: "unused", rolUsuario: "ALUMNO" },
        });
        await tx.alumno.createMany({ data: [
          {
            idAlumno, usuarioId: idUsuario, nombreAlumno: "Iván", apellidoAlumno: "Prueba",
            nombreNormalizadoAlumno: "ivan", apellidoNormalizadoAlumno: "prueba",
            dniAlumno: `${prefijo}-dni-a1`, fechaNacimientoAlumno: fecha(1),
          },
          {
            idAlumno: idOtroAlumno, nombreAlumno: "Otra", apellidoAlumno: "Persona",
            nombreNormalizadoAlumno: "otra", apellidoNormalizadoAlumno: "persona",
            dniAlumno: `${prefijo}-dni-a2`, fechaNacimientoAlumno: fecha(1),
          },
        ] });

        await tx.turno.createMany({ data: [
          {
            idTurno: idTurnoPasado, fechaTurno: fecha(28), horaInicioTurno: hora("11:00"),
            duracionMinutosTurno: 60, estadoTurno: "CANCELADO", materiaId: idMateria,
            profesorId: idProfesor, aulaId: idAula,
          },
          {
            idTurno: idTurnoCompleto, fechaTurno: fecha(27), horaInicioTurno: hora("11:00"),
            duracionMinutosTurno: 60, estadoTurno: "COMPLETO", materiaId: idMateria,
            profesorId: idProfesor, aulaId: idAula,
          },
          {
            idTurno: idTurnoPendiente, fechaTurno: fecha(26), horaInicioTurno: hora("11:00"),
            duracionMinutosTurno: 60, estadoTurno: "PENDIENTE", materiaId: idMateria,
            profesorId: idProfesor, aulaId: idAula,
          },
          {
            idTurno: idTurnoLimite, fechaTurno: fecha(29), horaInicioTurno: hora("09:00"),
            duracionMinutosTurno: 120, estadoTurno: "DISPONIBLE", materiaId: idMateria,
            profesorId: idProfesor, aulaId: idAula,
          },
          {
            idTurno: idTurnoAjeno, fechaTurno: fecha(30), horaInicioTurno: hora("10:00"),
            duracionMinutosTurno: 60, estadoTurno: "COMPLETO", materiaId: idMateria,
            profesorId: idProfesor, aulaId: idAula,
          },
        ] });
        await tx.turnoAlumno.createMany({ data: [
          { turnoId: idTurnoPasado, alumnoId: idAlumno },
          { turnoId: idTurnoCompleto, alumnoId: idAlumno },
          { turnoId: idTurnoPendiente, alumnoId: idAlumno },
          { turnoId: idTurnoLimite, alumnoId: idAlumno },
          { turnoId: idTurnoAjeno, alumnoId: idOtroAlumno },
        ] });
        await tx.claseDictada.create({
          data: {
            idClaseDictada: `${prefijo}-clase`, turnoId: idTurnoPasado,
            fechaClaseDictada: fecha(28), materiaId: idMateria, profesorId: idProfesor,
          },
        });

        const anteriores = await listarTurnosPropios({ vista: "anteriores", pagina: 1, por_pagina: 10 }, idUsuario, tx, ahora);
        expect(anteriores.totales).toEqual({ proximos: 1, anteriores: 3 });
        expect(anteriores.items).toEqual([
          expect.objectContaining({
            turno_id: idTurnoPasado, estado: "CANCELADO", clase_dictada: true,
            fecha: "2026-09-28", hora_inicio: "11:00", hora_fin: "12:00",
            materia: `${prefijo} Matemática`, profesor: "Ríos, Martín", aula: `${prefijo} Aula`,
          }),
          expect.objectContaining({ turno_id: idTurnoCompleto, estado: "COMPLETO", clase_dictada: false }),
          expect.objectContaining({ turno_id: idTurnoPendiente, estado: "PENDIENTE", clase_dictada: false }),
        ]);

        const proximos = await listarTurnosPropios({ vista: "proximos", pagina: 1, por_pagina: 10 }, idUsuario, tx, ahora);
        expect(proximos.items).toHaveLength(1);
        expect(proximos.items[0]).toMatchObject({ turno_id: idTurnoLimite, clase_dictada: false, hora_fin: "11:00" });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
