import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearFichaMesaEntradaDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import {
  abrirCaja,
  anularMovimiento,
  calcularResumen,
  cerrarCaja,
  declararEfectivo,
  registrarMovimiento,
} from "@/server/pagos/caja.service";
import { registrarOperacion } from "@/server/pagos/operacion.service";
import { usuarioRegistroOperaciones } from "@/server/pagos/pago.lecturas.publico";
import { crearInscripcion } from "@/server/turnos/inscripcion.publico";

// PostgreSQL real (`npm run test:pg -- <ruta>`): caja de HU-I-12 (PR-0.md §2.5 y §2.13).
describe.skipIf(!basePgHabilitada)("caja con PostgreSQL real", () => {
  let db: PrismaClient;
  const enTx = <T>(fn: (tx: Tx) => Promise<T>) => transaccion(fn, { db });

  async function integranteConCaja(fondoInicial = "1000.00") {
    const ficha = await crearFichaMesaEntradaDePrueba(db);
    const usuarioId = ficha.usuarioId!;
    const caja = await enTx((tx) => abrirCaja(tx, { usuarioId, fondoInicial }));
    return { usuarioId, cajaId: caja.id };
  }

  /** Inscribe a un alumno nuevo en una clase nueva y cobra 12000 con la forma pedida. */
  async function cobro(usuarioId: string, formaPagoId: string, hora = "10:00") {
    const alumno = await crearAlumnoDePrueba(db);
    const turno = await crearTurnoDePrueba(db, { hora });
    const insc = await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(usuarioId) }));
    return enTx((tx) => registrarOperacion(tx, { alumnoId: alumno.idAlumno, usuarioId, formaPagoId, modo: "completo", items: [{ inscripcionId: insc.inscripcion.id, monto: "12000" }] }));
  }

  beforeAll(async () => { db = clientePg(); });
  afterAll(async () => { await db?.$disconnect(); });

  it("resumen: fondo + cobros en efectivo + ingresos − egresos; las otras formas se informan pero no suman", async () => {
    const { usuarioId, cajaId } = await integranteConCaja();
    await cobro(usuarioId, "formapago-efectivo", "08:00");
    await cobro(usuarioId, "formapago-transferencia", "11:00");
    await enTx((tx) => registrarMovimiento(tx, { cajaId, usuarioId, tipo: "INGRESO", monto: "500", concepto: "Cambio" }));
    await enTx((tx) => registrarMovimiento(tx, { cajaId, usuarioId, tipo: "EGRESO", monto: "200.50", concepto: "Librería" }));
    const { resumen } = await calcularResumen(db, cajaId);
    expect(resumen).toMatchObject({
      fondo_inicial: "1000.00", ingresos_manuales: "500.00", egresos_manuales: "200.50", efectivo_esperado: "13299.50",
      efectivo_declarado: null, diferencia: null, tipo_diferencia: null,
    });
    expect(resumen.cobros_por_forma).toEqual([
      { forma_pago: expect.objectContaining({ id: "formapago-efectivo", es_efectivo: true }), cantidad: 1, total: "12000.00" },
      { forma_pago: expect.objectContaining({ id: "formapago-transferencia", es_efectivo: false }), cantidad: 1, total: "12000.00" },
    ]);
    expect(await usuarioRegistroOperaciones(db, usuarioId)).toBe(true);
    expect(await usuarioRegistroOperaciones(db, (await crearUsuarioDePrueba(db)).idUsuario)).toBe(false);
  });

  it("movimientos: egreso mayor que el efectivo, anulación que deja negativo, ya anulado y movimiento ajeno", async () => {
    const { usuarioId, cajaId } = await integranteConCaja("100.00");
    await expect(enTx((tx) => registrarMovimiento(tx, { cajaId, usuarioId, tipo: "EGRESO", monto: "150", concepto: "x" })))
      .rejects.toMatchObject({ code: "EGRESO_SUPERA_EFECTIVO" });
    const ingreso = await enTx((tx) => registrarMovimiento(tx, { cajaId, usuarioId, tipo: "INGRESO", monto: "100", concepto: "Cambio" }));
    await enTx((tx) => registrarMovimiento(tx, { cajaId, usuarioId, tipo: "EGRESO", monto: "150", concepto: "Compra" }));
    await expect(enTx((tx) => anularMovimiento(tx, { movimientoId: ingreso.id, usuarioId, motivo: "Error" })))
      .rejects.toMatchObject({ code: "ANULACION_DEJA_EFECTIVO_NEGATIVO" });
    const otro = await integranteConCaja();
    await expect(enTx((tx) => anularMovimiento(tx, { movimientoId: ingreso.id, usuarioId: otro.usuarioId, motivo: "x" })))
      .rejects.toMatchObject({ code: "MOVIMIENTO_NO_ENCONTRADO" });
    const egreso2 = await enTx((tx) => registrarMovimiento(tx, { cajaId, usuarioId, tipo: "EGRESO", monto: "10", concepto: "Otro" }));
    await enTx((tx) => anularMovimiento(tx, { movimientoId: egreso2.id, usuarioId, motivo: "Duplicado" }));
    await expect(enTx((tx) => anularMovimiento(tx, { movimientoId: egreso2.id, usuarioId, motivo: "Otra vez" })))
      .rejects.toMatchObject({ code: "MOVIMIENTO_YA_ANULADO" });
    await expect(enTx((tx) => registrarMovimiento(tx, { cajaId, usuarioId: otro.usuarioId, tipo: "INGRESO", monto: "1", concepto: "x" })))
      .rejects.toMatchObject({ code: "FUERA_DE_ALCANCE" });
  });

  it("el efectivo se declara una sola vez y el cierre sin declarar falla", async () => {
    const { usuarioId, cajaId } = await integranteConCaja();
    const { huella } = await calcularResumen(db, cajaId);
    await expect(enTx((tx) => cerrarCaja(tx, { cajaId, usuarioId, huella }))).rejects.toMatchObject({ code: "EFECTIVO_NO_DECLARADO" });
    await enTx((tx) => declararEfectivo(tx, { cajaId, usuarioId, efectivoDeclarado: "1000" }));
    await expect(enTx((tx) => declararEfectivo(tx, { cajaId, usuarioId, efectivoDeclarado: "900" }))).rejects.toMatchObject({ code: "EFECTIVO_YA_DECLARADO" });
    expect((await db.caja.findUniqueOrThrow({ where: { idCaja: cajaId } })).efectivoDeclarado?.toFixed(2)).toBe("1000.00");
  });

  it("(a) si entró un cobro después del resumen (aunque no sea en efectivo), el cierre falla con CAJA_CAMBIO y no cierra", async () => {
    const { usuarioId, cajaId } = await integranteConCaja();
    const paso1 = await enTx((tx) => declararEfectivo(tx, { cajaId, usuarioId, efectivoDeclarado: "1000.00" }));
    expect(paso1.resumen).toMatchObject({ efectivo_esperado: "1000.00", diferencia: "0.00", tipo_diferencia: "CUADRA" });
    await cobro(usuarioId, "formapago-transferencia", "15:00");
    const error = await enTx((tx) => cerrarCaja(tx, { cajaId, usuarioId, huella: paso1.huella })).catch((e) => e);
    expect(error).toMatchObject({ code: "CAJA_CAMBIO", message: "La caja cambió mientras cerrabas. Revisá el resumen." });
    expect(error.detalles.huella).not.toBe(paso1.huella);
    expect((await db.caja.findUniqueOrThrow({ where: { idCaja: cajaId } })).estado).toBe("ABIERTA");
    const cerrada = await enTx((tx) => cerrarCaja(tx, { cajaId, usuarioId, huella: error.detalles.huella }));
    expect(cerrada).toMatchObject({ estado: "CERRADA", diferencia: "0.00", tipo_diferencia: "CUADRA", por_ausencia: false });
    const fila = await db.caja.findUniqueOrThrow({ where: { idCaja: cajaId } });
    expect(fila).toMatchObject({ estado: "CERRADA", cerradaPorUsuarioId: usuarioId, cerradaPorActorTipo: "USUARIO" });
    expect((fila.resumen as { cobros_por_forma: unknown[] }).cobros_por_forma).toHaveLength(1);
    await expect(enTx((tx) => registrarMovimiento(tx, { cajaId, usuarioId, tipo: "INGRESO", monto: "1", concepto: "x" }))).rejects.toMatchObject({ code: "CAJA_NO_ABIERTA" });
  });

  it("con diferencia exige motivo", async () => {
    const { usuarioId, cajaId } = await integranteConCaja();
    const { huella, resumen } = await enTx((tx) => declararEfectivo(tx, { cajaId, usuarioId, efectivoDeclarado: "900" }));
    expect(resumen).toMatchObject({ diferencia: "-100.00", tipo_diferencia: "FALTANTE" });
    await expect(enTx((tx) => cerrarCaja(tx, { cajaId, usuarioId, huella }))).rejects.toMatchObject({ code: "MOTIVO_DIFERENCIA_REQUERIDO", status: 400 });
    await expect(enTx((tx) => cerrarCaja(tx, { cajaId, usuarioId, huella, motivo: "Faltaba cambio" }))).resolves.toMatchObject({ tipo_diferencia: "FALTANTE" });
  });

  it("(b) dos cierres simultáneos de la misma caja (el integrante y el gerente por ausencia): gana uno, el otro CAJA_YA_CERRADA", async () => {
    const { usuarioId, cajaId } = await integranteConCaja();
    const gerente = await crearUsuarioDePrueba(db, { rol: "GERENTE" });
    const { huella } = await enTx((tx) => declararEfectivo(tx, { cajaId, usuarioId, efectivoDeclarado: "1000.00" }));
    const resultados = await Promise.allSettled([
      enTx((tx) => cerrarCaja(tx, { cajaId, usuarioId, huella })),
      enTx((tx) => cerrarCaja(tx, { cajaId, usuarioId: gerente.idUsuario, huella, porAusencia: true })),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "CAJA_YA_CERRADA" });
    // El integrante no cierra la caja de otro sin «por ausencia», y el gerente no cierra «por ausencia» su propia caja.
    const otra = await integranteConCaja();
    await expect(enTx((tx) => cerrarCaja(tx, { cajaId: otra.cajaId, usuarioId, huella: "x" }))).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE" });
    await expect(enTx((tx) => cerrarCaja(tx, { cajaId: otra.cajaId, usuarioId: otra.usuarioId, huella: "x", porAusencia: true }))).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE" });
  });

  it("un cobro y un cierre simultáneos no confirman los dos", async () => {
    const { usuarioId, cajaId } = await integranteConCaja();
    const { huella } = await enTx((tx) => declararEfectivo(tx, { cajaId, usuarioId, efectivoDeclarado: "1000.00" }));
    const resultados = await Promise.allSettled([cobro(usuarioId, "formapago-efectivo", "17:00"), enTx((tx) => cerrarCaja(tx, { cajaId, usuarioId, huella }))]);
    const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rechazos).toHaveLength(1);
    expect(["CAJA_CAMBIO", "CAJA_NO_ABIERTA"]).toContain(rechazos[0]!.reason.code);
  });
});
