import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { abrirCajaDePrueba, crearAlumnoDePrueba, crearInscripcionDePrueba, crearOperacionDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { conReloj } from "@/server/shared/reloj";
import { agregarAlumnoTurno } from "@/server/turnos/turno.service";
import { obtenerDetalleTurno } from "@/server/turnos/turno.detalle";
import { vencerReservas } from "@/server/turnos/reserva.vencimiento.service";

// HU-C-24 contra PostgreSQL descartable de `npm run test:pg`. Las verificaciones
// que dependen de I-10 (pantalla de cobro), I-06, C-14, E-02, H-10 y N-01 no se
// acreditan acá: ver docs/testing/hu-c-24/HU-C-24-evidencia.md.
const MOMENTO = new Date("2026-10-05T12:00:00.000Z"); // Lunes, 09:00 del centro.
const HORA = 3_600_000;
const CAPACIDADES = { verPagos: true, verHistorial: true, cancelar: true, reprogramar: true, priorizar: true, registrarPago: true, registrarClase: true };

describe.skipIf(!basePgHabilitada)("HU-C-24: vencimiento de reservas en PostgreSQL real", () => {
  let db: PrismaClient;
  let mesaId: string;

  const alumno = async () => (await crearAlumnoDePrueba(db)).idAlumno;
  const fila = (idInscripcion: string) => db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion } });
  const historial = (inscripcionId: string) => db.historialInscripcion.findMany({ where: { inscripcionId }, orderBy: { fecha: "asc" } });
  /** Reserva ya vencida a MOMENTO: hecha hace 25 h con plazo de 24 h (vence una hora antes). */
  const vencida = (turnoId: string, alumnoId: string) =>
    crearInscripcionDePrueba(db, { turnoId, alumnoId, estadoPago: "RESERVADA", reservadaEl: new Date(MOMENTO.getTime() - 25 * HORA) });
  /** Reserva vigente a MOMENTO: hecha hace una hora. */
  const vigente = (turnoId: string, alumnoId: string) =>
    crearInscripcionDePrueba(db, { turnoId, alumnoId, estadoPago: "RESERVADA", reservadaEl: new Date(MOMENTO.getTime() - HORA) });

  beforeAll(async () => {
    db = clientePg();
    mesaId = (await crearUsuarioDePrueba(db)).idUsuario;
  });
  afterAll(async () => {
    if (db) await db.$disconnect();
    await prisma.$disconnect();
  });

  it("vence la reserva con fecha = vencimiento y actor «Proceso automático», libera el lugar y no borra la inscripción", () => conReloj(MOMENTO, async () => {
    const turno = await crearTurnoDePrueba(db, { cupo: 2, estado: "COMPLETO" });
    const [a, b] = [await alumno(), await alumno()];
    const reserva = await vencida(turno.idTurno, a);
    const pagada = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: b, estadoPago: "PAGO_SIN_REGISTRAR" });

    const resultado = await vencerReservas(MOMENTO);
    expect(resultado.reservasVencidas).toBeGreaterThanOrEqual(1);
    expect(resultado.clasesAfectadas).toBeGreaterThanOrEqual(1);
    expect(resultado.ejecutadoEl).toEqual(MOMENTO);

    const despues = await fila(reserva.idInscripcion);
    expect(despues).toMatchObject({ vigencia: "RESERVA_VENCIDA", estadoPago: "RESERVADA", finalizadaPorActorTipo: "PROCESO_AUTOMATICO", finalizadaPorUsuarioId: null });
    expect(despues.finalizadaEl).toEqual(reserva.venceEl);
    expect(despues.finalizadaEl!.getTime()).toBeLessThan(MOMENTO.getTime());
    expect(await db.turno.findUniqueOrThrow({ where: { idTurno: turno.idTurno } })).toMatchObject({ estadoTurno: "DISPONIBLE" });
    // La otra inscripción de la clase no se toca.
    expect(await fila(pagada.idInscripcion)).toMatchObject({ vigencia: "VIGENTE", estadoPago: "PAGO_SIN_REGISTRAR" });
    // Historial escrito después del commit, con la fecha del vencimiento y sin usuario.
    expect(await historial(reserva.idInscripcion)).toEqual([expect.objectContaining({
      vigenciaAnterior: "VIGENTE", vigenciaNueva: "RESERVA_VENCIDA", actorTipo: "PROCESO_AUTOMATICO", usuarioId: null, fecha: reserva.venceEl,
    })]);
    // No se escribe eventos_turno: el proceso no es un usuario.
    expect(await db.eventoTurno.count({ where: { turnoId: turno.idTurno } })).toBe(0);
    // El lugar quedó libre: otro alumno puede inscribirse.
    await expect(agregarAlumnoTurno(turno.idTurno, { alumno_id: await alumno() }, mesaId)).resolves.toMatchObject({ alumnos_inscriptos: "2/2", estado: "COMPLETO" });
  }));

  it("es idempotente: una segunda corrida no vuelve a procesar ni a registrar la reserva", () => conReloj(MOMENTO, async () => {
    const turno = await crearTurnoDePrueba(db);
    const reserva = await vencida(turno.idTurno, await alumno());
    await vencerReservas(MOMENTO);
    const primera = await fila(reserva.idInscripcion);
    await vencerReservas(MOMENTO);
    await vencerReservas(new Date(MOMENTO.getTime() + HORA));
    expect(await fila(reserva.idInscripcion)).toEqual(primera);
    expect(await historial(reserva.idInscripcion)).toHaveLength(1);
  }));

  it("no toca reservas vigentes, pagadas ni las de una clase cancelada (criterio 6)", () => conReloj(MOMENTO, async () => {
    const abierta = await crearTurnoDePrueba(db);
    const cancelada = await crearTurnoDePrueba(db, { estado: "CANCELADO" });
    const enPlazo = await vigente(abierta.idTurno, await alumno());
    // Una reserva cuyo plazo ya pasó pero que se pagó a tiempo: queda PAGADA, sin vencimiento.
    const pagada = await vencida(abierta.idTurno, await alumno());
    await crearOperacionDePrueba(db, { cajaId: (await abrirCajaDePrueba(db)).idCaja, inscripcionIds: [pagada.idInscripcion] });
    const enCancelada = await vencida(cancelada.idTurno, await alumno());

    await vencerReservas(MOMENTO);

    expect(await fila(enPlazo.idInscripcion)).toMatchObject({ vigencia: "VIGENTE", estadoPago: "RESERVADA" });
    expect(await fila(pagada.idInscripcion)).toMatchObject({ vigencia: "VIGENTE", estadoPago: "PAGADA" });
    expect(await fila(enCancelada.idInscripcion)).toMatchObject({ vigencia: "VIGENTE", estadoPago: "RESERVADA" });
    expect(await historial(enCancelada.idInscripcion)).toHaveLength(0);
  }));

  it("la frontera es inclusiva: vence cuando el momento es igual al vencimiento", () => conReloj(MOMENTO, async () => {
    const turno = await crearTurnoDePrueba(db);
    const reserva = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: await alumno(), estadoPago: "RESERVADA", reservadaEl: new Date(MOMENTO.getTime() - 24 * HORA) });
    expect(reserva.venceEl).toEqual(MOMENTO);
    await vencerReservas(new Date(MOMENTO.getTime() - 1));
    expect(await fila(reserva.idInscripcion)).toMatchObject({ vigencia: "VIGENTE" });
    await vencerReservas(MOMENTO);
    expect(await fila(reserva.idInscripcion)).toMatchObject({ vigencia: "RESERVA_VENCIDA" });
  }));

  describe("con el proceso detenido (criterio 2): nada ejecutó vencerReservas", () => {
    it("el cupo no cuenta la reserva vencida: se inscribe y se marca al operar, con fecha = vencimiento", () => conReloj(MOMENTO, async () => {
      const turno = await crearTurnoDePrueba(db, { cupo: 1, estado: "COMPLETO" });
      const reserva = await vencida(turno.idTurno, await alumno());
      // Sigue marcada VIGENTE en la fila: el proceso no corrió.
      expect(await fila(reserva.idInscripcion)).toMatchObject({ vigencia: "VIGENTE" });

      const nuevo = await alumno();
      const agregado = await agregarAlumnoTurno(turno.idTurno, { alumno_id: nuevo }, mesaId);
      expect(agregado).toMatchObject({ alumnos_inscriptos: "1/1", estado: "COMPLETO" });

      const marcada = await fila(reserva.idInscripcion);
      expect(marcada).toMatchObject({ vigencia: "RESERVA_VENCIDA", finalizadaPorActorTipo: "PROCESO_AUTOMATICO", finalizadaPorUsuarioId: null });
      expect(marcada.finalizadaEl).toEqual(reserva.venceEl);
    }));

    it("el detalle de la clase la trata como vencida: no figura y la clase se muestra Disponible", () => conReloj(MOMENTO, async () => {
      const turno = await crearTurnoDePrueba(db, { cupo: 1, estado: "COMPLETO" });
      const sinMarcar = await alumno();
      await vencida(turno.idTurno, sinMarcar);
      const resultado = await obtenerDetalleTurno(turno.idTurno, { id: mesaId, rol: "MESA_ENTRADA" }, { capacidades: CAPACIDADES, ahora: MOMENTO });
      if (resultado.resultado !== "ok") throw new Error(`se esperaba ok y llegó ${resultado.resultado}`);
      expect(resultado.turno.alumnos).toHaveLength(0);
      expect(resultado.turno.estado).toBe("DISPONIBLE");
      // El detalle solo lee: la fila sigue sin marcar.
      expect(await db.turnoAlumno.count({ where: { turnoId: turno.idTurno, vigencia: "VIGENTE" } })).toBe(1);
    }));
  });

  describe("inscripción desde el centro con reserva (criterio 3)", () => {
    it("queda RESERVADA con el plazo vigente, el precio al inscribir y ofrece «Registrar pago»", () => conReloj(MOMENTO, async () => {
      const turno = await crearTurnoDePrueba(db, { duracionMin: 120 });
      const resultado = await agregarAlumnoTurno(turno.idTurno, { alumno_id: await alumno() }, mesaId);
      expect(resultado.ofrecer_pago).toBe(true);
      expect(resultado.inscripcion).toMatchObject({ estado_pago: "RESERVADA", precio: 24000 });
      expect(await fila(resultado.inscripcion.id)).toMatchObject({
        vigencia: "VIGENTE", estadoPago: "RESERVADA", reservadaEl: MOMENTO, inicioPlazo: MOMENTO, venceEl: new Date(MOMENTO.getTime() + 24 * HORA), precio: 24000,
      });
    }));

    it("si el alumno ya tuvo una reserva vencida en la clase responde 409 INSCRIPCION_REQUIERE_PAGO y no lo inscribe", () => conReloj(MOMENTO, async () => {
      const turno = await crearTurnoDePrueba(db);
      const alumnoId = await alumno();
      await vencida(turno.idTurno, alumnoId);
      // Con el proceso detenido (sin marcar) y también después de marcarla.
      for (const marcar of [false, true]) {
        if (marcar) await vencerReservas(MOMENTO);
        await expect(agregarAlumnoTurno(turno.idTurno, { alumno_id: alumnoId }, mesaId))
          .rejects.toMatchObject({ code: "INSCRIPCION_REQUIERE_PAGO", status: 409, detalles: { alumno_id: alumnoId } });
        // Solo queda la reserva original: la excepción no crea una inscripción nueva.
        expect(await db.turnoAlumno.count({ where: { turnoId: turno.idTurno, alumnoId } })).toBe(1);
      }
    }));
  });

  describe("reservas en el detalle de la clase (criterio 4)", () => {
    const detalle = async (turnoId: string, ahoraEl: Date, capacidades = CAPACIDADES) => {
      const resultado = await obtenerDetalleTurno(turnoId, { id: mesaId, rol: "MESA_ENTRADA" }, { capacidades, ahora: ahoraEl });
      if (resultado.resultado !== "ok") throw new Error(`se esperaba ok y llegó ${resultado.resultado}`);
      return resultado.turno;
    };

    it("muestra la reserva pendiente con su vencimiento y el acceso a «Registrar pago»", () => conReloj(MOMENTO, async () => {
      const turno = await crearTurnoDePrueba(db);
      const reserva = await vigente(turno.idTurno, await alumno());
      const { alumnos } = await detalle(turno.idTurno, MOMENTO);
      expect(alumnos).toHaveLength(1);
      expect(alumnos[0]).toMatchObject({
        inscripcion: { id: reserva.idInscripcion, estado_pago: "RESERVADA", precio: 12000 }, puede_registrar_pago: true,
      });
      expect(alumnos[0]!.inscripcion!.vence_el).toMatch(/-03:00$/);
    }));

    it("no ofrece cobro si la clase ya empezó ni si está cancelada, y el Gerente no cobra", () => conReloj(MOMENTO, async () => {
      const turno = await crearTurnoDePrueba(db, { hora: "10:00", enDias: 0 });
      // «Pago sin registrar» no vence: así el único cambio entre las dos lecturas es el inicio de la clase.
      await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: await alumno(), estadoPago: "PAGO_SIN_REGISTRAR" });
      // MOMENTO es las 09:00 del centro: la clase de las 10:00 todavía no empezó.
      expect((await detalle(turno.idTurno, MOMENTO)).alumnos[0]).toMatchObject({ puede_registrar_pago: true });
      expect((await detalle(turno.idTurno, new Date(MOMENTO.getTime() + 2 * HORA))).alumnos[0]).toMatchObject({ puede_registrar_pago: false });
      expect((await detalle(turno.idTurno, MOMENTO, { ...CAPACIDADES, registrarPago: false })).alumnos[0]).toMatchObject({ puede_registrar_pago: false });

      const cancelada = await crearTurnoDePrueba(db, { estado: "CANCELADO" });
      await vigente(cancelada.idTurno, await alumno());
      expect((await detalle(cancelada.idTurno, MOMENTO)).alumnos[0]).toMatchObject({ inscripcion: { estado_pago: "RESERVADA" }, puede_registrar_pago: false });
    }));
  });
});
