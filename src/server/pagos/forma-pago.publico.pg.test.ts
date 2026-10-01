import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  existeFormaPago,
  listarFormasPagoActivas,
  obtenerFormaPago,
  verificarFormaPagoActiva,
} from "./forma-pago.publico";

// Misma guarda que turno.publico.pg.test.ts: nunca escribir en la base habitual.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const prefijo = `pgfp${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const id = (sufijo: string) => `${prefijo}-${sufijo}`;

// Los nombres empiezan con el prefijo para quedar juntos y en orden al ordenar.
const FORMAS = [
  { sufijo: "b", nombre: `${prefijo} Beta`, activa: true },
  { sufijo: "a", nombre: `${prefijo} Alfa`, activa: true },
  { sufijo: "i", nombre: `${prefijo} Inactiva`, activa: false },
] as const;

describe.skipIf(!habilitada)("forma-pago.publico: PostgreSQL real aislado", () => {
  beforeAll(async () => {
    // Fixtures propias (sin seed.ts): incluyen una forma inactiva.
    for (const forma of FORMAS) {
      await db!.formaPago.create({
        data: {
          idFormaPago: id(forma.sufijo),
          nombreFormaPago: forma.nombre,
          nombreNormalizadaFormaPago: forma.nombre.toLowerCase(),
          activaFormaPago: forma.activa,
        },
      });
    }
  });

  afterAll(async () => {
    try {
      await db?.formaPago.deleteMany({ where: { idFormaPago: { startsWith: prefijo } } });
    } finally {
      await db?.$disconnect();
    }
  });

  it("verificarFormaPagoActiva devuelve la activa y null para la inactiva o inexistente", async () => {
    await expect(verificarFormaPagoActiva(id("a"), db!)).resolves.toEqual({ id: id("a"), nombre: `${prefijo} Alfa` });
    await expect(verificarFormaPagoActiva(id("i"), db!)).resolves.toBeNull();
    await expect(verificarFormaPagoActiva(id("inexistente"), db!)).resolves.toBeNull();
  });

  it("existeFormaPago distingue inexistente de inactiva", async () => {
    await expect(existeFormaPago(id("i"), db!)).resolves.toBe(true);
    await expect(existeFormaPago(id("inexistente"), db!)).resolves.toBe(false);
  });

  it("obtenerFormaPago devuelve el nombre histórico de una inactiva", async () => {
    await expect(obtenerFormaPago(id("i"), db!)).resolves.toEqual({
      id: id("i"),
      nombre: `${prefijo} Inactiva`,
      is_active: false,
    });
    await expect(obtenerFormaPago(id("inexistente"), db!)).resolves.toBeNull();
  });

  it("listarFormasPagoActivas excluye las inactivas y ordena alfabéticamente", async () => {
    const propias = (await listarFormasPagoActivas()).filter((forma) => forma.id.startsWith(prefijo));

    expect(propias).toEqual([
      { id: id("a"), nombre: `${prefijo} Alfa` },
      { id: id("b"), nombre: `${prefijo} Beta` },
    ]);
  });
});
