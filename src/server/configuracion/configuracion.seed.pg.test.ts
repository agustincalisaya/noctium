import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";

// El seed completo contiene cientos de fixtures ajenas a N. Se ejecuta de forma optativa.
describe.skipIf(!basePgHabilitada || process.env.HU_N_SEED_COMPLETO !== "1")("HU-N-01: seed repetido en PostgreSQL descartable", () => {
  let db: PrismaClient;
  beforeAll(() => { db = clientePg(); });
  afterAll(async () => { if (db) await db.$disconnect(); });

  it("carga 24/24/75 y no pisa un cambio al ejecutarse de nuevo", async () => {
    const sembrar = () => execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
      env: { ...process.env, SEED_FECHA_HOY: "2026-10-11" }, encoding: "utf8", timeout: 1_800_000,
    });
    sembrar();
    const claves = ["plazo_pago_horas", "cancelacion_anticipacion_horas", "umbral_presentismo"];
    const leer = async () => Object.fromEntries((await db.parametroSistema.findMany({ where: { clave: { in: claves } } })).map(({ clave, valor }) => [clave, valor]));
    expect(await leer()).toEqual({ plazo_pago_horas: "24", cancelacion_anticipacion_horas: "24", umbral_presentismo: "75" });
    await db.parametroSistema.update({ where: { clave: "plazo_pago_horas" }, data: { valor: "36" } });
    sembrar();
    expect(await leer()).toEqual({ plazo_pago_horas: "36", cancelacion_anticipacion_horas: "24", umbral_presentismo: "75" });
  }, 3_700_000);
});
