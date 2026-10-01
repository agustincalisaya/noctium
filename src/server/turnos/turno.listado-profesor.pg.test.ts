import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { listarTurnos } from "./turno.service";

// Misma guarda que turno.publico.pg.test.ts: nunca escribir en la base habitual.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const prefijo = `pgc08${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const id = (sufijo: string) => `${prefijo}-${sufijo}`;
const dia = (valor: string) => new Date(`${valor}T00:00:00.000Z`);
// Lejos en el futuro, para que el alcance «desde hoy» del listado los incluya siempre.
const FUTURO = "2099-03-10";

describe.skipIf(!habilitada)("HU-C-08 listarTurnos por profesor: PostgreSQL real aislado", () => {
  beforeAll(async () => {
    await db!.materia.create({ data: { idMateria: id("m"), nombreMateria: id("m"), nombreNormalizadaMateria: id("m") } });
    await db!.usuario.create({ data: { idUsuario: id("u"), emailUsuario: `${prefijo}@test.local`, passwordHashUsuario: "x", rolUsuario: "PROFESOR" } });
    await db!.usuario.create({ data: { idUsuario: id("u-sin-ficha"), emailUsuario: `${prefijo}-b@test.local`, passwordHashUsuario: "x", rolUsuario: "PROFESOR" } });
    for (const [sufijo, usuarioId, activo] of [["p1", id("u"), true], ["p2", null, true], ["p3", null, false]] as const) {
      await db!.profesor.create({
        data: {
          idProfesor: id(sufijo), nombreProfesor: "Prueba", apellidoProfesor: id(sufijo),
          nombreNormalizadoProfesor: "prueba", apellidoNormalizadoProfesor: id(sufijo),
          dniProfesor: `${id(sufijo)}-dni`, fechaNacimientoProfesor: dia("1990-01-01"), usuarioId, activoProfesor: activo,
        },
      });
    }
    // Turnos PENDIENTE (sin reservas) de los dos profesores; luego uno pasa a CANCELADO.
    const turnos = [["t1", "p1", "10:00"], ["t2", "p1", "12:00"], ["t3", "p1", "14:00"], ["t4", "p2", "10:00"]] as const;
    for (const [sufijo, profesor, hora] of turnos) {
      await db!.turno.create({
        data: {
          idTurno: id(sufijo), fechaTurno: dia(FUTURO), horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`),
          duracionMinutosTurno: 60, materiaId: id("m"), profesorId: id(profesor), estadoTurno: "PENDIENTE",
        },
      });
    }
    await db!.turno.update({ where: { idTurno: id("t2") }, data: { estadoTurno: "CANCELADO" } });
  });

  afterAll(async () => {
    try {
      if (db) {
        await db.eventoTurno.deleteMany({ where: { turnoId: { startsWith: prefijo } } });
        await db.turno.deleteMany({ where: { idTurno: { startsWith: prefijo } } });
        await db.profesor.deleteMany({ where: { idProfesor: { startsWith: prefijo } } });
        await db.usuario.deleteMany({ where: { idUsuario: { startsWith: prefijo } } });
        await db.materia.deleteMany({ where: { idMateria: { startsWith: prefijo } } });
      }
    } finally {
      await db?.$disconnect();
    }
  });

  const gerente = { id: "gerente", rol: "GERENTE" as const };
  const ids = (resultado: Awaited<ReturnType<typeof listarTurnos>>) => resultado.items.map((turno) => turno.id);

  it("Gerente filtra por profesor: todos sus turnos, cancelados incluidos, en orden de fecha y hora", async () => {
    const resultado = await listarTurnos(1, 20, gerente, { profesor_id: id("p1") });
    expect(ids(resultado)).toEqual([id("t1"), id("t2"), id("t3")]);
    expect(resultado.items.map((turno) => turno.estado)).toEqual(["PENDIENTE", "CANCELADO", "PENDIENTE"]);
    expect(resultado.paginacion.total).toBe(3);
  });

  it("se combina con q y pagina sobre el resultado filtrado", async () => {
    const pagina2 = await listarTurnos(2, 2, gerente, { profesor_id: id("p1"), q: id("m") });
    expect(ids(pagina2)).toEqual([id("t3")]);
    expect(pagina2.paginacion).toEqual({ total: 3, pagina_actual: 2, total_paginas: 2, por_pagina: 2 });
  });

  it("profesor inactivo → PROFESOR_NO_ENCONTRADO", async () => {
    await expect(listarTurnos(1, 20, gerente, { profesor_id: id("p3") })).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
  });

  it("el Profesor ve solo los suyos; uno ajeno o una cuenta sin ficha → SIN_PERMISO", async () => {
    const profesor = { id: id("u"), rol: "PROFESOR" as const };
    const propios = await listarTurnos(1, 20, profesor, { q: id("m") });
    expect(ids(propios)).toEqual([id("t1"), id("t2"), id("t3")]);
    await expect(listarTurnos(1, 20, profesor, { profesor_id: id("p2") })).rejects.toMatchObject({ code: "SIN_PERMISO" });
    await expect(listarTurnos(1, 20, { id: id("u-sin-ficha"), rol: "PROFESOR" })).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });
});
