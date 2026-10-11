import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";

/** Regresión del seed completo: una reserva vencida no debe vaciar la asistencia histórica. */
describe.skipIf(!basePgHabilitada)("seed oficial con asistencia histórica", () => {
  let db: PrismaClient;
  beforeAll(() => { db = clientePg(); });
  afterAll(async () => { await db?.$disconnect(); });

  const sembrar = () => execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
    env: { ...process.env, SEED_FECHA_HOY: "2026-10-10" }, timeout: 120_000, encoding: "utf8",
  });
  const registros = () => db.claseDictada.findMany({
    orderBy: { idClaseDictada: "asc" }, include: { alumnos: { orderBy: { alumnoId: "asc" } } },
  });
  const conteos = async () => ({
    usuarios: await db.usuario.count(), inscripciones: await db.turnoAlumno.count(),
    indicaciones: await db.indicacion.count(), pagos: await db.pago.count(),
    correcciones: await db.correccionAsistencia.count(), observaciones: await db.observacionClase.count(),
  });

  it("carga todos los fixtures, conserva alumnos y estados y se puede repetir sin duplicar hechos", async () => {
    expect(sembrar()).toContain("Fixture HU-A-06");
    const clases = await registros();
    const e09 = clases.find((c) => c.fechaClaseDictada.toISOString().startsWith("2026-01-06"));
    expect(e09?.alumnos.map((a) => a.estadoAsistencia).sort()).toEqual(["AUSENTE", "PRESENTE", "PRESENTE"]);
    expect(clases.find((c) => c.fechaClaseDictada.toISOString().startsWith("2026-01-07"))?.alumnos).toHaveLength(3);
    const indicacion = await db.indicacion.findFirstOrThrow({ where: { claseDictadaId: e09!.idClaseDictada } });
    expect(e09?.alumnos.some((a) => a.alumnoId === indicacion.alumnoId)).toBe(true);
    for (const dia of ["2026-09-21", "2026-09-22", "2026-09-23"]) {
      expect(clases.find((c) => c.fechaClaseDictada.toISOString().startsWith(dia))?.alumnos).toHaveLength(1);
    }
    expect(await db.turnoAlumno.count({ where: { vigencia: "RESERVA_VENCIDA" } })).toBeGreaterThan(0);
    expect(await db.usuario.findUnique({ where: { emailUsuario: "gerente@noctium.local" } })).toMatchObject({ rolUsuario: "GERENTE", activoUsuario: true });
    const antes = await conteos();
    sembrar();
    expect(await registros()).toEqual(clases);
    expect(await conteos()).toEqual(antes);
  }, 240_000);
});
