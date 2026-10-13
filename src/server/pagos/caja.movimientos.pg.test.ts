import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearFichaMesaEntradaDePrueba } from "@/server/testing/fabricas";
import { abrirMiCaja, anularMiMovimiento, cerrarMiCaja, declararMiEfectivo, registrarMiMovimiento } from "@/server/pagos/caja.flujos";

// PostgreSQL real (`npm run test:pg -- src/server/pagos/caja.movimientos.pg.test.ts`):
// los flujos HTTP de HU-I-12-b (spec_modulo_I.md §2.10.3 y §2.10.4) sobre el
// servicio del PR 0. Equivale al nivel 3 (BD) de la task: verifica las filas de
// `movimientos_caja` y `anulaciones_movimiento` y que el movimiento original no cambie (Regla N.° 8).
describe.skipIf(!basePgHabilitada)("movimientos manuales de caja con PostgreSQL real", () => {
  let db: PrismaClient;
  const opciones = () => ({ db });

  async function conCajaAbierta(fondo = "5000") {
    const ficha = await crearFichaMesaEntradaDePrueba(db);
    const usuarioId = ficha.usuarioId!;
    const caja = await abrirMiCaja(usuarioId, fondo, opciones());
    return { usuarioId, cajaId: caja.id };
  }

  beforeAll(async () => { db = clientePg(); });
  afterAll(async () => { await db?.$disconnect(); });

  it("registrar: una fila en movimientos_caja con tipo, monto, concepto, usuario y fecha", async () => {
    const { usuarioId, cajaId } = await conCajaAbierta();
    const movimiento = await registrarMiMovimiento(usuarioId, { tipo: "INGRESO", monto: "1000.5", concepto: "Ingreso de cambio" }, opciones());
    expect(movimiento).toMatchObject({ tipo: "INGRESO", monto: "1000.50", concepto: "Ingreso de cambio", momento: expect.stringMatching(/-03:00$/) });
    const fila = await db.movimientoCaja.findUniqueOrThrow({ where: { idMovimientoCaja: movimiento.id } });
    expect(fila).toMatchObject({ cajaId, tipo: "INGRESO", concepto: "Ingreso de cambio", creadoPorUsuarioId: usuarioId });
    expect(fila.monto.toFixed(2)).toBe("1000.50");
    expect(fila.createdAtMovimientoCaja).toBeInstanceOf(Date);
  });

  it("egreso hasta el efectivo esperado se registra; uno que lo supera es EGRESO_SUPERA_EFECTIVO sin datos del esperado", async () => {
    const { usuarioId, cajaId } = await conCajaAbierta("1000");
    await registrarMiMovimiento(usuarioId, { tipo: "EGRESO", monto: "600", concepto: "Insumos" }, opciones());
    const error = await registrarMiMovimiento(usuarioId, { tipo: "EGRESO", monto: "400.01", concepto: "Más insumos" }, opciones()).catch((e) => e);
    expect(error).toMatchObject({ code: "EGRESO_SUPERA_EFECTIVO", status: 409 });
    expect(error.datos).toBeUndefined();
    expect(error.message).not.toMatch(/\d/);
    await registrarMiMovimiento(usuarioId, { tipo: "EGRESO", monto: "400", concepto: "Resto" }, opciones());
    expect(await db.movimientoCaja.count({ where: { cajaId } })).toBe(2);
  });

  it("sin caja abierta: registrar es CAJA_NO_ABIERTA", async () => {
    const ficha = await crearFichaMesaEntradaDePrueba(db);
    await expect(registrarMiMovimiento(ficha.usuarioId!, { tipo: "INGRESO", monto: "1", concepto: "x" }, opciones()))
      .rejects.toMatchObject({ code: "CAJA_NO_ABIERTA", status: 409 });
  });

  it("anular: una fila nueva en anulaciones_movimiento; el movimiento no cambia; la segunda es MOVIMIENTO_YA_ANULADO", async () => {
    const { usuarioId } = await conCajaAbierta();
    const { id } = await registrarMiMovimiento(usuarioId, { tipo: "EGRESO", monto: "200", concepto: "Café" }, opciones());
    const antes = await db.movimientoCaja.findUniqueOrThrow({ where: { idMovimientoCaja: id } });
    const anulacion = await anularMiMovimiento(usuarioId, id, "Se cargó dos veces", opciones());
    const fila = await db.anulacionMovimiento.findUniqueOrThrow({ where: { idAnulacionMovimiento: anulacion.id } });
    expect(fila).toMatchObject({ movimientoId: id, motivo: "Se cargó dos veces", actorTipo: "USUARIO", creadoPorUsuarioId: usuarioId });
    expect(fila.createdAtAnulacionMovimiento).toBeInstanceOf(Date);
    expect(await db.movimientoCaja.findUniqueOrThrow({ where: { idMovimientoCaja: id } })).toEqual(antes);
    await expect(anularMiMovimiento(usuarioId, id, "Otra vez", opciones())).rejects.toMatchObject({ code: "MOVIMIENTO_YA_ANULADO", status: 409 });
    expect(await db.anulacionMovimiento.count({ where: { movimientoId: id } })).toBe(1);
  });

  it("dos anulaciones simultáneas del mismo movimiento dejan una sola (Regla N.° 7)", async () => {
    const { usuarioId } = await conCajaAbierta();
    const { id } = await registrarMiMovimiento(usuarioId, { tipo: "INGRESO", monto: "10", concepto: "Cambio" }, opciones());
    const resultados = await Promise.allSettled([anularMiMovimiento(usuarioId, id, "a", opciones()), anularMiMovimiento(usuarioId, id, "b", opciones())]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "MOVIMIENTO_YA_ANULADO" });
    expect(await db.anulacionMovimiento.count({ where: { movimientoId: id } })).toBe(1);
  });

  it("anular un ingreso que dejaría el efectivo negativo: ANULACION_DEJA_EFECTIVO_NEGATIVO sin el esperado", async () => {
    const { usuarioId } = await conCajaAbierta("0");
    const ingreso = await registrarMiMovimiento(usuarioId, { tipo: "INGRESO", monto: "1000", concepto: "Cambio" }, opciones());
    await registrarMiMovimiento(usuarioId, { tipo: "EGRESO", monto: "800", concepto: "Insumos" }, opciones());
    const error = await anularMiMovimiento(usuarioId, ingreso.id, "Error", opciones()).catch((e) => e);
    expect(error).toMatchObject({ code: "ANULACION_DEJA_EFECTIVO_NEGATIVO", status: 409 });
    expect(error.datos).toBeUndefined();
    expect(await db.anulacionMovimiento.count({ where: { movimientoId: ingreso.id } })).toBe(0);
  });

  it("anular un movimiento de la caja de otro integrante o inexistente: MOVIMIENTO_NO_ENCONTRADO (404)", async () => {
    const otro = await conCajaAbierta();
    const { id } = await registrarMiMovimiento(otro.usuarioId, { tipo: "INGRESO", monto: "10", concepto: "Ajeno" }, opciones());
    const { usuarioId } = await conCajaAbierta();
    await expect(anularMiMovimiento(usuarioId, id, "x", opciones())).rejects.toMatchObject({ code: "MOVIMIENTO_NO_ENCONTRADO", status: 404 });
    await expect(anularMiMovimiento(usuarioId, "no-existe", "x", opciones())).rejects.toMatchObject({ code: "MOVIMIENTO_NO_ENCONTRADO", status: 404 });
    expect(await db.anulacionMovimiento.count({ where: { movimientoId: id } })).toBe(0);
  });

  it("caja cerrada: no se registra ni se anula; los movimientos entran en el resumen del cierre", async () => {
    const { usuarioId } = await conCajaAbierta("1000");
    const ingreso = await registrarMiMovimiento(usuarioId, { tipo: "INGRESO", monto: "500", concepto: "Cambio" }, opciones());
    const egreso = await registrarMiMovimiento(usuarioId, { tipo: "EGRESO", monto: "300", concepto: "Insumos" }, opciones());
    await anularMiMovimiento(usuarioId, egreso.id, "Error", opciones());
    const paso1 = await declararMiEfectivo(usuarioId, "1500", opciones());
    expect(paso1.resumen).toMatchObject({ ingresos_manuales: "500.00", egresos_manuales: "0.00", efectivo_esperado: "1500.00", tipo_diferencia: "CUADRA" });
    await cerrarMiCaja(usuarioId, { huella: paso1.huella }, opciones());
    await expect(registrarMiMovimiento(usuarioId, { tipo: "INGRESO", monto: "1", concepto: "x" }, opciones())).rejects.toMatchObject({ code: "CAJA_NO_ABIERTA" });
    await expect(anularMiMovimiento(usuarioId, ingreso.id, "x", opciones())).rejects.toMatchObject({ code: "CAJA_NO_ABIERTA" });
  });
});
