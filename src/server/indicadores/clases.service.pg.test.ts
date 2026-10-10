import type { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { obtenerClasesPorMateria, obtenerClasesPorProfesor } from "@/server/indicadores/clases.service";
import { prisma } from "@/lib/prisma";

// Migraciones del runner y hechos por servicios de los fixtures; SQL solo de contraste read-only.
describe.skipIf(!basePgHabilitada)("HU-H-03 PostgreSQL real", () => {
  const rango = { desde: "2026-05", hasta: "2026-10" };
  let db: PrismaClient;
  beforeAll(() => { db = clientePg(); execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=512" }, stdio: "pipe" }); }, 120_000);
  afterAll(async () => { await db?.$disconnect(); await prisma.$disconnect(); });
  it("conteo materia coincide con SQL por fecha de clase y conserva todos los activos cero", async () => {
    const datos = await obtenerClasesPorMateria(rango);
    const filas = await db.$queryRaw<{ id: string; clases: number }[]>`SELECT "materiaId" AS id, count(*)::int AS clases FROM turnos WHERE "fechaTurno" >= DATE '2026-05-01' AND "fechaTurno" < DATE '2026-11-01' AND "estadoTurno" IN ('DISPONIBLE','COMPLETO','CANCELADO') GROUP BY "materiaId"`;
    for (const fila of filas) expect(datos.items.find(m => m.materia_id === fila.id)?.clases).toBe(fila.clases);
    expect(datos.total).toBe(filas.reduce((s, f) => s + f.clases, 0));
    const activos = await db.materia.count({ where: { activaMateria: true } });
    expect(datos.items.filter(m => m.activa)).toHaveLength(activos);
  });
  it("horas excluyen CANCELADO y PENDIENTE; cantidades incluyen canceladas", async () => {
    const datos = await obtenerClasesPorProfesor(rango);
    const filas = await db.$queryRaw<{ id: string; clases: number; minutos: number }[]>`SELECT "profesorId" AS id, count(*)::int AS clases, COALESCE(sum(CASE WHEN "estadoTurno" IN ('DISPONIBLE','COMPLETO') THEN "duracionMinutosTurno" ELSE 0 END),0)::int AS minutos FROM turnos WHERE "fechaTurno" >= DATE '2026-05-01' AND "fechaTurno" < DATE '2026-11-01' AND "estadoTurno" IN ('DISPONIBLE','COMPLETO','CANCELADO') AND "profesorId" IS NOT NULL GROUP BY "profesorId"`;
    for (const fila of filas) expect(datos.items.find(p => p.profesor_id === fila.id)).toMatchObject({ clases: fila.clases, horas: Math.round(fila.minutos * 100 / 60) / 100 });
    expect(datos.total.clases).toBe(filas.reduce((s, f) => s + f.clases, 0));
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
