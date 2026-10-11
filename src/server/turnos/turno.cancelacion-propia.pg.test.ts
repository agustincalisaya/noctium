import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  abrirCajaDePrueba, crearAlumnoDePrueba, crearInscripcionDePrueba,
  crearOperacionDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba, unico,
} from "@/server/testing/fabricas";
import { conReloj } from "@/server/shared/reloj";
import { cancelarInscripcionPropia } from "@/server/turnos/turno.cancelacion-propia.service";
import { exigeInscripcionConPago } from "@/server/turnos/inscripcion.publico";

const MOMENTO = new Date("2026-10-05T12:00:00.000Z");
const HORA = 3_600_000;

describe.skipIf(!basePgHabilitada)("HU-C-14: cancelación propia en PostgreSQL real", () => {
  let db: PrismaClient;
  let mesaId: string;
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
  async function pagar(inscripcionId: string) {
    const caja = await abrirCajaDePrueba(db, { usuarioId: mesaId });
    const nombre = unico("fp");
    const forma = await db.formaPago.create({ data: { nombreFormaPago: nombre, nombreNormalizadaFormaPago: nombre } });
    await crearOperacionDePrueba(db, { cajaId: caja.idCaja, inscripcionIds: [inscripcionId], formaPagoId: forma.idFormaPago });
  }
  async function completo(turnoId: string) {
    await db.turno.update({ where: { idTurno: turnoId }, data: { estadoTurno: "COMPLETO" } });
  }

  beforeAll(async () => {
    db = clientePg();
    mesaId = (await crearUsuarioDePrueba(db)).idUsuario;
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

  it("cancela una inscripción pagada dentro del plazo: conserva el pago, libera cupo y emite evento", async () => {
    await conReloj(MOMENTO, async () => {
      const propio = await alumno();
      const turno = await crearTurnoDePrueba(db, { enDias: 5, cupo: 1 });
      await completo(turno.idTurno);
      const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "RESERVADA", reservadaEl: MOMENTO });
      await pagar(inscripcion.idInscripcion);
      const resultado = await cancelarInscripcionPropia(turno.idTurno, propio.usuarioId);
      expect(resultado).toMatchObject({
        id: turno.idTurno, vigencia: "CANCELADA_ALUMNO", con_pagos: true, alumnos_inscriptos: "0/1", estado: "DISPONIBLE",
      });
      const guardada = await fila(inscripcion.idInscripcion);
      expect(guardada).toMatchObject({
        vigencia: "CANCELADA_ALUMNO", finalizadaPorActorTipo: "USUARIO", finalizadaPorUsuarioId: propio.usuarioId, estadoPago: "PAGADA",
      });
      expect(await db.reservaTurno.count({ where: { turnoId: turno.idTurno, tipoRecurso: "ALUMNO", recursoId: propio.alumnoId } })).toBe(0);
      expect(await db.pago.count({ where: { inscripcionId: inscripcion.idInscripcion } })).toBe(1);
      const eventos = await db.eventoTurno.findMany({ where: { turnoId: turno.idTurno }, orderBy: { creadoEnEvento: "asc" } });
      expect(eventos.map((e) => e.tipoEvento)).toContain("turno:inscripcion_cancelada");
      expect(eventos.some((e) => e.tipoEvento === "turno:disponible_nuevamente")).toBe(true);
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
        const resultado = await cancelarInscripcionPropia(turno.idTurno, propio.usuarioId);
        expect(resultado).toMatchObject({ vigencia: "CANCELADA_ALUMNO", con_pagos: false });
      });
      expect(await exigeInscripcionConPago(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId })).toEqual({ exige: true, motivo: "CANCELADA_SIN_PAGO" });
    });
  });

  it("rechaza una inscripción pagada fuera del plazo de anticipación", async () => {
    await conReloj(MOMENTO, async () => {
      const propio = await alumno();
      const turno = await crearTurnoDePrueba(db, { enDias: 1, hora: "11:00" }); // inicio = 2026-10-06T14:00Z; límite = 2026-10-05T14:00Z
      await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "PAGADA", reservadaEl: MOMENTO });
      const fueraDelLimite = new Date(MOMENTO.getTime() + 3 * HORA);
      await conReloj(fueraDelLimite, async () => {
        await expect(cancelarInscripcionPropia(turno.idTurno, propio.usuarioId))
          .rejects.toMatchObject({ code: "CANCELACION_FUERA_DE_PLAZO" });
      });
    });
  });

  it("rechaza una reserva ya vencida: la marca dentro de la transacción, pero al revertirse no persiste el vencimiento", async () => {
    await conReloj(MOMENTO, async () => {
      const propio = await alumno();
      const turno = await crearTurnoDePrueba(db, { enDias: 5 });
      const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "RESERVADA", reservadaEl: MOMENTO });
      const despuesDelVencimiento = new Date(inscripcion.venceEl!.getTime() + 1000);
      await conReloj(despuesDelVencimiento, async () => {
        await expect(cancelarInscripcionPropia(turno.idTurno, propio.usuarioId))
          .rejects.toMatchObject({ code: "INSCRIPCION_NO_VIGENTE" });
      });
      expect((await fila(inscripcion.idInscripcion)).vigencia).toBe("VIGENTE");
    });
  });

  it("rechaza una segunda cancelación de la misma inscripción", async () => {
    await conReloj(MOMENTO, async () => {
      const propio = await alumno();
      const turno = await crearTurnoDePrueba(db, { enDias: 5 });
      await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "PAGADA", reservadaEl: MOMENTO });
      await cancelarInscripcionPropia(turno.idTurno, propio.usuarioId);
      await expect(cancelarInscripcionPropia(turno.idTurno, propio.usuarioId))
        .rejects.toMatchObject({ code: "INSCRIPCION_NO_VIGENTE" });
    });
  });

  it("rechaza cancelar una clase cancelada por el centro", async () => {
    await conReloj(MOMENTO, async () => {
      const propio = await alumno();
      const turno = await crearTurnoDePrueba(db, { enDias: 5, estado: "CANCELADO" });
      await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "PAGADA", reservadaEl: MOMENTO });
      await expect(cancelarInscripcionPropia(turno.idTurno, propio.usuarioId))
        .rejects.toMatchObject({ code: "TURNO_CANCELADO" });
    });
  });

  it("rechaza cancelar una clase que ya empezó", async () => {
    await conReloj(MOMENTO, async () => {
      const propio = await alumno();
      const turno = await crearTurnoDePrueba(db, { enDias: 0, hora: "07:00" }); // inicio = 2026-10-05T10:00Z <= MOMENTO
      await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, estadoPago: "PAGADA", reservadaEl: MOMENTO });
      await expect(cancelarInscripcionPropia(turno.idTurno, propio.usuarioId))
        .rejects.toMatchObject({ code: "TURNO_VENCIDO" });
    });
  });
});
