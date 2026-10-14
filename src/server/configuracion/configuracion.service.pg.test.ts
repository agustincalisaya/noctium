import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { CATALOGO, CLAVES_CONFIGURABLES } from "@/server/configuracion/parametros-configurables";
import { obtenerConfiguracion, guardarConfiguracion, listarHistorialConfiguracion } from "@/server/configuracion/configuracion.service";
import { usuarioRegistroOperaciones } from "@/server/configuracion/configuracion.publico";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

const base = { plazoPagoHoras: 24, cancelacionAnticipacionHoras: 24, umbralPresentismo: 75 };

describe.skipIf(!basePgHabilitada)("HU-N-01 en PostgreSQL descartable", () => {
  let db: PrismaClient;
  let actor: string;

  beforeAll(async () => {
    db = clientePg();
    actor = (await crearUsuarioDePrueba(db, { rol: "GERENTE" })).idUsuario;
  });
  beforeEach(async () => {
    for (const clave of CLAVES_CONFIGURABLES) {
      await db.parametroSistema.update({ where: { clave }, data: { valor: String(CATALOGO[clave].porDefecto) } });
    }
  });
  afterAll(async () => { if (db) await db.$disconnect(); });

  it("la migración trae tres filas y los defectos contractuales", async () => {
    expect((await obtenerConfiguracion(db)).parametros).toEqual(CLAVES_CONFIGURABLES.map((clave) => ({ clave, ...CATALOGO[clave], valor: CATALOGO[clave].porDefecto })));
  });

  it("las consultas SQL de comprobación son de solo lectura y ven las tres filas", async () => {
    const filas = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return tx.$queryRawUnsafe<{ clave: string; valor: string }[]>(`SELECT "clave", "valor" FROM parametros_sistema
        WHERE "clave" IN ('plazo_pago_horas', 'cancelacion_anticipacion_horas', 'umbral_presentismo') ORDER BY "clave"`);
    });
    expect(filas).toHaveLength(3);
    expect(Object.fromEntries(filas.map((fila) => [fila.clave, fila.valor]))).toEqual({
      cancelacion_anticipacion_horas: "24", plazo_pago_horas: "24", umbral_presentismo: "75",
    });
  });

  it("lectura estricta: falta o valor inválido no se ocultan con un defecto", async () => {
    await db.parametroSistema.update({ where: { clave: "umbral_presentismo" }, data: { valor: "75.5" } });
    await expect(obtenerConfiguracion(db)).rejects.toThrow("Configuración persistida inválida");
  });

  it("no-op no escribe ni registra historial; cambio parcial deja intactas las otras claves", async () => {
    const antes = await db.historialParametro.count();
    expect(await guardarConfiguracion({ valores: base, esperados: base }, { usuarioId: actor }, { db })).toEqual({ cambios: [] });
    expect(await db.historialParametro.count()).toBe(antes);
    expect(await guardarConfiguracion({ valores: { ...base, plazoPagoHoras: 48 }, esperados: base }, { usuarioId: actor }, { db })).toEqual({ cambios: ["plazo_pago_horas"] });
    const filas = await db.parametroSistema.findMany({ where: { clave: { in: CLAVES_CONFIGURABLES } } });
    expect(Object.fromEntries(filas.map((fila) => [fila.clave, fila.valor]))).toEqual({ plazo_pago_horas: "48", cancelacion_anticipacion_horas: "24", umbral_presentismo: "75" });
    const historial = await db.historialParametro.findFirstOrThrow({ where: { usuarioId: actor, clave: "plazo_pago_horas", valorNuevo: "48" }, orderBy: { fecha: "desc" } });
    expect(historial).toMatchObject({ valorAnterior: "24", valorNuevo: "48", usuarioId: actor });
    expect(historial.fecha).toBeInstanceOf(Date);
    expect(await usuarioRegistroOperaciones(actor, db)).toBe(true);
  });

  it("conflicto en el segundo campo revierte el primero y no encola historial", async () => {
    const antes = await db.historialParametro.count();
    await db.parametroSistema.update({ where: { clave: "plazo_pago_horas" }, data: { valor: "48" } });
    await expect(guardarConfiguracion({ valores: { plazoPagoHoras: 36, cancelacionAnticipacionHoras: 36, umbralPresentismo: 75 }, esperados: base }, { usuarioId: actor }, { db }))
      .rejects.toMatchObject({ code: "CONFLICTO_EDICION_CONCURRENTE" } satisfies Partial<ErrorDeDominio>);
    expect((await db.parametroSistema.findUniqueOrThrow({ where: { clave: "cancelacion_anticipacion_horas" } })).valor).toBe("24");
    expect(await db.historialParametro.count()).toBe(antes);
  });

  it("dos editores con campos disjuntos no se pisan", async () => {
    const segundo = (await crearUsuarioDePrueba(db, { rol: "GERENTE" })).idUsuario;
    await guardarConfiguracion({ valores: { ...base, plazoPagoHoras: 48 }, esperados: base }, { usuarioId: actor }, { db });
    await guardarConfiguracion({ valores: { ...base, umbralPresentismo: 80 }, esperados: base }, { usuarioId: segundo }, { db });
    expect((await obtenerConfiguracion(db)).parametros.map((p) => p.valor)).toEqual([48, 24, 80]);
  });

  it("la fachada pública informa actividad antes y después del primer cambio", async () => {
    const nuevo = (await crearUsuarioDePrueba(db, { rol: "GERENTE" })).idUsuario;
    expect(await usuarioRegistroOperaciones(nuevo, db)).toBe(false);
    await guardarConfiguracion({ valores: { ...base, umbralPresentismo: 80 }, esperados: base }, { usuarioId: nuevo }, { db });
    expect(await usuarioRegistroOperaciones(nuevo, db)).toBe(true);
  });

  it("historial filtra, pagina, ordena y usa el id si la ficha no existe", async () => {
    const datos = Array.from({ length: 11 }, (_, n) => ({
      idHistorialParametro: `n-test-${n.toString().padStart(2, "0")}`,
      clave: "umbral_presentismo", valorAnterior: "75", valorNuevo: "80", usuarioId: actor,
      fecha: new Date("2030-10-14T12:00:00.000Z"),
    }));
    await db.historialParametro.createMany({ data: datos });
    const pagina1 = await listarHistorialConfiguracion({ pagina: 1 }, db);
    expect(pagina1.por_pagina).toBe(10);
    expect(pagina1.items).toHaveLength(10);
    expect(pagina1.items[0].id).toBe("n-test-10");
    expect(pagina1.items[0].usuario.id).toBe(actor);
    expect((await listarHistorialConfiguracion({ pagina: 999 }, db)).items).toEqual([]);
    expect((await listarHistorialConfiguracion({ pagina: 999 }, db)).total).toBeGreaterThanOrEqual(11);
  });
});
