import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearFichaMesaEntradaDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { ahora, conReloj } from "@/server/shared/reloj";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { abrirCaja, calcularResumen, cerrarCaja, declararEfectivo } from "@/server/pagos/caja.service";
import { registrarOperacion } from "@/server/pagos/operacion.service";
import { anularPago, corregirOperacion, corregirPago, type UsuarioOperador } from "@/server/pagos/correccion.service";
import { ComprobanteDatosSchema } from "@/server/pagos/comprobante.schema";
import {
  listarPagosDeAlumno,
  listarPagosDeClase,
  listarPagosDeTurnoVigente,
  sumarPagosPorMesVigente,
} from "@/server/pagos/pago.lecturas.publico";
import { sqlFechaPagoVigente, sqlFormaPagoVigente, sqlMontoVigente, sqlPagoNoAnulado } from "@/server/pagos/pago.vigente";
import { crearInscripcion } from "@/server/turnos/inscripcion.publico";

// PostgreSQL real (`npm run test:pg -- <ruta>`): corrección y anulación de
// pagos (HU-I-06, PR-0.md §2.13) y lecturas con el valor vigente.
describe.skipIf(!basePgHabilitada)("corrección y anulación de pagos con PostgreSQL real", () => {
  let db: PrismaClient;
  const DIA = 24 * 60 * 60 * 1000;
  const enTx = <T>(fn: (tx: Tx) => Promise<T>, momento?: Date) =>
    momento ? conReloj(momento, () => transaccion(fn, { db })) : transaccion(fn, { db });

  let mesa: UsuarioOperador & { cajaId: string };
  let gerente: UsuarioOperador;

  async function integranteConCaja() {
    const ficha = await crearFichaMesaEntradaDePrueba(db);
    const caja = await enTx((tx) => abrirCaja(tx, { usuarioId: ficha.usuarioId!, fondoInicial: "0" }));
    return { id: ficha.usuarioId!, rol: "MESA_ENTRADA" as const, cajaId: caja.id };
  }

  /** Operación de `clases` clases (12000 cada una) de un alumno nuevo, cobrada por `quien`. */
  async function operacion(quien: { id: string }, clases = 1, formaPagoId = "formapago-efectivo") {
    const alumno = await crearAlumnoDePrueba(db);
    const items = [];
    for (let i = 0; i < clases; i++) {
      const turno = await crearTurnoDePrueba(db, { enDias: 5, hora: `${String(8 + 2 * i).padStart(2, "0")}:00` });
      const insc = await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(quien.id) }));
      items.push({ inscripcionId: insc.inscripcion.id, monto: "12000" });
    }
    const r = await enTx((tx) => registrarOperacion(tx, { alumnoId: alumno.idAlumno, usuarioId: quien.id, formaPagoId, modo: "completo", items }));
    return { ...r, alumnoId: alumno.idAlumno };
  }

  async function verificarEquivalencia() {
    const filas = await db.$queryRaw<{ estadoPago: string; pagos: number }[]>(Prisma.sql`
      SELECT ta."estadoPago"::text AS "estadoPago", (SELECT count(*)::int FROM "pagos" p WHERE p."inscripcionId" = ta."idInscripcion" AND ${sqlPagoNoAnulado("p")}) AS pagos
      FROM "turno_alumno" ta WHERE ta."vigencia" = 'VIGENTE'`);
    expect(filas.filter((f) => (f.estadoPago === "PAGADA") !== (f.pagos > 0))).toEqual([]);
  }

  async function numerosUnicos() {
    const [fila] = await db.$queryRaw<{ total: number; distintos: number }[]>`SELECT count(*)::int AS total, count(DISTINCT numero)::int AS distintos FROM comprobantes`;
    expect(fila!.distintos).toBe(fila!.total);
  }

  beforeAll(async () => {
    db = clientePg();
    mesa = await integranteConCaja();
    gerente = { id: (await crearUsuarioDePrueba(db, { rol: "GERENTE" })).idUsuario, rol: "GERENTE" };
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("corregirPago: registro nuevo con el monto anterior vigente, comprobante de reemplazo y el original intacto", async () => {
    const op = await operacion(mesa);
    const pagoId = op.pagos[0]!.id;
    const r = await enTx((tx) => corregirPago(tx, { pagoId, monto: "10000", motivo: "Beca parcial", usuario: mesa }));
    expect(r).toMatchObject({ montoAnterior: "12000.00", montoNuevo: "10000.00", ajustes: [] });
    expect(r.comprobante.numero).toBeGreaterThan(op.comprobante.numero);
    expect(await db.comprobante.findUniqueOrThrow({ where: { idComprobante: r.comprobante.id } })).toMatchObject({ reemplazaAId: op.comprobante.id });
    expect(ComprobanteDatosSchema.parse(r.comprobante.datos).total).toBe("10000.00");
    expect((await db.pago.findUniqueOrThrow({ where: { idPago: pagoId } })).montoPago.toFixed(2)).toBe("12000.00");
    const segunda = await enTx((tx) => corregirPago(tx, { pagoId, monto: "9000", motivo: "Otra", usuario: mesa }));
    expect(segunda.montoAnterior).toBe("10000.00");
    await expect(enTx((tx) => corregirPago(tx, { pagoId, monto: "9000.00", motivo: "Igual", usuario: mesa }))).rejects.toMatchObject({ code: "SIN_CAMBIOS" });
    const [lista] = await listarPagosDeAlumno(op.alumnoId, {}, db);
    expect(lista).toMatchObject({ monto: "9000.00", monto_original: "12000.00", cambios: 2, comprobante_vigente: { numero: expect.stringMatching(/^0001-/) } });
    await verificarEquivalencia();
  });

  it("corregirOperacion: forma y fecha, una corrección por campo, alcanza a todos los pagos de la operación", async () => {
    const op = await operacion(mesa, 2);
    const ayer = new Date(new Date(ahora().toISOString().slice(0, 10) + "T00:00:00.000Z").getTime() - DIA);
    const r = await enTx((tx) => corregirOperacion(tx, { pagoId: op.pagos[0]!.id, formaPagoId: "formapago-transferencia", fechaPago: ayer, motivo: "Error de carga", usuario: mesa }));
    expect(r.correcciones).toHaveLength(2);
    expect(r.clasesAbarcadas).toBe(2);
    const pagos = await listarPagosDeAlumno(op.alumnoId, {}, db);
    expect(pagos.map((p) => [p.forma_pago.id, p.fecha_pago])).toEqual([
      ["formapago-transferencia", ayer.toISOString().slice(0, 10)], ["formapago-transferencia", ayer.toISOString().slice(0, 10)],
    ]);
    await expect(enTx((tx) => corregirOperacion(tx, { pagoId: op.pagos[1]!.id, formaPagoId: "formapago-transferencia", motivo: "x", usuario: mesa })))
      .rejects.toMatchObject({ code: "SIN_CAMBIOS" });
    await expect(enTx((tx) => corregirOperacion(tx, { pagoId: op.pagos[1]!.id, fechaPago: new Date(ahora().getTime() + 3 * DIA), motivo: "x", usuario: mesa })))
      .rejects.toMatchObject({ code: "FECHA_PAGO_FUTURA" });
    // La forma vigente es la de la operación también en el resumen de su caja.
    const { resumen } = await calcularResumen(db, mesa.cajaId);
    expect(resumen.cobros_por_forma.find((c) => c.forma_pago.id === "formapago-transferencia")!.cantidad).toBeGreaterThanOrEqual(2);
  });

  it("anularPago: uno de varios emite reemplazo y sigue PAGADA la otra; el último deja la reserva reabierta y sin comprobante nuevo", async () => {
    const op = await operacion(mesa, 2);
    const primero = await enTx((tx) => anularPago(tx, { pagoId: op.pagos[0]!.id, motivo: "Reintegro", usuario: mesa }));
    expect(primero.comprobante).not.toBeNull();
    expect(primero.comprobante!.datos.clases.map((c) => c.pago_id)).toEqual([op.pagos[1]!.id]);
    expect(primero.inscripcion).toMatchObject({ cambio: true, nuevo: "RESERVADA" });
    await expect(enTx((tx) => anularPago(tx, { pagoId: op.pagos[0]!.id, motivo: "Otra vez", usuario: mesa }))).rejects.toMatchObject({ code: "PAGO_YA_ANULADO" });
    await expect(enTx((tx) => corregirPago(tx, { pagoId: op.pagos[0]!.id, monto: "1", motivo: "x", usuario: mesa }))).rejects.toMatchObject({ code: "PAGO_ANULADO" });
    const ultimo = await enTx((tx) => anularPago(tx, { pagoId: op.pagos[1]!.id, motivo: "Reintegro", usuario: mesa }));
    expect(ultimo.comprobante).toBeNull();
    const pagos = await listarPagosDeAlumno(op.alumnoId, {}, db);
    expect(pagos.every((p) => p.anulado && p.comprobante_vigente !== null)).toBe(true);
    await verificarEquivalencia();
    await numerosUnicos();
  });

  it("dos anulaciones simultáneas del mismo pago: gana una, la otra PAGO_YA_ANULADO", async () => {
    const op = await operacion(mesa);
    const resultados = await Promise.allSettled([0, 1].map(() => enTx((tx) => anularPago(tx, { pagoId: op.pagos[0]!.id, motivo: "Reintegro", usuario: mesa }))));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "PAGO_YA_ANULADO" });
    await verificarEquivalencia();
  });

  it("caja del pago cerrada: mesa queda fuera de alcance; el gerente necesita una caja abierta de ajuste y registra el dinero que se mueve", async () => {
    const cajero = await integranteConCaja();
    const op = await operacion(cajero, 2);
    const { huella } = await enTx((tx) => declararEfectivo(tx, { cajaId: cajero.cajaId, usuarioId: cajero.id, efectivoDeclarado: "24000" }));
    await enTx((tx) => cerrarCaja(tx, { cajaId: cajero.cajaId, usuarioId: cajero.id, huella }));
    const destino = await integranteConCaja();

    await expect(enTx((tx) => corregirPago(tx, { pagoId: op.pagos[0]!.id, monto: "10000", motivo: "x", usuario: cajero }))).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE", status: 403 });
    await expect(enTx((tx) => corregirPago(tx, { pagoId: op.pagos[0]!.id, monto: "10000", motivo: "x", usuario: gerente })))
      .rejects.toMatchObject({ code: "CAJA_DE_AJUSTE_NO_ABIERTA", message: "Para registrar este cambio tiene que haber una caja abierta en mesa de entrada." });

    const monto = await enTx((tx) => corregirPago(tx, { pagoId: op.pagos[0]!.id, monto: "10000", motivo: "Beca", usuario: gerente, cajaAjusteId: destino.cajaId }));
    expect(monto.ajustes).toHaveLength(1);
    const forma = await enTx((tx) => corregirOperacion(tx, { pagoId: op.pagos[0]!.id, formaPagoId: "formapago-debito", motivo: "Era débito", usuario: gerente, cajaAjusteId: destino.cajaId }));
    expect(forma.ajustes).toHaveLength(2);
    const anulado = await enTx((tx) => anularPago(tx, { pagoId: op.pagos[1]!.id, motivo: "Reintegro", usuario: gerente, cajaAjusteId: destino.cajaId }));
    expect(anulado.ajustes).toHaveLength(1);

    const ajustes = await db.ajusteCaja.findMany({ where: { cajaId: destino.cajaId }, orderBy: { createdAtAjusteCaja: "asc" } });
    expect(ajustes.map((a) => [a.formaPagoId, a.monto.toFixed(2)]).sort()).toEqual([
      ["formapago-debito", "-12000.00"], ["formapago-debito", "22000.00"], ["formapago-efectivo", "-2000.00"], ["formapago-efectivo", "-22000.00"],
    ].sort());
    // El arqueo de la caja destino suma solo los ajustes en efectivo; la caja cerrada no cambia.
    expect((await calcularResumen(db, destino.cajaId)).resumen.efectivo_esperado).toBe("-24000.00");
    expect((await db.caja.findUniqueOrThrow({ where: { idCaja: cajero.cajaId } })).efectivoEsperado?.toFixed(2)).toBe("24000.00");
    await verificarEquivalencia();
  });

  it("mesa de entrada no corrige un pago registrado hace más de 30 días", async () => {
    const op = await operacion(mesa);
    await expect(enTx((tx) => corregirPago(tx, { pagoId: op.pagos[0]!.id, monto: "1", motivo: "x", usuario: mesa }), new Date(ahora().getTime() + 31 * DIA)))
      .rejects.toMatchObject({ code: "FUERA_DE_ALCANCE" });
  });

  it("una sola implementación del valor vigente: SQL y TypeScript coinciden en monto, forma, fecha y anulación", async () => {
    const pagosTs = (await db.pago.findMany({ select: { alumnoId: true } })).map((p) => p.alumnoId);
    const alumnos = [...new Set(pagosTs)];
    const enTs = (await Promise.all(alumnos.map((a) => listarPagosDeAlumno(a, {}, db)))).flat()
      .map((p) => [p.pago_id, p.monto, p.forma_pago.id, p.fecha_pago, p.anulado]).sort();
    const enSql = (await db.$queryRaw<{ id: string; monto: string; forma: string; fecha: Date; noAnulado: boolean }[]>(Prisma.sql`
      SELECT p."idPago" AS id, ${sqlMontoVigente("p")}::text AS monto, ${sqlFormaPagoVigente("p")} AS forma,
        ${sqlFechaPagoVigente("p")} AS fecha, ${sqlPagoNoAnulado("p")} AS "noAnulado"
      FROM "pagos" p`)).map((f) => [f.id, new Prisma.Decimal(f.monto).toFixed(2), f.forma, f.fecha.toISOString().slice(0, 10), !f.noAnulado]).sort();
    expect(enSql).toEqual(enTs);
  });

  it("listarPagosDeClase incluye los anulados; listarPagosDeTurnoVigente y sumarPagosPorMesVigente los excluyen y usan el monto vigente", async () => {
    const op = await operacion(mesa, 2);
    await enTx((tx) => corregirPago(tx, { pagoId: op.pagos[0]!.id, monto: "11000", motivo: "x", usuario: mesa }));
    await enTx((tx) => anularPago(tx, { pagoId: op.pagos[1]!.id, motivo: "x", usuario: mesa }));
    const turnoA = op.pagos[0]!.turnoId;
    const turnoB = op.pagos[1]!.turnoId;
    expect(await listarPagosDeClase(turnoB, db)).toEqual([expect.objectContaining({ id: op.pagos[1]!.id, anulado: true, operacion_id: op.operacion.id })]);
    expect(await listarPagosDeTurnoVigente(turnoB, db)).toEqual([]);
    expect(await listarPagosDeTurnoVigente(turnoA, db)).toEqual([
      expect.objectContaining({ id: op.pagos[0]!.id, monto: "11000.00", forma_pago: { id: "formapago-efectivo", nombre: expect.any(String) } }),
    ]);
    const mes = op.operacion.fechaPago.toISOString().slice(0, 7);
    const [total] = await sumarPagosPorMesVigente(mes, mes, db);
    const esperado = (await db.$queryRaw<{ total: string }[]>(Prisma.sql`
      SELECT SUM(${sqlMontoVigente("p")})::text AS total FROM "pagos" p
      WHERE ${sqlPagoNoAnulado("p")} AND to_char(${sqlFechaPagoVigente("p")}, 'YYYY-MM') = ${mes}`))[0]!.total;
    expect(total).toEqual({ mes, total: esperado });
  });
});
