import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { obtenerClasesPorMateria, obtenerClasesPorProfesor } from "@/server/indicadores/clases.service";
import { prisma } from "@/lib/prisma";
import { crearAlumnoDePrueba, crearInscripcionDePrueba, crearMateriaDePrueba, crearProfesorDePrueba, crearTurnoDePrueba } from "@/server/testing/fabricas";
import { conReloj } from "@/server/shared/reloj";

// Migraciones del runner y fábricas propias: no depende del seed ni de reservas vencidas.
describe.skipIf(!basePgHabilitada)("HU-H-03 PostgreSQL real", () => {
  const rango = { desde: "2026-05", hasta: "2026-10" };
  let db: PrismaClient;
  let materiaId: string;
  let profesorId: string;
  let completaId: string;
  beforeAll(async () => {
    db = clientePg();
    const materia = await crearMateriaDePrueba(db);
    const profesor = await crearProfesorDePrueba(db);
    materiaId = materia.idMateria;
    profesorId = profesor.idProfesor;
    // Activos sin clases: el catálogo debe conservarlos con cero.
    await crearMateriaDePrueba(db);
    await crearProfesorDePrueba(db);
    const momento = new Date("2026-06-01T12:00:00.000Z");
    await conReloj(momento, async () => {
      await crearTurnoDePrueba(db, { materiaId, profesorId, enDias: 1, duracionMin: 60 });
      const alumno = await crearAlumnoDePrueba(db, { activo: false });
      // Fábricas PR-0: clase completa y su inscripción sin plazo se crean juntas.
      await db.$transaction(async (tx) => {
        const completa = await crearTurnoDePrueba(tx, { materiaId, profesorId, enDias: 2, duracionMin: 120, cupo: 1, estado: "COMPLETO" });
        completaId = completa.idTurno;
        await crearInscripcionDePrueba(tx, { turnoId: completaId, alumnoId: alumno.idAlumno });
      });
      await crearTurnoDePrueba(db, { materiaId, profesorId, enDias: 3, duracionMin: 180, estado: "CANCELADO" });
      await crearTurnoDePrueba(db, { materiaId, profesorId, enDias: 4, duracionMin: 180, estado: "PENDIENTE" });
    });
  });
  afterAll(async () => { await db?.$disconnect(); await prisma.$disconnect(); });
  it("conteo materia coincide con SQL por fecha de clase y conserva todos los activos cero", async () => {
    const datos = await obtenerClasesPorMateria(rango);
    const filas = await db.$queryRaw<{ id: string; clases: number }[]>`SELECT "materiaId" AS id, count(*)::int AS clases FROM turnos WHERE "fechaTurno" >= DATE '2026-05-01' AND "fechaTurno" < DATE '2026-11-01' AND "estadoTurno" IN ('DISPONIBLE','COMPLETO','CANCELADO') GROUP BY "materiaId"`;
    for (const fila of filas) expect(datos.items.find(m => m.materia_id === fila.id)?.clases).toBe(fila.clases);
    expect(datos.total).toBe(filas.reduce((s, f) => s + f.clases, 0));
    expect(datos.items.find(m => m.materia_id === materiaId)?.clases).toBe(3);
    const activos = await db.materia.count({ where: { activaMateria: true } });
    expect(datos.items.filter(m => m.activa)).toHaveLength(activos);
  });
  it("horas excluyen CANCELADO y PENDIENTE; cantidades incluyen canceladas", async () => {
    const datos = await obtenerClasesPorProfesor(rango);
    const filas = await db.$queryRaw<{ id: string; clases: number; minutos: number }[]>`SELECT "profesorId" AS id, count(*)::int AS clases, COALESCE(sum(CASE WHEN "estadoTurno" IN ('DISPONIBLE','COMPLETO') THEN "duracionMinutosTurno" ELSE 0 END),0)::int AS minutos FROM turnos WHERE "fechaTurno" >= DATE '2026-05-01' AND "fechaTurno" < DATE '2026-11-01' AND "estadoTurno" IN ('DISPONIBLE','COMPLETO','CANCELADO') AND "profesorId" IS NOT NULL GROUP BY "profesorId"`;
    for (const fila of filas) expect(datos.items.find(p => p.profesor_id === fila.id)).toMatchObject({ clases: fila.clases, horas: Math.round(fila.minutos * 100 / 60) / 100 });
    expect(datos.total.clases).toBe(filas.reduce((s, f) => s + f.clases, 0));
    expect(datos.items.find(p => p.profesor_id === profesorId)).toMatchObject({ clases: 3, horas: 3 });
    expect(await db.turno.findUniqueOrThrow({ where: { idTurno: completaId } })).toMatchObject({ estadoTurno: "COMPLETO", cupoMaximoTurno: 1 });
    expect(datos.total.horas).toBe(datos.items.reduce((s, f) => s + f.horas, 0));
    expect(await db.turno.count({ where: { estadoTurno: "CANCELADO" } })).toBeGreaterThan(0);
    expect(await db.turno.count({ where: { estadoTurno: "PENDIENTE" } })).toBeGreaterThan(0);
    expect(await db.turno.count({ where: { estadoTurno: "COMPLETO" } })).toBeGreaterThan(0);
  });
  it("sin clases no omite activos y muestra total cero en ambos contratos", async () => {
    const vacio = { desde: "2038-01", hasta: "2038-06" };
    const materias = await obtenerClasesPorMateria(vacio), profesores = await obtenerClasesPorProfesor(vacio);
    expect(materias.total).toBe(0); expect(profesores.total).toEqual({ clases: 0, horas: 0 });
    expect(materias.items.length).toBeGreaterThan(0); expect(profesores.items.length).toBeGreaterThan(0);
    expect(materias.items.every(m => m.activa && m.clases === 0)).toBe(true); expect(profesores.items.every(p => p.activo && p.clases === 0 && p.horas === 0)).toBe(true);
  });
});
