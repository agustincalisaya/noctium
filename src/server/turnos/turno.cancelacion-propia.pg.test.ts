import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  abrirCajaDePrueba, crearAlumnoDePrueba, crearInscripcionDePrueba,
  crearOperacionDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba, unico,
} from "@/server/testing/fabricas";
import * as bloqueos from "@/server/shared/bloquear";
import { inicioDeTurno } from "@/server/shared/fechas-centro";
import * as historial from "@/server/shared/historial";
import { actorUsuario, REINTENTOS_HISTORIAL } from "@/server/shared/historial";
import { conReloj } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";
import { desactivarAlumno } from "@/server/alumnos/alumno.estado.service";
import { registrarOperacion, type DatosOperacion } from "@/server/pagos/operacion.service";
import { exigeInscripcionConPago } from "@/server/turnos/inscripcion.publico";
import { vencerReservas } from "@/server/turnos/reserva.vencimiento.service";
import { limiteCancelacionEnLinea } from "@/server/turnos/turno.cancelacion-propia";
import { cancelarInscripcionPropia } from "@/server/turnos/turno.cancelacion-propia.service";
import { agregarAlumnoTurno } from "@/server/turnos/turno.service";

const MOMENTO = new Date("2026-10-05T12:00:00.000Z");
const HORA = 3_600_000;

describe.skipIf(!basePgHabilitada)("HU-C-14: cancelación propia en PostgreSQL real", () => {
  let db: PrismaClient;
  let mesaId: string;
  let cajaMesaId: string;
  let formaPagoMesaId: string;
  let plazoPagoOriginal: string | undefined;
  let cancelacionOriginal: string | undefined;

  async function parametro(clave: string, valor: string) {
    await db.parametroSistema.upsert({ where: { clave }, update: { valor }, create: { clave, valor } });
  }
  async function alumno() {
    const usuario = await crearUsuarioDePrueba(db, { rol: "ALUMNO" });
    const ficha = await crearAlumnoDePrueba(db, { usuarioId: usuario.idUsuario });
    return { usuarioId: usuario.idUsuario, alumnoId: ficha.idAlumno };
  }
  const fila = (idInscripcion: string) => db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion } });
  const cancelar = (turnoId: string, usuarioId: string) => cancelarInscripcionPropia(turnoId, usuarioId);
  const limiteDe = (turno: { fechaTurno: Date; horaInicioTurno: Date }) => limiteCancelacionEnLinea(inicioDeTurno(turno), 24);
  const historialDe = (inscripcionId: string) => db.historialInscripcion.findMany({ where: { inscripcionId }, orderBy: { fecha: "asc" } });
  const eventosDe = (turnoId: string) => db.eventoTurno.findMany({ where: { turnoId }, orderBy: { creadoEnEvento: "asc" } });
  async function pagar(inscripcionId: string) {
    await crearOperacionDePrueba(db, { cajaId: cajaMesaId, inscripcionIds: [inscripcionId], formaPagoId: formaPagoMesaId });
  }
  /** Inscripción PAGADA con su pago real: mantiene «Pagada ⇔ al menos un pago no anulado» para las demás suites de la misma base. */
  async function inscripcionPagada(turnoId: string, alumnoId: string) {
    const inscripcion = await crearInscripcionDePrueba(db, { turnoId, alumnoId, reservadaEl: MOMENTO });
    await pagar(inscripcion.idInscripcion);
    return fila(inscripcion.idInscripcion).then((guardada) => ({ ...guardada, idInscripcion: inscripcion.idInscripcion }));
  }
  async function completo(turnoId: string) {
    await db.turno.update({ where: { idTurno: turnoId }, data: { estadoTurno: "COMPLETO" } });
  }

  /** Integrante de mesa de entrada con caja abierta y una forma de pago en efectivo propia de la prueba. */
  const cobradorConCaja = async () => {
    const usuarioId = (await crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA" })).idUsuario;
    await abrirCajaDePrueba(db, { usuarioId });
    const nombre = unico("Efectivo C14 ");
    const forma = await db.formaPago.create({ data: { nombreFormaPago: nombre, nombreNormalizadaFormaPago: nombre.toLowerCase(), esEfectivo: true } });
    return { usuarioId, formaPagoId: forma.idFormaPago };
  };
  const cobrar = (cobrador: { usuarioId: string; formaPagoId: string }, alumnoId: string, item: DatosOperacion["items"][number]) =>
    transaccion((tx) => registrarOperacion(tx, { alumnoId, usuarioId: cobrador.usuarioId, modo: "completo", formaPagoId: cobrador.formaPagoId, items: [item] }));

  /** Sondea `pg_stat_activity` hasta que `n` sesiones esperan un bloqueo de fila: la otra operación ya está esperando en la base. */
  const esperarBloqueados = async (n = 1) => {
    for (let intento = 0; intento < 400; intento++) {
      const [{ c }] = await db.$queryRaw<{ c: bigint }[]>`
        SELECT count(*) AS c FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (Number(c) >= n) return;
      await new Promise((resolver) => setTimeout(resolver, 25));
    }
    throw new Error(`Ninguna de las ${n} sesiones llegó a esperar un bloqueo`);
  };

  /** Pausa la primera llamada a `bloquear` que incluye la clase `turnoId`, después de tomar el bloqueo. */
  function pausarBloqueoDe(turnoId: string) {
    let soltar!: () => void;
    let tomado!: () => void;
    const listo = new Promise<void>((r) => { tomado = r; });
    const espera = new Promise<void>((r) => { soltar = r; });
    const original = bloqueos.bloquear;
    let pendiente = true;
    const espia = vi.spyOn(bloqueos, "bloquear").mockImplementation(async (tx, input) => {
      const resultado = await original(tx, input);
      if (pendiente && input.clases?.includes(turnoId)) { pendiente = false; tomado(); await espera; }
      return resultado;
    });
    return { listo, soltar: () => soltar(), restaurar: () => espia.mockRestore() };
  }

  /**
   * Intercalado forzado en dos conexiones: `primera` toma el bloqueo de la clase y deja la transacción abierta;
   * las `siguientes` se lanzan entonces y esperan en la base (se comprueba en `pg_stat_activity`);
   * recién después se suelta a `primera`. Devuelve los resultados en el orden `[primera, ...siguientes]`.
   */
  async function intercalar(turnoId: string, primera: () => Promise<unknown>, ...siguientes: (() => Promise<unknown>)[]) {
    const pausa = pausarBloqueoDe(turnoId);
    try {
      const gana = primera();
      await Promise.race([pausa.listo, gana.then(() => { throw new Error("la primera operación terminó sin tomar el bloqueo de la clase"); })]);
      const esperan = siguientes.map((siguiente) => siguiente());
      try { await esperarBloqueados(siguientes.length); } finally { pausa.soltar(); }
      return await Promise.allSettled([gana, ...esperan]);
    } finally {
      pausa.restaurar();
    }
  }

  beforeAll(async () => {
    db = clientePg();
    mesaId = (await crearUsuarioDePrueba(db)).idUsuario;
    cajaMesaId = (await abrirCajaDePrueba(db, { usuarioId: mesaId })).idCaja;
    const nombreForma = unico("fp");
    formaPagoMesaId = (await db.formaPago.create({ data: { nombreFormaPago: nombreForma, nombreNormalizadaFormaPago: nombreForma } })).idFormaPago;
    plazoPagoOriginal = (await db.parametroSistema.findUnique({ where: { clave: "plazo_pago_horas" } }))?.valor;
    cancelacionOriginal = (await db.parametroSistema.findUnique({ where: { clave: "cancelacion_anticipacion_horas" } }))?.valor;
  });
  beforeEach(async () => {
    await parametro("plazo_pago_horas", "24");
    await parametro("cancelacion_anticipacion_horas", "24");
  });
  afterAll(async () => {
    if (db) {
      await parametro("plazo_pago_horas", plazoPagoOriginal ?? "24");
      await parametro("cancelacion_anticipacion_horas", cancelacionOriginal ?? "24");
      await db.$disconnect();
    }
    await prisma.$disconnect();
  });

  it("cancela una inscripción pagada dentro del plazo: conserva el pago, libera cupo, escribe el historial y emite los eventos completos", async () => {
    await conReloj(MOMENTO, async () => {
      const propio = await alumno();
      const turno = await crearTurnoDePrueba(db, { enDias: 5, cupo: 1 });
      await completo(turno.idTurno);
      const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "RESERVADA", reservadaEl: MOMENTO });
      await pagar(inscripcion.idInscripcion);
      const resultado = await cancelar(turno.idTurno, propio.usuarioId);
      expect(resultado).toEqual({
        id: turno.idTurno, inscripcion_id: inscripcion.idInscripcion, vigencia: "CANCELADA_ALUMNO", con_pagos: true, alumnos_inscriptos: "0/1", estado: "DISPONIBLE",
      });
      const guardada = await fila(inscripcion.idInscripcion);
      expect(guardada).toMatchObject({
        vigencia: "CANCELADA_ALUMNO", finalizadaEl: MOMENTO, finalizadaPorActorTipo: "USUARIO", finalizadaPorUsuarioId: propio.usuarioId, estadoPago: "PAGADA",
      });
      expect(await historialDe(inscripcion.idInscripcion)).toEqual(expect.arrayContaining([
        expect.objectContaining({
          vigenciaAnterior: "VIGENTE", vigenciaNueva: "CANCELADA_ALUMNO", estadoPagoAnterior: "PAGADA", estadoPagoNuevo: "PAGADA",
          actorTipo: "USUARIO", usuarioId: propio.usuarioId, fecha: MOMENTO,
        }),
      ]));
      expect(await db.reservaTurno.count({ where: { turnoId: turno.idTurno, tipoRecurso: "ALUMNO", recursoId: propio.alumnoId } })).toBe(0);
      expect(await db.pago.count({ where: { inscripcionId: inscripcion.idInscripcion } })).toBe(1);
      const eventos = await eventosDe(turno.idTurno);
      expect(eventos.map((e) => e.tipoEvento)).toEqual(["turno:inscripcion_cancelada", "turno:disponible_nuevamente"]);
      expect(eventos.every((e) => e.usuarioId === propio.usuarioId)).toBe(true);
      expect(eventos[0]!.payloadEvento).toEqual({
        turno_id: turno.idTurno, alumno_id: propio.alumnoId, inscripcion_id: inscripcion.idInscripcion, estado_pago: "PAGADA", usuario_id: propio.usuarioId,
      });
      expect(eventos[1]!.payloadEvento).toEqual({
        turno_id: turno.idTurno, alumno_id_liberado: propio.alumnoId, usuario_id: propio.usuarioId,
      });
    });
  });

  it("cancela una reserva sin pagar antes del vencimiento y bloquea la re-reserva en línea", async () => {
    await conReloj(MOMENTO, async () => {
      const propio = await alumno();
      const turno = await crearTurnoDePrueba(db, { enDias: 5 });
      const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "RESERVADA", reservadaEl: MOMENTO });
      const venceEl = inscripcion.venceEl!;
      const antes = new Date(venceEl.getTime() - HORA);
      await conReloj(antes, async () => {
        const resultado = await cancelar(turno.idTurno, propio.usuarioId);
        expect(resultado).toMatchObject({ vigencia: "CANCELADA_ALUMNO", con_pagos: false });
      });
      expect(await exigeInscripcionConPago(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId })).toEqual({ exige: true, motivo: "CANCELADA_SIN_PAGO" });
    });
  });

  it("al cancelar una inscripción pagada, sin reserva o reabierta por anulación, el alumno puede volver a reservar en línea (no exige pago)", async () => {
    await conReloj(MOMENTO, async () => {
      const propio = await alumno();
      const casos = [
        { estadoPago: "PAGADA" as const, reabierta: false },
        { estadoPago: "PAGO_SIN_REGISTRAR" as const, reabierta: false },
        { estadoPago: "RESERVADA" as const, reabierta: true },
      ];
      for (const [indice, caso] of casos.entries()) {
        const turno = await crearTurnoDePrueba(db, { enDias: 5, hora: `${10 + indice}:00` });
        const inscripcion = caso.estadoPago === "PAGADA"
          ? await inscripcionPagada(turno.idTurno, propio.alumnoId)
          : await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: caso.estadoPago, reservadaEl: MOMENTO });
        if (caso.reabierta) await db.turnoAlumno.update({ where: { idInscripcion: inscripcion.idInscripcion }, data: { reabiertaPorAnulacion: true } });
        await cancelar(turno.idTurno, propio.usuarioId);
        expect((await fila(inscripcion.idInscripcion)).vigencia).toBe("CANCELADA_ALUMNO");
        expect(await exigeInscripcionConPago(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId })).toEqual({ exige: false, motivo: null });
      }
    });
  });

  describe("borde exacto de la anticipación mínima (24 h, inclusive)", () => {
    it.each([
      ["un milisegundo antes del límite", -1, true],
      ["el instante exacto del límite", 0, true],
      ["un milisegundo después del límite", 1, false],
    ] as const)("inscripción pagada, %s", async (_caso, desfase, permitida) => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 3, hora: "13:00" }); // inicio 08/10 16:00Z; límite 07/10 16:00Z
        const limite = limiteDe(turno);
        expect(limite).toEqual(new Date("2026-10-07T16:00:00.000Z"));
        const inscripcion = await inscripcionPagada(turno.idTurno, propio.alumnoId);
        await conReloj(new Date(limite.getTime() + desfase), async () => {
          if (permitida) {
            await expect(cancelar(turno.idTurno, propio.usuarioId)).resolves.toMatchObject({ vigencia: "CANCELADA_ALUMNO", con_pagos: true });
          } else {
            await expect(cancelar(turno.idTurno, propio.usuarioId)).rejects.toMatchObject({ code: "CANCELACION_FUERA_DE_PLAZO", status: 409 });
          }
        });
        expect((await fila(inscripcion.idInscripcion)).vigencia).toBe(permitida ? "CANCELADA_ALUMNO" : "VIGENTE");
        expect(await historialDe(inscripcion.idInscripcion)).toHaveLength(permitida ? 1 : 0);
      });
    });

    it("el límite sale de la anticipación vigente al momento de cancelar, no de la que había al inscribirse", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 3, hora: "13:00" });
        await inscripcionPagada(turno.idTurno, propio.alumnoId);
        await parametro("cancelacion_anticipacion_horas", "72"); // límite 05/10 16:00Z, ya pasado a las 17:00Z
        await conReloj(new Date(MOMENTO.getTime() + 5 * HORA), async () => {
          await expect(cancelar(turno.idTurno, propio.usuarioId)).rejects.toMatchObject({ code: "CANCELACION_FUERA_DE_PLAZO" });
        });
      });
    });

    it.each([
      ["un milisegundo antes del vencimiento", -1, true],
      ["el instante exacto del vencimiento", 0, false],
      ["un segundo después del vencimiento", 1000, false],
    ] as const)("reserva sin pagar pasado el límite de anticipación, %s", async (_caso, desfase, permitida) => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 1, hora: "11:00" }); // inicio 06/10 14:00Z; límite 05/10 14:00Z
        const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "RESERVADA", reservadaEl: MOMENTO });
        const venceEl = inscripcion.venceEl!;
        expect(venceEl.getTime()).toBeGreaterThan(limiteDe(turno).getTime());
        await conReloj(new Date(venceEl.getTime() + desfase), async () => {
          if (permitida) {
            await expect(cancelar(turno.idTurno, propio.usuarioId)).resolves.toMatchObject({ vigencia: "CANCELADA_ALUMNO", con_pagos: false });
          } else {
            await expect(cancelar(turno.idTurno, propio.usuarioId)).rejects.toMatchObject({ code: "INSCRIPCION_NO_VIGENTE" });
          }
        });
        // Al rechazar se revierte la transacción: el vencimiento que había marcado no persiste (lo marcará el proceso automático).
        expect((await fila(inscripcion.idInscripcion)).vigencia).toBe(permitida ? "CANCELADA_ALUMNO" : "VIGENTE");
      });
    });
  });

  it("la anticipación se recalcula con el inicio nuevo cuando la clase se reprograma", async () => {
    await conReloj(MOMENTO, async () => {
      const lejana = await crearTurnoDePrueba(db, { enDias: 6, hora: "10:00" });
      const cercana = await crearTurnoDePrueba(db, { enDias: 1, hora: "10:00" });
      const delAlumnoDeLejana = await alumno();
      const delAlumnoDeCercana = await alumno();
      const iLejana = await inscripcionPagada(lejana.idTurno, delAlumnoDeLejana.alumnoId);
      const iCercana = await inscripcionPagada(cercana.idTurno, delAlumnoDeCercana.alumnoId);
      // Reprogramación: solo cambian fecha y hora (la lejana pasa a mañana y la cercana a dentro de 6 días).
      await db.turno.update({ where: { idTurno: lejana.idTurno }, data: { fechaTurno: cercana.fechaTurno } });
      await db.turno.update({ where: { idTurno: cercana.idTurno }, data: { fechaTurno: lejana.fechaTurno } });
      await conReloj(new Date(MOMENTO.getTime() + 3 * HORA), async () => {
        await expect(cancelar(lejana.idTurno, delAlumnoDeLejana.usuarioId)).rejects.toMatchObject({ code: "CANCELACION_FUERA_DE_PLAZO" });
        await expect(cancelar(cercana.idTurno, delAlumnoDeCercana.usuarioId)).resolves.toMatchObject({ vigencia: "CANCELADA_ALUMNO" });
      });
      expect((await fila(iLejana.idInscripcion)).vigencia).toBe("VIGENTE");
      expect((await fila(iCercana.idInscripcion)).vigencia).toBe("CANCELADA_ALUMNO");
    });
  });

  it("alumnos_inscriptos sale de la regla de ocupación: una reserva vencida sin marcar no cuenta", async () => {
    await conReloj(MOMENTO, async () => {
      const propio = await alumno();
      const otro = await alumno();
      const conReservaVencida = await alumno();
      const turno = await crearTurnoDePrueba(db, { enDias: 5, cupo: 3 });
      await inscripcionPagada(turno.idTurno, propio.alumnoId);
      await inscripcionPagada(turno.idTurno, otro.alumnoId);
      const vencida = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: conReservaVencida.alumnoId, estadoPago: "RESERVADA", reservadaEl: MOMENTO, plazoHoras: 1 });
      await conReloj(new Date(vencida.venceEl!.getTime() + 1000), async () => {
        await expect(cancelar(turno.idTurno, propio.usuarioId)).resolves.toMatchObject({ alumnos_inscriptos: "1/3", estado: "DISPONIBLE" });
      });
      expect((await fila(vencida.idInscripcion)).vigencia).toBe("RESERVA_VENCIDA");
    });
  });

  describe("rechazos, en el orden de C §2.19", () => {
    it("rechaza una segunda cancelación de la misma inscripción", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 5 });
        await inscripcionPagada(turno.idTurno, propio.alumnoId);
        await cancelar(turno.idTurno, propio.usuarioId);
        await expect(cancelar(turno.idTurno, propio.usuarioId)).rejects.toMatchObject({ code: "INSCRIPCION_NO_VIGENTE", status: 409 });
      });
    });

    it("rechaza cancelar una clase cancelada por el centro", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 5, estado: "CANCELADO" });
        await inscripcionPagada(turno.idTurno, propio.alumnoId);
        await expect(cancelar(turno.idTurno, propio.usuarioId)).rejects.toMatchObject({ code: "TURNO_CANCELADO", status: 409 });
      });
    });

    it("una clase cancelada que además ya pasó responde TURNO_CANCELADO (la clase cancelada se evalúa antes que la vencida)", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: -1, estado: "CANCELADO" });
        await inscripcionPagada(turno.idTurno, propio.alumnoId);
        await expect(cancelar(turno.idTurno, propio.usuarioId)).rejects.toMatchObject({ code: "TURNO_CANCELADO" });
      });
    });

    it("rechaza cancelar una clase que ya empezó, incluso en el instante exacto del inicio", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 0, hora: "09:00" }); // inicio = 2026-10-05T12:00Z = MOMENTO
        await inscripcionPagada(turno.idTurno, propio.alumnoId);
        expect(inicioDeTurno(turno)).toEqual(MOMENTO);
        await expect(cancelar(turno.idTurno, propio.usuarioId)).rejects.toMatchObject({ code: "TURNO_VENCIDO", status: 409 });
      });
    });

    it("una clase sin confirmar (PENDIENTE) no es cancelable y responde su motivo real, no TURNO_VENCIDO", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 5, estado: "PENDIENTE" });
        await inscripcionPagada(turno.idTurno, propio.alumnoId);
        await expect(cancelar(turno.idTurno, propio.usuarioId)).rejects.toMatchObject({ code: "TURNO_PENDIENTE", status: 409 });
      });
    });

    it("responde 404 si la clase no existe y 404 si el alumno nunca estuvo inscripto en ella", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        await expect(cancelar("clase-inexistente", propio.usuarioId)).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO", status: 404 });
        const turno = await crearTurnoDePrueba(db, { enDias: 5 });
        await expect(cancelar(turno.idTurno, propio.usuarioId)).rejects.toMatchObject({ code: "INSCRIPCION_NO_ENCONTRADA", status: 404 });
      });
    });

    it("responde SIN_PERMISO si la cuenta no tiene ficha de alumno", async () => {
      await conReloj(MOMENTO, async () => {
        const sinFicha = await crearUsuarioDePrueba(db, { rol: "ALUMNO" });
        const turno = await crearTurnoDePrueba(db, { enDias: 5 });
        await expect(cancelar(turno.idTurno, sinFicha.idUsuario)).rejects.toMatchObject({ code: "SIN_PERMISO" });
      });
    });

    it("un alumno no puede cancelar la inscripción de otro: la identidad sale de la sesión", async () => {
      await conReloj(MOMENTO, async () => {
        const duenio = await alumno();
        const intruso = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 5 });
        const inscripcion = await inscripcionPagada(turno.idTurno, duenio.alumnoId);
        await expect(cancelar(turno.idTurno, intruso.usuarioId)).rejects.toMatchObject({ code: "INSCRIPCION_NO_ENCONTRADA" });
        expect((await fila(inscripcion.idInscripcion)).vigencia).toBe("VIGENTE");
        expect(await historialDe(inscripcion.idInscripcion)).toHaveLength(0);
        expect(await eventosDe(turno.idTurno)).toHaveLength(0);
      });
    });
  });

  describe("concurrencia con intercalado forzado (dos conexiones: una retiene el bloqueo y la otra espera en la base)", () => {
    const TARDE = new Date(MOMENTO.getTime() + 3 * HORA); // 15:00Z

    it("un pago de HU-I-10 registrado antes de que el POST evalúe, fuera de plazo: deja de regir la excepción de la reserva y responde CANCELACION_FUERA_DE_PLAZO", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 1, hora: "11:00" }); // inicio 06/10 14:00Z; límite 05/10 14:00Z
        const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "RESERVADA", reservadaEl: MOMENTO });
        const cobrador = await cobradorConCaja();
        await conReloj(TARDE, async () => {
          const [cobro, cancelacion] = await intercalar(
            turno.idTurno,
            () => cobrar(cobrador, propio.alumnoId, { inscripcionId: inscripcion.idInscripcion, monto: "12000" }),
            () => cancelar(turno.idTurno, propio.usuarioId),
          );
          expect(cobro.status).toBe("fulfilled");
          expect(cancelacion).toMatchObject({ status: "rejected", reason: { code: "CANCELACION_FUERA_DE_PLAZO", status: 409 } });
        });
        expect(await fila(inscripcion.idInscripcion)).toMatchObject({ vigencia: "VIGENTE", estadoPago: "PAGADA", venceEl: null });
        expect(await db.pago.count({ where: { inscripcionId: inscripcion.idInscripcion } })).toBe(1);
      });
    });

    it("un pago registrado antes de que el POST evalúe, dentro de plazo: cancela con con_pagos y el pago queda intacto", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 5 });
        const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "RESERVADA", reservadaEl: MOMENTO });
        const cobrador = await cobradorConCaja();
        await conReloj(TARDE, async () => {
          const [cobro, cancelacion] = await intercalar(
            turno.idTurno,
            () => cobrar(cobrador, propio.alumnoId, { inscripcionId: inscripcion.idInscripcion, monto: "12000" }),
            () => cancelar(turno.idTurno, propio.usuarioId),
          );
          expect(cobro.status).toBe("fulfilled");
          expect(cancelacion).toMatchObject({ status: "fulfilled", value: { vigencia: "CANCELADA_ALUMNO", con_pagos: true } });
        });
        expect(await fila(inscripcion.idInscripcion)).toMatchObject({ vigencia: "CANCELADA_ALUMNO", estadoPago: "PAGADA" });
        const pagos = await db.pago.findMany({ where: { inscripcionId: inscripcion.idInscripcion } });
        expect(pagos).toHaveLength(1);
        expect(await db.anulacionPago.count({ where: { pagoId: pagos[0]!.idPago } })).toBe(0);
      });
    });

    it("la cancelación gana al pago: el cobro se rechaza y no queda ningún pago", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 5 });
        const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "RESERVADA", reservadaEl: MOMENTO });
        const cobrador = await cobradorConCaja();
        await conReloj(TARDE, async () => {
          const [cancelacion, cobro] = await intercalar(
            turno.idTurno,
            () => cancelar(turno.idTurno, propio.usuarioId),
            () => cobrar(cobrador, propio.alumnoId, { inscripcionId: inscripcion.idInscripcion, monto: "12000" }),
          );
          expect(cancelacion).toMatchObject({ status: "fulfilled", value: { con_pagos: false } });
          expect(cobro).toMatchObject({ status: "rejected", reason: { code: "ALUMNO_NO_INSCRIPTO" } });
        });
        expect(await fila(inscripcion.idInscripcion)).toMatchObject({ vigencia: "CANCELADA_ALUMNO", estadoPago: "RESERVADA" });
        expect(await db.pago.count({ where: { alumnoId: propio.alumnoId } })).toBe(0);
      });
    });

    it("dos cancelaciones simultáneas (intercalado forzado): una se confirma y la otra recibe INSCRIPCION_NO_VIGENTE", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 5 });
        const inscripcion = await inscripcionPagada(turno.idTurno, propio.alumnoId);
        const [primera, segunda] = await intercalar(
          turno.idTurno,
          () => cancelar(turno.idTurno, propio.usuarioId),
          () => cancelar(turno.idTurno, propio.usuarioId),
        );
        expect(primera.status).toBe("fulfilled");
        expect(segunda).toMatchObject({ status: "rejected", reason: { code: "INSCRIPCION_NO_VIGENTE", status: 409 } });
        expect(await historialDe(inscripcion.idInscripcion)).toHaveLength(1);
        expect((await eventosDe(turno.idTurno)).filter((e) => e.tipoEvento === "turno:inscripcion_cancelada")).toHaveLength(1);
      });
    });

    it("dos cancelaciones lanzadas a la vez con Promise.all: exactamente una exitosa y la otra INSCRIPCION_NO_VIGENTE", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 5 });
        const inscripcion = await inscripcionPagada(turno.idTurno, propio.alumnoId);
        const resultados = await Promise.allSettled([cancelar(turno.idTurno, propio.usuarioId), cancelar(turno.idTurno, propio.usuarioId)]);
        expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(resultados.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "INSCRIPCION_NO_VIGENTE" } });
        expect(await historialDe(inscripcion.idInscripcion)).toHaveLength(1);
      });
    });

    it("cancelación contra el alta de otro alumno en la misma clase — gana la cancelación: el lugar liberado lo ocupa el alta", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const otro = await crearAlumnoDePrueba(db);
        const turno = await crearTurnoDePrueba(db, { enDias: 5, cupo: 1 });
        await completo(turno.idTurno);
        await inscripcionPagada(turno.idTurno, propio.alumnoId);
        const [cancelacion, alta] = await intercalar(
          turno.idTurno,
          () => cancelar(turno.idTurno, propio.usuarioId),
          () => agregarAlumnoTurno(turno.idTurno, { alumno_id: otro.idAlumno }, mesaId),
        );
        expect(cancelacion.status).toBe("fulfilled");
        expect(alta).toMatchObject({ status: "fulfilled", value: { alumno_id: otro.idAlumno, estado: "COMPLETO" } });
        const vigentes = await db.turnoAlumno.findMany({ where: { turnoId: turno.idTurno, vigencia: "VIGENTE" } });
        expect(vigentes.map((v) => v.alumnoId)).toEqual([otro.idAlumno]);
      });
    });

    it("cancelación contra el alta de otro alumno en la misma clase — gana el alta: la clase estaba completa, el alta se rechaza y la cancelación se confirma", async () => {
      await conReloj(MOMENTO, async () => {
        const propio = await alumno();
        const otro = await crearAlumnoDePrueba(db);
        const turno = await crearTurnoDePrueba(db, { enDias: 5, cupo: 1 });
        await completo(turno.idTurno);
        const inscripcion = await inscripcionPagada(turno.idTurno, propio.alumnoId);
        const [alta, cancelacion] = await intercalar(
          turno.idTurno,
          () => agregarAlumnoTurno(turno.idTurno, { alumno_id: otro.idAlumno }, mesaId),
          () => cancelar(turno.idTurno, propio.usuarioId),
        );
        expect(alta).toMatchObject({ status: "rejected", reason: { code: "CUPO_INSUFICIENTE" } });
        expect(cancelacion).toMatchObject({ status: "fulfilled", value: { alumnos_inscriptos: "0/1", estado: "DISPONIBLE" } });
        expect((await fila(inscripcion.idInscripcion)).vigencia).toBe("CANCELADA_ALUMNO");
        expect(await db.turnoAlumno.count({ where: { turnoId: turno.idTurno, alumnoId: otro.idAlumno } })).toBe(0);
      });
    });

    describe("contra la baja del alumno (HU-B-07)", () => {
      const darBaja = (alumnoId: string) => desactivarAlumno(alumnoId, { version: 0, motivo: "Baja de prueba" }, actorUsuario(mesaId));

      it("gana la cancelación: la baja ya no encuentra la inscripción y no la pisa", async () => {
        await conReloj(MOMENTO, async () => {
          const propio = await alumno();
          const turno = await crearTurnoDePrueba(db, { enDias: 5 });
          const inscripcion = await inscripcionPagada(turno.idTurno, propio.alumnoId);
          const [cancelacion, baja] = await intercalar(turno.idTurno, () => cancelar(turno.idTurno, propio.usuarioId), () => darBaja(propio.alumnoId));
          expect(cancelacion.status).toBe("fulfilled");
          expect(baja).toMatchObject({ status: "fulfilled", value: { activo: false, inscripciones_quitadas: 0 } });
          expect((await fila(inscripcion.idInscripcion)).vigencia).toBe("CANCELADA_ALUMNO");
          expect((await historialDe(inscripcion.idInscripcion)).map((h) => h.vigenciaNueva)).toEqual(["CANCELADA_ALUMNO"]);
        });
      });

      it("gana la baja: la cancelación, que había leído la inscripción vigente, responde INSCRIPCION_NO_VIGENTE", async () => {
        await conReloj(MOMENTO, async () => {
          const propio = await alumno();
          const turno = await crearTurnoDePrueba(db, { enDias: 5 });
          const inscripcion = await inscripcionPagada(turno.idTurno, propio.alumnoId);
          const [baja, cancelacion] = await intercalar(turno.idTurno, () => darBaja(propio.alumnoId), () => cancelar(turno.idTurno, propio.usuarioId));
          expect(baja).toMatchObject({ status: "fulfilled", value: { inscripciones_quitadas: 1 } });
          expect(cancelacion).toMatchObject({ status: "rejected", reason: { code: "INSCRIPCION_NO_VIGENTE" } });
          expect((await fila(inscripcion.idInscripcion)).vigencia).toBe("BAJA_ALUMNO");
          expect((await historialDe(inscripcion.idInscripcion)).map((h) => h.vigenciaNueva)).toEqual(["BAJA_ALUMNO"]);
        });
      });
    });

    describe("contra el vencimiento automático de reservas (HU-C-24)", () => {
      /** Reserva de una clase lejana y los dos instantes: la cancelación evalúa antes del vencimiento y el proceso, después. */
      async function reservaConRelojes() {
        const propio = await alumno();
        const turno = await crearTurnoDePrueba(db, { enDias: 5 });
        const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "RESERVADA", reservadaEl: MOMENTO });
        const venceEl = inscripcion.venceEl!;
        return { propio, turno, inscripcion, antes: new Date(venceEl.getTime() - HORA), despues: new Date(venceEl.getTime() + HORA) };
      }

      it("gana la cancelación: el proceso no vence la reserva ya cancelada", async () => {
        await conReloj(MOMENTO, async () => {
          const { propio, turno, inscripcion, antes, despues } = await reservaConRelojes();
          const [cancelacion, proceso] = await intercalar(
            turno.idTurno,
            () => conReloj(antes, () => cancelar(turno.idTurno, propio.usuarioId)),
            () => conReloj(despues, () => vencerReservas(despues)),
          );
          expect(cancelacion.status).toBe("fulfilled");
          expect(proceso.status).toBe("fulfilled");
          expect((await fila(inscripcion.idInscripcion)).vigencia).toBe("CANCELADA_ALUMNO");
          expect((await historialDe(inscripcion.idInscripcion)).map((h) => h.vigenciaNueva)).toEqual(["CANCELADA_ALUMNO"]);
        });
      });

      it("gana el proceso: la reserva queda vencida y la cancelación responde INSCRIPCION_NO_VIGENTE", async () => {
        await conReloj(MOMENTO, async () => {
          const { propio, turno, inscripcion, antes, despues } = await reservaConRelojes();
          const [proceso, cancelacion] = await intercalar(
            turno.idTurno,
            () => conReloj(despues, () => vencerReservas(despues)),
            () => conReloj(antes, () => cancelar(turno.idTurno, propio.usuarioId)),
          );
          expect(proceso.status).toBe("fulfilled");
          expect(cancelacion).toMatchObject({ status: "rejected", reason: { code: "INSCRIPCION_NO_VIGENTE" } });
          expect((await fila(inscripcion.idInscripcion)).vigencia).toBe("RESERVA_VENCIDA");
          expect((await historialDe(inscripcion.idInscripcion)).map((h) => h.vigenciaNueva)).toEqual(["RESERVA_VENCIDA"]);
        });
      });
    });
  });

  describe("historial y eventos de la clase: después del commit, nunca dentro de la transacción", () => {
    async function escenarioPagado() {
      const propio = await alumno();
      const turno = await crearTurnoDePrueba(db, { enDias: 5 });
      const inscripcion = await inscripcionPagada(turno.idTurno, propio.alumnoId);
      return { propio, turno, inscripcion };
    }

    it("un fallo después de encolar el historial y el evento, y antes del commit, revierte la cancelación y no deja filas", async () => {
      await conReloj(MOMENTO, async () => {
        const { propio, turno, inscripcion } = await escenarioPagado();
        const original = historial.encolarHistorial;
        const fallo = vi.spyOn(historial, "encolarHistorial").mockImplementation((tx, datos, opciones) => {
          const registro = original(tx, datos, opciones);
          if (datos.tipo === "EVENTO_TURNO") throw new Error("fallo inyectado después de encolar el evento");
          return registro;
        });
        try {
          await expect(cancelar(turno.idTurno, propio.usuarioId)).rejects.toThrow("fallo inyectado después de encolar el evento");
        } finally { fallo.mockRestore(); }
        expect((await fila(inscripcion.idInscripcion)).vigencia).toBe("VIGENTE");
        expect(await historialDe(inscripcion.idInscripcion)).toHaveLength(0);
        expect(await eventosDe(turno.idTurno)).toHaveLength(0);
      });
    });

    it("los eventos se escriben cuando la cancelación ya es visible desde otra conexión, no antes", async () => {
      await conReloj(MOMENTO, async () => {
        const { propio, turno, inscripcion } = await escenarioPagado();
        const original = prisma.eventoTurno.createMany.bind(prisma.eventoTurno);
        const visibles: boolean[] = [];
        const escritor = vi.spyOn(prisma.eventoTurno, "createMany").mockImplementation(((args: Parameters<typeof original>[0]) =>
          db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: inscripcion.idInscripcion } }).then((guardada) => {
            visibles.push(guardada.vigencia === "CANCELADA_ALUMNO");
            return original(args);
          })) as unknown as typeof prisma.eventoTurno.createMany);
        try { await cancelar(turno.idTurno, propio.usuarioId); } finally { escritor.mockRestore(); }
        expect(visibles).toEqual([true]);
        expect(await eventosDe(turno.idTurno)).toHaveLength(1);
      });
    });

    it("si el escritor de eventos falla después del commit, la cancelación responde bien, se reintenta hasta escribirse y no se deshace", async () => {
      await conReloj(MOMENTO, async () => {
        const { propio, turno, inscripcion } = await escenarioPagado();
        const escritor = vi.spyOn(prisma.eventoTurno, "createMany")
          .mockRejectedValueOnce(new Error("fallo del escritor 1"))
          .mockRejectedValueOnce(new Error("fallo del escritor 2"));
        let intentos = 0;
        try {
          await expect(cancelar(turno.idTurno, propio.usuarioId)).resolves.toMatchObject({ vigencia: "CANCELADA_ALUMNO" });
          intentos = escritor.mock.calls.length;
        } finally { escritor.mockRestore(); }
        expect(intentos).toBe(3);
        expect((await fila(inscripcion.idInscripcion)).vigencia).toBe("CANCELADA_ALUMNO");
        expect((await eventosDe(turno.idTurno)).map((e) => e.tipoEvento)).toEqual(["turno:inscripcion_cancelada"]);
      });
    });

    it("si el escritor de eventos falla siempre, agota los reintentos, registra el error y la cancelación confirmada responde igual", async () => {
      await conReloj(MOMENTO, async () => {
        const { propio, turno, inscripcion } = await escenarioPagado();
        const consola = vi.spyOn(console, "error").mockImplementation(() => {});
        const escritor = vi.spyOn(prisma.eventoTurno, "createMany").mockRejectedValue(new Error("base sin respuesta"));
        let intentos = 0;
        try {
          await expect(cancelar(turno.idTurno, propio.usuarioId)).resolves.toMatchObject({ vigencia: "CANCELADA_ALUMNO", con_pagos: true });
          intentos = escritor.mock.calls.length;
          expect(consola).toHaveBeenCalledWith("[historial] no se pudo registrar", expect.objectContaining({ tipo: "EVENTO_TURNO", intentos: REINTENTOS_HISTORIAL + 1, error: "base sin respuesta" }));
        } finally { escritor.mockRestore(); consola.mockRestore(); }
        expect(intentos).toBe(REINTENTOS_HISTORIAL + 1);
        expect((await fila(inscripcion.idInscripcion)).vigencia).toBe("CANCELADA_ALUMNO");
        expect(await historialDe(inscripcion.idInscripcion)).toHaveLength(1);
        expect(await eventosDe(turno.idTurno)).toHaveLength(0);
      });
    });
  });
});
