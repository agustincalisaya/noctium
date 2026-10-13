import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearFichaGerenteDePrueba, crearFichaMesaEntradaDePrueba, crearTurnoDePrueba } from "@/server/testing/fabricas";
import { fechaCentro } from "@/server/shared/fechas-centro";
import { actorUsuario } from "@/server/shared/historial";
import { ahora } from "@/server/shared/reloj";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { abrirCaja, cerrarCaja, declararEfectivo } from "@/server/pagos/caja.service";
import { registrarOperacion } from "@/server/pagos/operacion.service";
import type { UsuarioOperador } from "@/server/pagos/correccion.alcance";
import { anularPagoFlujo, corregirPagoFlujo } from "@/server/pagos/correccion.flujos";
import { CorregirPagoSchema } from "@/server/pagos/correccion.schema";
import { crearInscripcion } from "@/server/turnos/inscripcion.publico";

// PostgreSQL real (`npm run test:pg -- <ruta>`): los flujos HTTP de HU-I-06 de
// punta a punta, del body validado por Zod a las tablas. Complementa (no
// repite) correccion.service.pg.test.ts, que cubre las reglas del servicio.
describe.skipIf(!basePgHabilitada)("HU-I-06: flujos de corrección y anulación con PostgreSQL real", () => {
  let db: PrismaClient;
  const DIA = 24 * 60 * 60 * 1000;
  const enTx = <T>(fn: (tx: Tx) => Promise<T>) => transaccion(fn, { db });
  const opciones = () => ({ db });
  const cuerpo = (body: unknown) => CorregirPagoSchema.parse(body);

  let mesa: UsuarioOperador & { cajaId: string };
  let gerente: UsuarioOperador;

  async function integranteConCaja() {
    const ficha = await crearFichaMesaEntradaDePrueba(db);
    const caja = await enTx((tx) => abrirCaja(tx, { usuarioId: ficha.usuarioId!, fondoInicial: "0" }));
    return { id: ficha.usuarioId!, rol: "MESA_ENTRADA" as const, cajaId: caja.id };
  }

  /** Operación de `clases` clases futuras (12000 cada una) de un alumno nuevo, cobrada por `quien`. */
  async function operacion(quien: { id: string }, clases = 1) {
    const alumno = await crearAlumnoDePrueba(db);
    const items = [];
    for (let i = 0; i < clases; i++) {
      const turno = await crearTurnoDePrueba(db, { enDias: 5, hora: `${String(8 + 2 * i).padStart(2, "0")}:00` });
      const insc = await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(quien.id) }));
      items.push({ inscripcionId: insc.inscripcion.id, monto: "12000" });
    }
    return enTx((tx) => registrarOperacion(tx, { alumnoId: alumno.idAlumno, usuarioId: quien.id, formaPagoId: "formapago-efectivo", modo: "completo", items }));
  }

  /** La fila original de `pagos`, tal como se insertó (Regla N.° 8: nunca cambia). */
  const filaPago = (pagoId: string) => db.pago.findUniqueOrThrow({ where: { idPago: pagoId } });

  beforeAll(async () => {
    db = clientePg();
    mesa = await integranteConCaja();
    const fichaGerente = await crearFichaGerenteDePrueba(db);
    gerente = { id: fichaGerente.usuarioId!, rol: "GERENTE" };
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("solo monto: CorreccionPago, comprobante de reemplazo y el pago original intacto", async () => {
    const op = await operacion(mesa, 2);
    const pagoId = op.pagos[0]!.id;
    const antes = await filaPago(pagoId);
    const r = await corregirPagoFlujo(pagoId, cuerpo({ monto: "10000", motivo: "Beca parcial" }), mesa, opciones());
    expect(r).toMatchObject({
      pago_id: pagoId, monto: "10000.00", forma_pago: { id: "formapago-efectivo", is_active: true },
      fecha_pago: op.operacion.fechaPago.toISOString().slice(0, 10), clases_abarcadas: 2,
      comprobante: { numero: expect.stringMatching(/^0001-\d{8}$/) },
    });
    expect(await db.correccionPago.count({ where: { pagoId } })).toBe(1);
    expect(await db.comprobante.findUniqueOrThrow({ where: { idComprobante: r.comprobante.id } })).toMatchObject({ reemplazaAId: op.comprobante.id });
    expect(await filaPago(pagoId)).toEqual(antes);
  });

  it("solo forma y solo fecha: una CorreccionOperacion por campo que alcanza a todas las clases de la operación", async () => {
    const op = await operacion(mesa, 2);
    const forma = await corregirPagoFlujo(op.pagos[1]!.id, cuerpo({ forma_pago_id: "formapago-transferencia", motivo: "Era transferencia" }), mesa, opciones());
    expect(forma).toMatchObject({ forma_pago: { id: "formapago-transferencia" }, clases_abarcadas: 2 });
    const ayer = new Date(fechaCentro(ahora()).getTime() - DIA).toISOString().slice(0, 10);
    const fecha = await corregirPagoFlujo(op.pagos[0]!.id, cuerpo({ fecha_pago: ayer, motivo: "Fecha mal cargada" }), mesa, opciones());
    expect(fecha).toMatchObject({ fecha_pago: ayer, forma_pago: { id: "formapago-transferencia" }, clases_abarcadas: 2 });
    const correcciones = await db.correccionOperacion.findMany({ where: { operacionId: op.operacion.id } });
    expect(correcciones).toHaveLength(2);
    expect(correcciones.filter((c) => c.formaPagoNuevaId === "formapago-transferencia")).toHaveLength(1);
    expect(correcciones.filter((c) => c.fechaPagoNueva?.toISOString().slice(0, 10) === ayer)).toHaveLength(1);
  });

  it("monto y forma a la vez: dos registros y dos comprobantes de reemplazo encadenados; la respuesta trae el vigente", async () => {
    const op = await operacion(mesa, 2);
    const pagoId = op.pagos[0]!.id;
    const r = await corregirPagoFlujo(pagoId, cuerpo({ monto: "11000", forma_pago_id: "formapago-debito", motivo: "Ambos" }), mesa, opciones());
    expect(r).toMatchObject({ monto: "11000.00", forma_pago: { id: "formapago-debito" }, clases_abarcadas: 2 });
    const vigente = await db.comprobante.findUniqueOrThrow({ where: { idComprobante: r.comprobante.id } });
    const intermedio = await db.comprobante.findUniqueOrThrow({ where: { idComprobante: vigente.reemplazaAId! } });
    expect(intermedio.reemplazaAId).toBe(op.comprobante.id);
    expect(await db.comprobante.count({ where: { reemplazaAId: vigente.idComprobante } })).toBe(0);
    expect(await db.correccionPago.count({ where: { pagoId } })).toBe(1);
    expect(await db.correccionOperacion.count({ where: { operacionId: op.operacion.id } })).toBe(1);
  });

  it("si la segunda parte falla, la transacción revierte también la corrección de monto", async () => {
    const op = await operacion(mesa);
    const pagoId = op.pagos[0]!.id;
    const futura = new Date(fechaCentro(ahora()).getTime() + 3 * DIA).toISOString().slice(0, 10);
    await expect(corregirPagoFlujo(pagoId, cuerpo({ monto: "11000", fecha_pago: futura, motivo: "x" }), mesa, opciones()))
      .rejects.toMatchObject({ code: "FECHA_PAGO_FUTURA" });
    expect(await db.correccionPago.count({ where: { pagoId } })).toBe(0);
    expect(await db.comprobante.count({ where: { operacionId: op.operacion.id } })).toBe(1);
  });

  it("anularPagoFlujo: AnulacionPago, reserva reabierta con plazo nuevo y sin comprobante si era el único pago", async () => {
    const op = await operacion(mesa);
    const pagoId = op.pagos[0]!.id;
    const antes = await filaPago(pagoId);
    const r = await anularPagoFlujo(pagoId, { motivo: "Reintegro" }, mesa, opciones());
    expect(r).toMatchObject({
      pago_id: pagoId, anulado: true, comprobante: null,
      inscripcion: { estado_pago: "RESERVADA", vence_el: expect.stringMatching(/-03:00$/) },
    });
    const inscripcion = await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: r.inscripcion.id } });
    expect(inscripcion.estadoPago).toBe("RESERVADA");
    expect(await db.anulacionPago.findUniqueOrThrow({ where: { pagoId } })).toMatchObject({ motivo: "Reintegro", creadoPorUsuarioId: mesa.id });
    expect(await filaPago(pagoId)).toEqual(antes);
    await expect(anularPagoFlujo(pagoId, { motivo: "Otra vez" }, mesa, opciones())).rejects.toMatchObject({ code: "PAGO_YA_ANULADO" });
  });

  it("anular uno de varios emite comprobante de reemplazo; la otra inscripción sigue PAGADA", async () => {
    const op = await operacion(mesa, 2);
    const r = await anularPagoFlujo(op.pagos[0]!.id, { motivo: "Duplicado" }, mesa, opciones());
    expect(r.comprobante).toMatchObject({ reemplazo: true, numero: expect.stringMatching(/^0001-/) });
    expect((await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: op.pagos[1]!.inscripcionId } })).estadoPago).toBe("PAGADA");
  });

  it("caja del pago cerrada: mesa FUERA_DE_ALCANCE; el gerente sin caja de ajuste CAJA_DE_AJUSTE_NO_ABIERTA y con una abierta ajena, el ajuste queda registrado", async () => {
    const cajero = await integranteConCaja();
    const op = await operacion(cajero, 2);
    const { huella } = await enTx((tx) => declararEfectivo(tx, { cajaId: cajero.cajaId, usuarioId: cajero.id, efectivoDeclarado: "24000" }));
    await enTx((tx) => cerrarCaja(tx, { cajaId: cajero.cajaId, usuarioId: cajero.id, huella }));
    const destino = await integranteConCaja();
    const pagoId = op.pagos[0]!.id;

    await expect(corregirPagoFlujo(pagoId, cuerpo({ monto: "10000", motivo: "x" }), cajero, opciones())).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE", status: 403 });
    await expect(corregirPagoFlujo(pagoId, cuerpo({ monto: "10000", motivo: "x" }), gerente, opciones())).rejects.toMatchObject({ code: "CAJA_DE_AJUSTE_NO_ABIERTA", status: 409 });
    expect(await db.correccionPago.count({ where: { pagoId } })).toBe(0);

    await corregirPagoFlujo(pagoId, cuerpo({ monto: "10000", motivo: "Beca", caja_ajuste_id: destino.cajaId }), gerente, opciones());
    await anularPagoFlujo(op.pagos[1]!.id, { motivo: "Reintegro", caja_ajuste_id: destino.cajaId }, gerente, opciones());
    const ajustes = await db.ajusteCaja.findMany({ where: { cajaId: destino.cajaId } });
    expect(ajustes.map((a) => [a.monto.toFixed(2), a.correccionPagoId !== null, a.anulacionPagoId !== null]).sort()).toEqual([
      ["-12000.00", false, true], ["-2000.00", true, false],
    ]);
    expect((await db.caja.findUniqueOrThrow({ where: { idCaja: destino.cajaId } })).estado).toBe("ABIERTA");
    expect((await db.caja.findUniqueOrThrow({ where: { idCaja: cajero.cajaId } })).estado).toBe("CERRADA");
  });
});
