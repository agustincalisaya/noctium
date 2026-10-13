import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { listarOpcionesFiltroMateria, listarTurnos } from "./turno.service";
import { conReloj } from "@/server/shared/reloj";

// Misma guarda que turno.publico.pg.test.ts: nunca escribir en la base habitual.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const prefijo = `pgc08${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const id = (sufijo: string) => `${prefijo}-${sufijo}`;
const dia = (valor: string) => new Date(`${valor}T00:00:00.000Z`);
// Lejos en el futuro: el período «proximas» (HU-C-27) los incluye siempre.
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
    const resultado = await listarTurnos(1, 20, gerente, { profesor_id: id("p1"), periodo: "proximas" });
    expect(ids(resultado)).toEqual([id("t1"), id("t2"), id("t3")]);
    expect(resultado.items.map((turno) => turno.estado)).toEqual(["PENDIENTE", "CANCELADO", "PENDIENTE"]);
    expect(resultado.paginacion.total).toBe(3);
  });

  it("se combina con q y pagina sobre el resultado filtrado", async () => {
    const pagina2 = await listarTurnos(2, 2, gerente, { profesor_id: id("p1"), q: id("m"), periodo: "proximas" });
    expect(ids(pagina2)).toEqual([id("t3")]);
    expect(pagina2.paginacion).toEqual({ total: 3, pagina_actual: 2, total_paginas: 2, por_pagina: 2 });
  });

  it("profesor inactivo → PROFESOR_NO_ENCONTRADO", async () => {
    await expect(listarTurnos(1, 20, gerente, { profesor_id: id("p3") })).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
  });

  it("el Profesor ve solo los suyos; uno ajeno o una cuenta sin ficha → SIN_PERMISO", async () => {
    const profesor = { id: id("u"), rol: "PROFESOR" as const };
    const propios = await listarTurnos(1, 20, profesor, { q: id("m"), periodo: "proximas" });
    expect(ids(propios)).toEqual([id("t1"), id("t2"), id("t3")]);
    await expect(listarTurnos(1, 20, profesor, { profesor_id: id("p2") })).rejects.toMatchObject({ code: "SIN_PERMISO" });
    await expect(listarTurnos(1, 20, { id: id("u-sin-ficha"), rol: "PROFESOR" })).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });
});

// HU-C-27: período, rango, materia y opciones del filtro sobre PostgreSQL real.
// Reloj fijo: «hoy» es 2030-05-15 en el centro. Datos propios de este bloque
// (profesores q1/q2 y materias c27-*), así no depende de otras clases.
describe.skipIf(!habilitada)("HU-C-27 listarTurnos por período, rango y materia: PostgreSQL real aislado", () => {
  const p27 = `pgc27${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
  const id27 = (sufijo: string) => `${p27}-${sufijo}`;
  const MOMENTO = new Date("2030-05-15T15:00:00.000Z");
  const enReloj = <T>(fn: () => Promise<T>) => conReloj(MOMENTO, fn);
  const gerente = { id: "gerente", rol: "GERENTE" as const };
  const mesa = { id: "mesa", rol: "MESA_ENTRADA" as const };
  const profesorQ1 = { id: id27("u"), rol: "PROFESOR" as const };
  const ids = (resultado: Awaited<ReturnType<typeof listarTurnos>>) => resultado.items.map((turno) => turno.id);
  const deMaterias = (opciones: { id: string }[]) => opciones.map((opcion) => opcion.id).filter((materia) => materia.startsWith(p27));

  beforeAll(async () => {
    for (const sufijo of ["m-activa-con-clases", "m-asociada-sin-clases", "m-inactiva-con-clases"]) {
      await db!.materia.create({ data: { idMateria: id27(sufijo), nombreMateria: id27(sufijo), nombreNormalizadaMateria: id27(sufijo) } });
    }
    await db!.usuario.create({ data: { idUsuario: id27("u"), emailUsuario: `${p27}@test.local`, passwordHashUsuario: "x", rolUsuario: "PROFESOR" } });
    for (const [sufijo, usuarioId] of [["q1", id27("u")], ["q2", null]] as const) {
      await db!.profesor.create({
        data: {
          idProfesor: id27(sufijo), nombreProfesor: "Prueba", apellidoProfesor: id27(sufijo),
          nombreNormalizadoProfesor: "prueba", apellidoNormalizadoProfesor: id27(sufijo),
          dniProfesor: `${id27(sufijo)}-dni`, fechaNacimientoProfesor: dia("1990-01-01"), usuarioId,
        },
      });
    }
    // q1 tiene asociadas las tres materias, pero clases solo de dos; la «asociada sin clases» solo tiene una clase de q2.
    for (const materia of ["m-activa-con-clases", "m-asociada-sin-clases", "m-inactiva-con-clases"]) {
      await db!.profesorMateria.create({ data: { profesorId: id27("q1"), materiaId: id27(materia) } });
    }
    // PENDIENTE: sin reservas, así los horarios pueden coincidir entre clases.
    const clases = [
      ["anterior-1", "2030-05-13", "10:00", "q1", "m-activa-con-clases"],
      ["anterior-2", "2030-05-14", "09:00", "q1", "m-activa-con-clases"],
      ["anterior-3", "2030-05-14", "11:00", "q1", "m-inactiva-con-clases"],
      ["hoy-terminada", "2030-05-15", "08:00", "q1", "m-activa-con-clases"],
      ["hoy-tarde", "2030-05-15", "18:00", "q1", "m-activa-con-clases"],
      ["manana", "2030-05-16", "10:00", "q1", "m-activa-con-clases"],
      ["de-q2", "2030-05-16", "12:00", "q2", "m-asociada-sin-clases"],
    ] as const;
    for (const [sufijo, fecha, hora, profesor, materia] of clases) {
      await db!.turno.create({
        data: {
          idTurno: id27(sufijo), fechaTurno: dia(fecha), horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`),
          duracionMinutosTurno: 60, materiaId: id27(materia), profesorId: id27(profesor), estadoTurno: "PENDIENTE",
        },
      });
    }
    // Una materia dada de baja después de dictar clases.
    await db!.materia.update({ where: { idMateria: id27("m-inactiva-con-clases") }, data: { activaMateria: false } });
  });

  afterAll(async () => {
    if (!db) return;
    await db.turno.deleteMany({ where: { idTurno: { startsWith: p27 } } });
    await db.profesorMateria.deleteMany({ where: { profesorId: { startsWith: p27 } } });
    await db.profesor.deleteMany({ where: { idProfesor: { startsWith: p27 } } });
    await db.usuario.deleteMany({ where: { idUsuario: { startsWith: p27 } } });
    await db.materia.deleteMany({ where: { idMateria: { startsWith: p27 } } });
  });

  const delQ1 = (filtros: Parameters<typeof listarTurnos>[3]) => enReloj(() => listarTurnos(1, 20, gerente, { profesor_id: id27("q1"), ...filtros }));

  it("cada período corta por el día del centro; «Anteriores» va de la más reciente a la más antigua", async () => {
    expect(ids(await delQ1({ periodo: "anteriores" }))).toEqual([id27("anterior-3"), id27("anterior-2"), id27("anterior-1")]);
    expect(ids(await delQ1({ periodo: "hoy" }))).toEqual([id27("hoy-terminada"), id27("hoy-tarde")]);
    expect(ids(await delQ1({}))).toEqual([id27("hoy-terminada"), id27("hoy-tarde")]);
    expect(ids(await delQ1({ periodo: "proximas" }))).toEqual([id27("manana")]);
    expect(ids(await delQ1({ periodo: "todas" }))).toEqual(
      ["anterior-1", "anterior-2", "anterior-3", "hoy-terminada", "hoy-tarde", "manana"].map(id27),
    );
  });

  it("rango inclusive en ambos bordes, con una o dos fechas", async () => {
    expect(ids(await delQ1({ desde: "2030-05-14", hasta: "2030-05-15" }))).toEqual(
      ["anterior-2", "anterior-3", "hoy-terminada", "hoy-tarde"].map(id27),
    );
    expect(ids(await delQ1({ desde: "2030-05-16" }))).toEqual([id27("manana")]);
    expect(ids(await delQ1({ hasta: "2030-05-13" }))).toEqual([id27("anterior-1")]);
  });

  it("materia filtra y se combina con el período; es_dia_anterior marca solo los días anteriores", async () => {
    const resultado = await delQ1({ periodo: "todas", materia_id: id27("m-inactiva-con-clases") });
    expect(ids(resultado)).toEqual([id27("anterior-3")]);
    expect(resultado.items[0].es_dia_anterior).toBe(true);
    const hoy = await delQ1({ periodo: "hoy" });
    expect(hoy.items.every((turno) => turno.es_dia_anterior === false)).toBe(true);
  });

  it("el Profesor ve solo sus clases con cualquier período", async () => {
    const todas = await enReloj(() => listarTurnos(1, 20, profesorQ1, { periodo: "todas", q: p27 }));
    expect(ids(todas)).not.toContain(id27("de-q2"));
    expect(ids(todas)).toHaveLength(6);
  });

  it("opciones de materia del Profesor: solo las de sus clases (la asociada sin clases no; la inactiva con clases sí)", async () => {
    const opciones = await listarOpcionesFiltroMateria(profesorQ1);
    expect(deMaterias(opciones)).toEqual([id27("m-activa-con-clases"), id27("m-inactiva-con-clases")]);
    expect(opciones.find((opcion) => opcion.id === id27("m-inactiva-con-clases"))?.activa).toBe(false);
    expect(deMaterias(opciones)).not.toContain(id27("m-asociada-sin-clases"));
  });

  it("opciones de materia de Mesa de entrada: activas más inactivas con clases", async () => {
    const opciones = await listarOpcionesFiltroMateria(mesa);
    expect(deMaterias(opciones)).toEqual(["m-activa-con-clases", "m-asociada-sin-clases", "m-inactiva-con-clases"].map(id27));
  });
});
