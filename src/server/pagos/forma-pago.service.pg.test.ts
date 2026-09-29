import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { crearFormaPago, listarFormasPago } from "./forma-pago.service";

// Misma guarda que turno.publico.pg.test.ts: nunca escribir en la base habitual.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const prefijo = `pgsfp${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const usuarioId = `${prefijo}-usuario`;

const filasDe = (nombreNormalizado: string) =>
  db!.formaPago.findMany({ where: { nombreNormalizadaFormaPago: nombreNormalizado } });

describe.skipIf(!habilitada)("forma-pago.service: PostgreSQL real aislado", () => {
  afterAll(async () => {
    try {
      await db?.formaPago.deleteMany({ where: { nombreNormalizadaFormaPago: { startsWith: prefijo } } });
    } finally {
      await db?.$disconnect();
    }
  });

  it("el alta guarda la fila activa con la auditoría propia (AC3)", async () => {
    const antes = Date.now();
    const creada = await crearFormaPago({ nombre: `${prefijo} Débito` }, usuarioId);

    const fila = (await filasDe(`${prefijo} debito`))[0]!;
    expect(fila.idFormaPago).toBe(creada.idFormaPago);
    expect(fila.nombreFormaPago).toBe(`${prefijo} Débito`);
    expect(fila.activaFormaPago).toBe(true);
    expect(fila.creadoPorUsuarioId).toBe(usuarioId);
    expect(fila.createdAtFormaPago.getTime()).toBeGreaterThanOrEqual(antes - 5000);
  });

  it("el índice único rechaza un nombre normalizado repetido con P2002", async () => {
    const nombre = `${prefijo} Indice`;
    await db!.formaPago.create({
      data: { nombreFormaPago: nombre, nombreNormalizadaFormaPago: nombre.toLowerCase() },
    });

    const error = await db!.formaPago
      .create({
        data: { nombreFormaPago: `${nombre} otra grafía`, nombreNormalizadaFormaPago: nombre.toLowerCase() },
      })
      .catch((causa: unknown) => causa);

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(error).toMatchObject({ code: "P2002" });
  });

  it("un duplicado activo se rechaza con NOMBRE_DUPLICADO ignorando acentos y mayúsculas", async () => {
    await crearFormaPago({ nombre: `${prefijo} Crédito` }, usuarioId);

    await expect(crearFormaPago({ nombre: `${prefijo.toUpperCase()} CREDITO` }, usuarioId)).rejects.toMatchObject({
      code: "NOMBRE_DUPLICADO",
    });
    expect(await filasDe(`${prefijo} credito`)).toHaveLength(1);
  });

  it("un duplicado inactivo también se rechaza", async () => {
    await db!.formaPago.create({
      data: {
        nombreFormaPago: `${prefijo} Cheque`,
        nombreNormalizadaFormaPago: `${prefijo} cheque`,
        activaFormaPago: false,
      },
    });

    await expect(crearFormaPago({ nombre: `${prefijo} Cheque` }, usuarioId)).rejects.toMatchObject({
      code: "NOMBRE_DUPLICADO",
    });
    expect(await filasDe(`${prefijo} cheque`)).toHaveLength(1);
  });

  it("carrera: dos altas simultáneas del mismo nombre dejan un éxito, un NOMBRE_DUPLICADO y una sola fila (AC2)", async () => {
    const nombre = `${prefijo} Carrera`;

    const resultados = await Promise.allSettled([
      crearFormaPago({ nombre }, usuarioId),
      crearFormaPago({ nombre }, usuarioId),
    ]);

    const exitos = resultados.filter((resultado) => resultado.status === "fulfilled");
    const rechazos = resultados.filter((resultado): resultado is PromiseRejectedResult => resultado.status === "rejected");
    expect(exitos).toHaveLength(1);
    expect(rechazos).toHaveLength(1);
    expect(rechazos[0]!.reason).toMatchObject({ code: "NOMBRE_DUPLICADO" });
    expect(await filasDe(`${prefijo} carrera`)).toHaveLength(1);
  });

  it("el listado incluye activas e inactivas ordenadas por nombre normalizado", async () => {
    // Recorre todas las páginas: la base de test puede tener otras filas.
    const items = [];
    for (let pagina = 1, total = 1; pagina <= total; pagina++) {
      const listado = await listarFormasPago({ pagina, por_pagina: 20 });
      items.push(...listado.items);
      total = listado.paginacion.total_paginas;
    }
    const propias = items.filter((forma) => forma.nombre.startsWith(prefijo));

    expect(propias.some((forma) => forma.is_active)).toBe(true);
    expect(propias.some((forma) => !forma.is_active)).toBe(true);
    const normalizados = propias.map((forma) => forma.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
    expect(normalizados).toEqual([...normalizados].sort());
  });
});
