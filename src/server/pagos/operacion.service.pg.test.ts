import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  crearAlumnoDePrueba,
  crearFichaMesaEntradaDePrueba,
  crearInscripcionDePrueba,
  crearTurnoDePrueba,
  crearUsuarioDePrueba,
  unico,
} from "@/server/testing/fabricas";
import { ahora, conReloj } from "@/server/shared/reloj";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { inicioDeTurno } from "@/server/shared/fechas-centro";
import { abrirCaja, cajaAbiertaDe } from "@/server/pagos/caja.service";
import { registrarOperacion, type DatosOperacion } from "@/server/pagos/operacion.service";
import { ComprobanteDatosSchema } from "@/server/pagos/comprobante.schema";
import { emitirReemplazo } from "@/server/pagos/comprobante.service";
import { contarPagosNoAnulados } from "@/server/pagos/pago.vigente";
import { crearInscripcion, finalizarInscripcion, recalcularEstadoPago } from "@/server/turnos/inscripcion.publico";

// PostgreSQL real (`npm run test:pg -- <ruta>`): caja (apertura), registro de
// operaciones en sus dos modos, comprobantes y la equivalencia de «Pagada».
describe.skipIf(!basePgHabilitada)("registrarOperacion, caja y comprobante con PostgreSQL real", () => {
  let db: PrismaClient;
  const HORA = 60 * 60 * 1000;

  const enTx = <T>(fn: (tx: Tx) => Promise<T>, momento?: Date) =>
    momento ? conReloj(momento, () => transaccion(fn, { db })) : transaccion(fn, { db });

  /** Integrante de mesa de entrada con ficha y caja abierta (con el servicio). */
  async function integranteConCaja() {
    const ficha = await crearFichaMesaEntradaDePrueba(db);
    const usuarioId = ficha.usuarioId!;
    const caja = await enTx((tx) => abrirCaja(tx, { usuarioId, fondoInicial: "1000.50" }));
    return { usuarioId, cajaId: caja.id };
  }

  const cobrar = (datos: Partial<DatosOperacion> & Pick<DatosOperacion, "alumnoId" | "items" | "usuarioId">, momento?: Date) =>
    enTx((tx) => registrarOperacion(tx, { formaPagoId: "formapago-efectivo", modo: "completo", ...datos }), momento);

  /** Anulación mínima para las pruebas (el servicio anularPago llega en la parte 3): registro + recálculo. */
  const anular = (pagoId: string, usuarioId: string, momento?: Date) => enTx(async (tx) => {
    const pago = await tx.pago.findUniqueOrThrow({ where: { idPago: pagoId } });
    await tx.anulacionPago.create({ data: { pagoId, motivo: "Reintegro", actorTipo: "USUARIO", creadoPorUsuarioId: usuarioId } });
    return recalcularEstadoPago(tx, pago.inscripcionId, await contarPagosNoAnulados(tx, pago.inscripcionId), actorUsuario(usuarioId));
  }, momento);

  /** «Pagada ⇔ al menos un pago no anulado», sobre todas las inscripciones vigentes de la base. */
  async function verificarEquivalencia() {
    const filas = await db.$queryRaw<{ id: string; estadoPago: string; pagos: number }[]>(Prisma.sql`
      SELECT ta."idInscripcion" AS id, ta."estadoPago"::text AS "estadoPago",
        (SELECT count(*)::int FROM "pagos" p WHERE p."inscripcionId" = ta."idInscripcion"
           AND NOT EXISTS (SELECT 1 FROM "anulaciones_pago" a WHERE a."pagoId" = p."idPago")) AS pagos
      FROM "turno_alumno" ta WHERE ta."vigencia" = 'VIGENTE'`);
    expect(filas.filter((f) => (f.estadoPago === "PAGADA") !== (f.pagos > 0))).toEqual([]);
  }

  let mesa: { usuarioId: string; cajaId: string };

  beforeAll(async () => {
    db = clientePg();
    mesa = await integranteConCaja();
  });
  afterAll(async () => { await db?.$disconnect(); });

  describe("caja", () => {
    it("abrirCaja exige la ficha de mesa de entrada activa", async () => {
      const sinFicha = await crearUsuarioDePrueba(db);
      await expect(enTx((tx) => abrirCaja(tx, { usuarioId: sinFicha.idUsuario, fondoInicial: "0" }))).rejects.toMatchObject({ code: "INTEGRANTE_INACTIVO" });
      const inactiva = await crearFichaMesaEntradaDePrueba(db, { activo: false });
      await expect(enTx((tx) => abrirCaja(tx, { usuarioId: inactiva.usuarioId!, fondoInicial: "0" }))).rejects.toMatchObject({ code: "INTEGRANTE_INACTIVO" });
    });

    it("una sola caja abierta por integrante, aun con dos aperturas simultáneas (CAJA_YA_ABIERTA)", async () => {
      const ficha = await crearFichaMesaEntradaDePrueba(db);
      const usuarioId = ficha.usuarioId!;
      const resultados = await Promise.allSettled([0, 1].map(() => enTx((tx) => abrirCaja(tx, { usuarioId, fondoInicial: "0" }))));
      expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "CAJA_YA_ABIERTA", status: 409 });
      const abierta = await cajaAbiertaDe(db, usuarioId);
      expect(abierta).toMatchObject({ id: (resultados.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>).value.id });
      expect(await cajaAbiertaDe(db, (await crearUsuarioDePrueba(db)).idUsuario)).toBeNull();
    });
  });

  describe("modo completo (HU-I-10)", () => {
    it("cobra una reserva, la deja PAGADA sin vencimiento y emite un comprobante válido con el número de la secuencia", async () => {
      const turno = await crearTurnoDePrueba(db, { duracionMin: 120 });
      const alumno = await crearAlumnoDePrueba(db);
      const reserva = await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO", conReserva: true, actor: actorUsuario(mesa.usuarioId) }));
      const r = await cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ inscripcionId: reserva.inscripcion.id, monto: "24000" }] });
      expect(r.pagos).toEqual([expect.objectContaining({ inscripcionId: reserva.inscripcion.id, precio: 24000, monto: "24000.00", motivoAjuste: null })]);
      expect(r.operacion.cajaId).toBe(mesa.cajaId);
      expect(r.comprobante.numeroVisible).toMatch(/^0001-\d{8}$/);
      const guardado = await db.comprobante.findUniqueOrThrow({ where: { idComprobante: r.comprobante.id } });
      expect(ComprobanteDatosSchema.parse(guardado.datos)).toMatchObject({ total: "24000.00", alumno: { id: alumno.idAlumno } });
      expect(await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: reserva.inscripcion.id } })).toMatchObject({ estadoPago: "PAGADA", venceEl: null, venceBaseEl: null });
      await verificarEquivalencia();
    });

    it("varias clases en una operación: un pago por clase y un solo comprobante con el total", async () => {
      const alumno = await crearAlumnoDePrueba(db);
      const ids = [];
      for (const hora of ["08:00", "12:00"]) {
        const turno = await crearTurnoDePrueba(db, { hora });
        ids.push((await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(mesa.usuarioId) }))).inscripcion.id);
      }
      const r = await cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: ids.map((inscripcionId) => ({ inscripcionId, monto: "12000.00" })) });
      expect(r.pagos).toHaveLength(2);
      expect(await db.comprobante.count({ where: { operacionId: r.operacion.id } })).toBe(1);
      expect(r.comprobante.datos.total).toBe("24000.00");
    });

    it("rechaza clase iniciada, reserva vencida, pago repetido, monto sin motivo, otro alumno y clase cancelada, identificando la clase", async () => {
      const alumno = await crearAlumnoDePrueba(db);
      const pasada = await crearTurnoDePrueba(db, { enDias: -1 });
      const enPasada = await crearInscripcionDePrueba(db, { turnoId: pasada.idTurno, alumnoId: alumno.idAlumno });
      const error = await cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ inscripcionId: enPasada.idInscripcion, monto: "12000" }] }).catch((e) => e);
      expect(error).toMatchObject({ code: "TURNO_YA_EMPEZO", status: 409, detalles: expect.objectContaining({ turno_id: pasada.idTurno, fecha: pasada.fechaTurno.toISOString().slice(0, 10) }) });
      expect(error.message).toMatch(/^La clase de .+ del \d{2}\/\d{2}\/\d{4} ya empezó: el pago se hace antes de la clase\.$/);

      const turno = await crearTurnoDePrueba(db, { enDias: 6, hora: "16:00" });
      const reserva = await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO", conReserva: true, actor: actorUsuario(mesa.usuarioId) }));
      const despues = new Date(reserva.inscripcion.venceEl!.getTime() + 1000);
      await expect(cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ inscripcionId: reserva.inscripcion.id, monto: "12000" }] }, despues))
        .rejects.toMatchObject({ code: "RESERVA_VENCIDA", message: "La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo." });

      const otraClase = await crearTurnoDePrueba(db, { enDias: 6, hora: "18:00" });
      const insc = await enTx((tx) => crearInscripcion(tx, { turnoId: otraClase.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(mesa.usuarioId) }));
      await expect(cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ inscripcionId: insc.inscripcion.id, monto: "10000" }] }))
        .rejects.toMatchObject({ code: "MOTIVO_AJUSTE_REQUERIDO", status: 400, detalles: expect.objectContaining({ turno_id: otraClase.idTurno, precio_vigente: 12000 }) });
      const ajustado = await cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ inscripcionId: insc.inscripcion.id, monto: "10000", motivoAjuste: "Beca" }] });
      expect(await db.pago.findUniqueOrThrow({ where: { idPago: ajustado.pagos[0]!.id } })).toMatchObject({ motivoAjuste: "Beca", ajustadoPorUsuarioId: mesa.usuarioId, precio: 12000 });
      await expect(cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ inscripcionId: insc.inscripcion.id, monto: "12000" }] }))
        .rejects.toMatchObject({ code: "INSCRIPCION_YA_PAGADA" });

      const otroAlumno = await crearAlumnoDePrueba(db);
      await expect(cobrar({ alumnoId: otroAlumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ inscripcionId: insc.inscripcion.id, monto: "12000" }] }))
        .rejects.toMatchObject({ code: "ALUMNO_NO_INSCRIPTO" });
      await expect(cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ inscripcionId: "no-existe", monto: "1" }] }))
        .rejects.toMatchObject({ code: "INSCRIPCION_NO_ENCONTRADA" });

      const cancelada = await crearTurnoDePrueba(db, { enDias: 7, hora: "09:00" });
      const enCancelada = await enTx((tx) => crearInscripcion(tx, { turnoId: cancelada.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(mesa.usuarioId) }));
      await db.turno.update({ where: { idTurno: cancelada.idTurno }, data: { estadoTurno: "CANCELADO" } });
      await expect(cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ inscripcionId: enCancelada.inscripcion.id, monto: "12000" }] }))
        .rejects.toMatchObject({ code: "TURNO_NO_ADMITE_PAGO", message: "Solo se pueden registrar pagos en turnos disponibles o completos" });
    });

    it("«Se inscribe al confirmar el pago»: solo si exigeInscripcionConPago; crea la inscripción ya PAGADA con el precio vigente", async () => {
      const alumno = await crearAlumnoDePrueba(db);
      const turno = await crearTurnoDePrueba(db, { enDias: 6, hora: "10:00" });
      await expect(cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ crearInscripcion: { turnoId: turno.idTurno }, monto: "12000" }] }))
        .rejects.toMatchObject({ code: "ALUMNO_NO_INSCRIPTO", detalles: expect.objectContaining({ turno_id: turno.idTurno }) });
      // Reserva que vence sin pagar: desde ahí, solo se inscribe pagando.
      const vencida = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, estadoPago: "RESERVADA", reservadaEl: new Date(ahora().getTime() - 48 * HORA) });
      const r = await cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ crearInscripcion: { turnoId: turno.idTurno }, monto: "12000" }] });
      expect((await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: vencida.idInscripcion } })).vigencia).toBe("RESERVA_VENCIDA");
      expect(await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: r.pagos[0]!.inscripcionId } })).toMatchObject({ vigencia: "VIGENTE", estadoPago: "PAGADA", precio: 12000 });
      await verificarEquivalencia();
    });

    it("forma, fecha y caja se validan después de las clases, con los códigos de Sprint 2", async () => {
      const alumno = await crearAlumnoDePrueba(db);
      const turno = await crearTurnoDePrueba(db, { hora: "19:00" });
      const insc = await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(mesa.usuarioId) }));
      const item = [{ inscripcionId: insc.inscripcion.id, monto: "12000" }];
      const nombre = unico("Forma ");
      await db.formaPago.create({ data: { idFormaPago: nombre, nombreFormaPago: nombre, nombreNormalizadaFormaPago: nombre.toLowerCase(), activaFormaPago: false } });
      await expect(cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: item, formaPagoId: nombre })).rejects.toMatchObject({ code: "FORMA_PAGO_NO_DISPONIBLE" });
      await expect(cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: item, formaPagoId: "no-existe" })).rejects.toMatchObject({ code: "FORMA_PAGO_NO_ENCONTRADA" });
      await expect(cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: item, fechaPago: new Date(ahora().getTime() + 72 * HORA) })).rejects.toMatchObject({ code: "FECHA_PAGO_FUTURA" });
      const sinCaja = await crearFichaMesaEntradaDePrueba(db);
      await expect(cobrar({ alumnoId: alumno.idAlumno, usuarioId: sinCaja.usuarioId!, items: item })).rejects.toMatchObject({
        code: "CAJA_NO_ABIERTA", message: "No se puede registrar un cobro hasta que abras una caja.",
      });
    });
  });

  describe("modo compatSprint2 (POST /api/pagos, permanente)", () => {
    it("admite una clase ya iniciada, pagos parciales y un monto distinto del precio sin motivo; emite comprobante", async () => {
      const alumno = await crearAlumnoDePrueba(db);
      const pasada = await crearTurnoDePrueba(db, { enDias: -1, hora: "11:00" });
      const insc = await crearInscripcionDePrueba(db, { turnoId: pasada.idTurno, alumnoId: alumno.idAlumno });
      const compat = (monto: string) => cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, modo: "compatSprint2", items: [{ inscripcionId: insc.idInscripcion, monto }] });
      const primero = await compat("3500.00");
      const segundo = await compat("2500.50");
      expect(await db.pago.findUniqueOrThrow({ where: { idPago: primero.pagos[0]!.id } })).toMatchObject({ motivoAjuste: null, ajustadoPorUsuarioId: mesa.usuarioId });
      expect(segundo.comprobante.numero).toBeGreaterThan(primero.comprobante.numero);
      expect(await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: insc.idInscripcion } })).toMatchObject({ estadoPago: "PAGADA" });
      await verificarEquivalencia();
    });

    it("una reserva vencida responde ALUMNO_NO_INSCRIPTO (código de Sprint 2) y exige caja", async () => {
      const alumno = await crearAlumnoDePrueba(db);
      const turno = await crearTurnoDePrueba(db, { enDias: 6, hora: "12:00" });
      const vencida = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, estadoPago: "RESERVADA", reservadaEl: new Date(ahora().getTime() - 48 * HORA) });
      await expect(cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, modo: "compatSprint2", items: [{ inscripcionId: vencida.idInscripcion, monto: "1" }] }))
        .rejects.toMatchObject({ code: "ALUMNO_NO_INSCRIPTO" });
    });
  });

  describe("(c) equivalencia «Pagada ⇔ al menos un pago no anulado» en cada transición", () => {
    async function inscriptoPagado(opciones: { enDias?: number; hora?: string; compat?: boolean } = {}) {
      const alumno = await crearAlumnoDePrueba(db);
      const turno = await crearTurnoDePrueba(db, { enDias: opciones.enDias ?? 4, hora: opciones.hora ?? "10:00" });
      const insc = await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(mesa.usuarioId) }));
      return { alumno, turno, inscripcionId: insc.inscripcion.id };
    }
    const pagar = (alumnoId: string, inscripcionId: string, monto = "12000", modo: DatosOperacion["modo"] = "completo") =>
      cobrar({ alumnoId, usuarioId: mesa.usuarioId, modo, items: [{ inscripcionId, monto, motivoAjuste: "Parcial" }] });
    const estado = async (id: string) => (await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: id } }));

    it("pagar → PAGADA; anular el último pago antes de la clase → RESERVADA reabierta con plazo nuevo", async () => {
      const { alumno, inscripcionId } = await inscriptoPagado();
      const r = await pagar(alumno.idAlumno, inscripcionId);
      await verificarEquivalencia();
      const momento = ahora();
      await expect(anular(r.pagos[0]!.id, mesa.usuarioId, momento)).resolves.toMatchObject({ nuevo: "RESERVADA" });
      expect(await estado(inscripcionId)).toMatchObject({ estadoPago: "RESERVADA", reabiertaPorAnulacion: true, inicioPlazo: momento });
      await verificarEquivalencia();
    });

    it("anular uno de varios pagos: sigue PAGADA", async () => {
      const { alumno, inscripcionId } = await inscriptoPagado({ hora: "12:00" });
      const uno = await pagar(alumno.idAlumno, inscripcionId, "5000", "compatSprint2");
      await pagar(alumno.idAlumno, inscripcionId, "7000", "compatSprint2");
      await expect(anular(uno.pagos[0]!.id, mesa.usuarioId)).resolves.toMatchObject({ cambio: false, nuevo: "PAGADA" });
      expect((await estado(inscripcionId)).estadoPago).toBe("PAGADA");
      await verificarEquivalencia();
    });

    it("reintegro por clase cancelada: sin reserva, queda PAGO_SIN_REGISTRAR y sigue vigente", async () => {
      const { alumno, turno, inscripcionId } = await inscriptoPagado({ hora: "14:00" });
      const r = await pagar(alumno.idAlumno, inscripcionId);
      await db.turno.update({ where: { idTurno: turno.idTurno }, data: { estadoTurno: "CANCELADO" } });
      await expect(anular(r.pagos[0]!.id, mesa.usuarioId)).resolves.toMatchObject({ nuevo: "PAGO_SIN_REGISTRAR" });
      expect(await estado(inscripcionId)).toMatchObject({ vigencia: "VIGENTE", estadoPago: "PAGO_SIN_REGISTRAR", venceEl: null });
      await verificarEquivalencia();
    });

    it("clase ya iniciada: anular el último pago deja PAGO_SIN_REGISTRAR, sin reserva", async () => {
      const { alumno, turno, inscripcionId } = await inscriptoPagado({ hora: "16:00" });
      const r = await pagar(alumno.idAlumno, inscripcionId);
      const iniciada = new Date(inicioDeTurno(turno).getTime() + 10 * 60 * 1000);
      await expect(anular(r.pagos[0]!.id, mesa.usuarioId, iniciada)).resolves.toMatchObject({ nuevo: "PAGO_SIN_REGISTRAR" });
      await verificarEquivalencia();
    });

    it("reintegro a quien canceló: la inscripción ya no es vigente y no cambia", async () => {
      const { alumno, inscripcionId } = await inscriptoPagado({ hora: "18:00" });
      const r = await pagar(alumno.idAlumno, inscripcionId);
      await enTx((tx) => finalizarInscripcion(tx, { inscripcionId, vigencia: "CANCELADA_ALUMNO", actor: actorUsuario(mesa.usuarioId) }));
      await expect(anular(r.pagos[0]!.id, mesa.usuarioId)).resolves.toMatchObject({ cambio: false });
      expect(await estado(inscripcionId)).toMatchObject({ vigencia: "CANCELADA_ALUMNO", estadoPago: "PAGADA" });
      await verificarEquivalencia();
    });

    it("emitirReemplazo: emite con los pagos vigentes y no deja reemplazar dos veces el mismo comprobante", async () => {
      const alumno = await crearAlumnoDePrueba(db);
      const ids = [];
      for (const hora of ["09:00", "13:00"]) {
        const turno = await crearTurnoDePrueba(db, { enDias: 5, hora });
        ids.push((await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(mesa.usuarioId) }))).inscripcion.id);
      }
      const r = await cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: ids.map((inscripcionId) => ({ inscripcionId, monto: "12000" })) });
      await anular(r.pagos[0]!.id, mesa.usuarioId);
      const reemplazo = await enTx((tx) => emitirReemplazo(tx, r.comprobante.id));
      expect(reemplazo.datos.clases.map((c) => c.pago_id)).toEqual([r.pagos[1]!.id]);
      expect(reemplazo.datos.total).toBe("12000.00");
      expect(await db.comprobante.findUniqueOrThrow({ where: { idComprobante: reemplazo.id } })).toMatchObject({ reemplazaAId: r.comprobante.id });
      await expect(enTx((tx) => emitirReemplazo(tx, r.comprobante.id))).rejects.toThrow(/ya fue reemplazado/);
    });
  });

  it("(a) una inscripción y un cobro con inscripción del mismo alumno en clases superpuestas, en paralelo: sin interbloqueo", async () => {
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      const alumno = await crearAlumnoDePrueba(db);
      const a = await crearTurnoDePrueba(db, { enDias: 8, hora: "10:00" });
      const b = await crearTurnoDePrueba(db, { enDias: 8, hora: "10:00" });
      // El alumno tuvo una reserva en B que venció sin pagar: en B solo se inscribe pagando.
      await crearInscripcionDePrueba(db, { turnoId: b.idTurno, alumnoId: alumno.idAlumno, estadoPago: "RESERVADA", reservadaEl: new Date(ahora().getTime() - 48 * HORA) });
      const resultados = await Promise.allSettled([
        enTx((tx) => crearInscripcion(tx, { turnoId: a.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(mesa.usuarioId) })),
        cobrar({ alumnoId: alumno.idAlumno, usuarioId: mesa.usuarioId, items: [{ crearInscripcion: { turnoId: b.idTurno }, monto: "12000" }] }),
      ]);
      const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(rechazos).toHaveLength(1);
      expect(rechazos[0]!.reason).toMatchObject({ code: "ALUMNO_NO_DISPONIBLE" });
      expect(await db.turnoAlumno.count({ where: { alumnoId: alumno.idAlumno, vigencia: "VIGENTE" } })).toBe(1);
    }
    await verificarEquivalencia();
  });

  it("(b) inscripciones concurrentes a la última plaza: entra una sola y la clase queda COMPLETO", async () => {
    const turno = await crearTurnoDePrueba(db, { enDias: 9, cupo: 3 });
    for (let i = 0; i < 2; i++) {
      await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: i === 0 ? mesaAlumno[0]! : mesaAlumno[1]!, origen: "CENTRO", conReserva: false, actor: actorUsuario(mesa.usuarioId) }));
    }
    const candidatos = await Promise.all([0, 1, 2, 3, 4, 5].map(() => crearAlumnoDePrueba(db)));
    const resultados = await Promise.allSettled(candidatos.map((alumno) =>
      enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(mesa.usuarioId) }))));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected")) {
      expect(r.reason).toMatchObject({ code: "CUPO_INSUFICIENTE" });
    }
    expect(await db.turnoAlumno.count({ where: { turnoId: turno.idTurno, vigencia: "VIGENTE" } })).toBe(3);
    expect((await db.turno.findUniqueOrThrow({ where: { idTurno: turno.idTurno } })).estadoTurno).toBe("COMPLETO");
  });

  it("(d) comprobantes en concurrencia: números únicos y correlativos, sin huecos si todo confirma", async () => {
    const integrantes = await Promise.all([0, 1, 2, 3].map(() => integranteConCaja()));
    const cobros = [];
    for (const [i, integrante] of [...integrantes, ...integrantes].entries()) {
      const alumno = await crearAlumnoDePrueba(db);
      const turno = await crearTurnoDePrueba(db, { enDias: 10, hora: `${String(8 + i).padStart(2, "0")}:00` });
      const insc = await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(integrante.usuarioId) }));
      cobros.push({ alumnoId: alumno.idAlumno, usuarioId: integrante.usuarioId, inscripcionId: insc.inscripcion.id });
    }
    const resultados = await Promise.all(cobros.map((c) =>
      cobrar({ alumnoId: c.alumnoId, usuarioId: c.usuarioId, items: [{ inscripcionId: c.inscripcionId, monto: "12000" }] })));
    const numeros = resultados.map((r) => r.comprobante.numero).sort((x, y) => x - y);
    expect(new Set(numeros).size).toBe(numeros.length);
    expect(numeros[numeros.length - 1]! - numeros[0]! + 1).toBe(numeros.length);
    for (const r of resultados) {
      const guardado = await db.comprobante.findUniqueOrThrow({ where: { idComprobante: r.comprobante.id } });
      expect(guardado.numero).toBe(r.comprobante.numero);
      expect(ComprobanteDatosSchema.safeParse(guardado.datos).success).toBe(true);
    }
    await verificarEquivalencia();
  });

  // Alumnos para ocupar las dos primeras plazas de (b).
  let mesaAlumno: string[] = [];
  beforeAll(async () => {
    mesaAlumno = [(await crearAlumnoDePrueba(db)).idAlumno, (await crearAlumnoDePrueba(db)).idAlumno];
  });
});
