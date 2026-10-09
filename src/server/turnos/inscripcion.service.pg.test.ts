import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  crearAlumnoDePrueba,
  crearInscripcionDePrueba,
  crearMateriaDePrueba,
  crearTurnoDePrueba,
  crearUsuarioDePrueba,
} from "@/server/testing/fabricas";
import { conReloj, ahora } from "@/server/shared/reloj";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { actorUsuario, PROCESO_AUTOMATICO } from "@/server/shared/historial";
import { inicioDeTurno, fechaCentro } from "@/server/shared/fechas-centro";
import {
  clasesConReservasVencidas,
  crearInscripcion,
  exigeInscripcionConPago,
  finalizarInscripcion,
  inscripcionMasRecienteDelPar,
  inscripcionVigenteDelPar,
  marcarVencidas,
  recalcularEstadoPago,
  recalcularVencimientos,
  type DatosCrearInscripcion,
} from "@/server/turnos/inscripcion.publico";

// PostgreSQL real (`npm run test:pg -- <ruta>`): servicio de inscripción del
// módulo C (PR-0.md §2.13, spec_modulo_C.md §2.16 a §2.19).
describe.skipIf(!basePgHabilitada)("servicio de inscripción con PostgreSQL real", () => {
  let db: PrismaClient;
  let usuarioId: string;
  const HORA = 60 * 60 * 1000;

  const enTx = <T>(fn: (tx: Tx) => Promise<T>, momento?: Date) =>
    momento ? conReloj(momento, () => transaccion(fn, { db })) : transaccion(fn, { db });
  const inscribir = (datos: Partial<DatosCrearInscripcion> & { turnoId: string; alumnoId: string }, momento?: Date) =>
    enTx((tx) => crearInscripcion(tx, { origen: "CENTRO", conReserva: false, actor: actorUsuario(usuarioId), ...datos }), momento);
  const reservasDe = (turnoId: string, alumnoId: string) =>
    db.reservaTurno.count({ where: { turnoId, tipoRecurso: "ALUMNO", recursoId: alumnoId } });

  beforeAll(async () => {
    db = clientePg();
    usuarioId = (await crearUsuarioDePrueba(db)).idUsuario;
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("CENTRO sin reserva: PAGO_SIN_REGISTRAR, precio congelado, reserva del alumno e historial después del commit", async () => {
    const turno = await crearTurnoDePrueba(db, { duracionMin: 120 });
    const alumno = await crearAlumnoDePrueba(db);
    const r = await inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno });
    expect(r.inscripcion).toMatchObject({ estadoPago: "PAGO_SIN_REGISTRAR", vigencia: "VIGENTE", precio: 24000, venceEl: null });
    expect(r).toMatchObject({ inscriptos: 1, cupo: 10, completado: false, estadoTurno: "DISPONIBLE" });
    expect(await reservasDe(turno.idTurno, alumno.idAlumno)).toBe(1);
    const historial = await db.historialInscripcion.findMany({ where: { inscripcionId: r.inscripcion.id } });
    expect(historial).toEqual([expect.objectContaining({ vigenciaAnterior: null, vigenciaNueva: "VIGENTE", estadoPagoNuevo: "PAGO_SIN_REGISTRAR", actorTipo: "USUARIO", usuarioId })]);
  });

  it("ALUMNO con reserva: RESERVADA con venceBaseEl = ahora + plazo y venceEl topeado con el inicio de la clase", async () => {
    const lejos = await crearTurnoDePrueba(db, { enDias: 5 });
    const cerca = await crearTurnoDePrueba(db, { enDias: 1, hora: "08:00" });
    const alumno = await crearAlumnoDePrueba(db);
    const momento = ahora();
    const a = await inscribir({ turnoId: lejos.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO", conReserva: true }, momento);
    expect(a.inscripcion.estadoPago).toBe("RESERVADA");
    expect(a.inscripcion.venceBaseEl!.getTime()).toBe(momento.getTime() + 24 * HORA);
    expect(a.inscripcion.venceEl!.getTime()).toBe(momento.getTime() + 24 * HORA);
    const otro = await crearAlumnoDePrueba(db);
    const b = await inscribir({ turnoId: cerca.idTurno, alumnoId: otro.idAlumno, origen: "ALUMNO", conReserva: true }, momento);
    const inicio = inicioDeTurno(cerca);
    expect(b.inscripcion.venceEl!.getTime()).toBe(Math.min(momento.getTime() + 24 * HORA, inicio.getTime()));
  });

  it("conserva los códigos y textos de HU-C-04: pendiente, cancelada, vencida, cupo, repetido y superposición", async () => {
    const alumno = await crearAlumnoDePrueba(db);
    const pendiente = await crearTurnoDePrueba(db, { estado: "PENDIENTE" });
    const cancelada = await crearTurnoDePrueba(db, { estado: "CANCELADO" });
    const pasada = await crearTurnoDePrueba(db, { enDias: -1 });
    await expect(inscribir({ turnoId: "no-existe", alumnoId: alumno.idAlumno })).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
    await expect(inscribir({ turnoId: pendiente.idTurno, alumnoId: alumno.idAlumno })).rejects.toMatchObject({ code: "TURNO_PENDIENTE" });
    await expect(inscribir({ turnoId: cancelada.idTurno, alumnoId: alumno.idAlumno })).rejects.toMatchObject({ code: "TURNO_CANCELADO", message: "El turno está cancelado" });
    await expect(inscribir({ turnoId: pasada.idTurno, alumnoId: alumno.idAlumno })).rejects.toMatchObject({ code: "TURNO_VENCIDO", message: "El horario del turno ya pasó" });

    const lleno = await crearTurnoDePrueba(db, { cupo: 1 });
    await inscribir({ turnoId: lleno.idTurno, alumnoId: (await crearAlumnoDePrueba(db)).idAlumno });
    await expect(inscribir({ turnoId: lleno.idTurno, alumnoId: alumno.idAlumno })).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE", message: "El turno alcanzó su cupo máximo" });

    const turno = await crearTurnoDePrueba(db, { hora: "15:00" });
    await inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno });
    await expect(inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno })).rejects.toMatchObject({
      code: "ALUMNO_YA_ASIGNADO", message: "El mismo alumno no puede agregarse dos veces al mismo turno", detalles: { alumno_id: alumno.idAlumno },
    });
    await expect(inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO" })).rejects.toMatchObject({
      code: "ALUMNO_YA_ASIGNADO", message: "Ya estás inscripto en este turno",
    });
    const superpuesta = await crearTurnoDePrueba(db, { hora: "15:00" });
    await expect(inscribir({ turnoId: superpuesta.idTurno, alumnoId: alumno.idAlumno })).rejects.toMatchObject({
      code: "ALUMNO_NO_DISPONIBLE", message: "El alumno ya tiene un turno agendado en ese horario",
    });
    await expect(inscribir({ turnoId: superpuesta.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO" })).rejects.toMatchObject({
      code: "ALUMNO_NO_DISPONIBLE", message: "Ya tenés otro turno en ese horario",
    });
  });

  it("alumno inactivo o inexistente: CENTRO conserva ALUMNO_NO_DISPONIBLE; ALUMNO y PAGO responden ALUMNO_INACTIVO/ALUMNO_NO_ENCONTRADO", async () => {
    const turno = await crearTurnoDePrueba(db);
    const inactivo = await crearAlumnoDePrueba(db, { activo: false });
    await expect(inscribir({ turnoId: turno.idTurno, alumnoId: inactivo.idAlumno })).rejects.toMatchObject({
      code: "ALUMNO_NO_DISPONIBLE", message: "El alumno no existe o no está activo", detalles: { alumno_id: inactivo.idAlumno },
    });
    await expect(inscribir({ turnoId: turno.idTurno, alumnoId: inactivo.idAlumno, origen: "ALUMNO" })).rejects.toMatchObject({ code: "ALUMNO_INACTIVO", status: 409 });
    // Activo según el llamador pero inactivo en la fila bloqueada: decide la fila (R3-PR0-B3).
    await expect(inscribir({ turnoId: turno.idTurno, alumnoId: inactivo.idAlumno, origen: "ALUMNO", alumnoActivo: true })).rejects.toMatchObject({ code: "ALUMNO_INACTIVO" });
    await expect(inscribir({ turnoId: turno.idTurno, alumnoId: "no-existe", origen: "PAGO" })).rejects.toMatchObject({ code: "ALUMNO_NO_ENCONTRADO", status: 404 });
  });

  it("materia sin tarifa: MATERIA_SIN_TARIFA y no se inscribe", async () => {
    const materia = await crearMateriaDePrueba(db, { tarifaHora: null });
    const turno = await crearTurnoDePrueba(db, { materiaId: materia.idMateria });
    const alumno = await crearAlumnoDePrueba(db);
    await expect(inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO" })).rejects.toMatchObject({
      code: "MATERIA_SIN_TARIFA", status: 422, message: "Esta clase todavía no tiene precio. Comunicate con el centro.",
    });
    expect(await db.turnoAlumno.count({ where: { turnoId: turno.idTurno } })).toBe(0);
  });

  it("vencimiento: marcarVencidas marca con fecha venceEl y actor proceso, es idempotente y devuelve la cantidad; en una clase cancelada no vence nada", async () => {
    const turno = await crearTurnoDePrueba(db, { enDias: 5, cupo: 1 });
    const alumno = await crearAlumnoDePrueba(db);
    const reserva = await inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO", conReserva: true });
    expect(reserva.completado).toBe(true);
    const despues = new Date(reserva.inscripcion.venceEl!.getTime() + 1000);
    expect(await clasesConReservasVencidas(db, despues)).toContain(turno.idTurno);
    expect(await enTx((tx) => marcarVencidas(tx, turno.idTurno), despues)).toBe(1);
    expect(await enTx((tx) => marcarVencidas(tx, turno.idTurno), despues)).toBe(0);
    const fila = await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: reserva.inscripcion.id } });
    expect(fila).toMatchObject({ vigencia: "RESERVA_VENCIDA", finalizadaEl: reserva.inscripcion.venceEl, finalizadaPorActorTipo: "PROCESO_AUTOMATICO", finalizadaPorUsuarioId: null, estadoPago: "RESERVADA" });
    expect((await db.turno.findUniqueOrThrow({ where: { idTurno: turno.idTurno } })).estadoTurno).toBe("DISPONIBLE");
    expect(await reservasDe(turno.idTurno, alumno.idAlumno)).toBe(0);

    const cancelada = await crearTurnoDePrueba(db, { enDias: 5, hora: "17:00" });
    const otra = await inscribir({ turnoId: cancelada.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO", conReserva: true });
    await db.turno.update({ where: { idTurno: cancelada.idTurno }, data: { estadoTurno: "CANCELADO" } });
    expect(await enTx((tx) => marcarVencidas(tx, cancelada.idTurno), new Date(otra.inscripcion.venceEl!.getTime() + 1000))).toBe(0);
  });

  it("una reserva vencida sin marcar no retiene la franja del alumno ni el cupo (HU-C-24 criterio 2)", async () => {
    const a = await crearTurnoDePrueba(db, { enDias: 6, hora: "09:00", cupo: 1 });
    const b = await crearTurnoDePrueba(db, { enDias: 6, hora: "09:00" });
    const alumno = await crearAlumnoDePrueba(db);
    const reserva = await inscribir({ turnoId: a.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO", conReserva: true });
    const despues = new Date(reserva.inscripcion.venceEl!.getTime() + 1000);
    // Superposición: con la reserva de A vencida (sin marcar), el alumno se inscribe en B a la misma hora.
    await expect(inscribir({ turnoId: b.idTurno, alumnoId: alumno.idAlumno }, despues)).resolves.toBeTruthy();
    expect((await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: reserva.inscripcion.id } })).vigencia).toBe("RESERVA_VENCIDA");
    // Cupo: A tenía cupo 1 ocupado solo por la reserva vencida.
    await expect(inscribir({ turnoId: a.idTurno, alumnoId: (await crearAlumnoDePrueba(db)).idAlumno }, despues)).resolves.toMatchObject({ completado: true });
  });

  it("re-reserva (HU-C-22 crit. 4): reserva vencida o cancelada sin pago exige pagar; no cuentan la inscripción sin reserva ni la reabierta", async () => {
    const turno = await crearTurnoDePrueba(db, { enDias: 6, hora: "11:00" });
    const alumno = await crearAlumnoDePrueba(db);
    const reserva = await inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO", conReserva: true });
    const despues = new Date(reserva.inscripcion.venceEl!.getTime() + 1000);
    await expect(exigeInscripcionConPago(db, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, momento: despues })).resolves.toEqual({ exige: true, motivo: "RESERVA_VENCIDA" });
    await expect(inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO", conReserva: true }, despues)).rejects.toMatchObject({
      code: "RESERVA_PREVIA_SIN_PAGO",
      message: "Ya tuviste una reserva sin pagar en esta clase. Para volver a inscribirte, acercate al centro y abonala en el momento.",
    });
    // CENTRO no aplica la regla (la usa HU-C-24 con exigeInscripcionConPago).
    await expect(inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno }, despues)).resolves.toBeTruthy();

    const t2 = await crearTurnoDePrueba(db, { enDias: 6, hora: "13:00" });
    const cancela = await inscribir({ turnoId: t2.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO", conReserva: true });
    await enTx((tx) => finalizarInscripcion(tx, { inscripcionId: cancela.inscripcion.id, vigencia: "CANCELADA_ALUMNO", actor: actorUsuario(usuarioId) }));
    await expect(exigeInscripcionConPago(db, { turnoId: t2.idTurno, alumnoId: alumno.idAlumno })).resolves.toEqual({ exige: true, motivo: "CANCELADA_SIN_PAGO" });

    const t3 = await crearTurnoDePrueba(db, { enDias: 6, hora: "15:00" });
    const sinReserva = await inscribir({ turnoId: t3.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO" });
    await enTx((tx) => finalizarInscripcion(tx, { inscripcionId: sinReserva.inscripcion.id, vigencia: "CANCELADA_ALUMNO", actor: actorUsuario(usuarioId) }));
    await expect(exigeInscripcionConPago(db, { turnoId: t3.idTurno, alumnoId: alumno.idAlumno })).resolves.toEqual({ exige: false, motivo: null });

    const t4 = await crearTurnoDePrueba(db, { enDias: 6, hora: "17:00" });
    const reabierta = await crearInscripcionDePrueba(db, { turnoId: t4.idTurno, alumnoId: alumno.idAlumno, estadoPago: "RESERVADA" });
    await db.turnoAlumno.update({ where: { idInscripcion: reabierta.idInscripcion }, data: { reabiertaPorAnulacion: true } });
    await expect(exigeInscripcionConPago(db, { turnoId: t4.idTurno, alumnoId: alumno.idAlumno, momento: new Date(reabierta.venceEl!.getTime() + 1) })).resolves.toEqual({ exige: false, motivo: null });
  });

  it("finalizar: no borra, libera la franja, permite volver a inscribir (dos filas, una vigente) y devuelve la clase a DISPONIBLE", async () => {
    const turno = await crearTurnoDePrueba(db, { cupo: 1, hora: "18:00" });
    const alumno = await crearAlumnoDePrueba(db);
    const primera = await inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno });
    expect(primera.estadoTurno).toBe("COMPLETO");
    const fin = await enTx((tx) => finalizarInscripcion(tx, { inscripcionId: primera.inscripcion.id, vigencia: "QUITADA_CENTRO", actor: actorUsuario(usuarioId) }));
    expect(fin).toMatchObject({ vigencia: "QUITADA_CENTRO", estadoTurno: { anterior: "COMPLETO", nuevo: "DISPONIBLE", cambio: true } });
    expect(await reservasDe(turno.idTurno, alumno.idAlumno)).toBe(0);
    const segunda = await inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno });
    expect(await reservasDe(turno.idTurno, alumno.idAlumno)).toBe(1);
    expect(await db.turnoAlumno.count({ where: { turnoId: turno.idTurno, alumnoId: alumno.idAlumno } })).toBe(2);
    expect((await inscripcionVigenteDelPar(alumno.idAlumno, turno.idTurno, db))!.id).toBe(segunda.inscripcion.id);
    expect((await inscripcionMasRecienteDelPar(alumno.idAlumno, turno.idTurno, db))!.id).toBe(segunda.inscripcion.id);
    await expect(enTx((tx) => finalizarInscripcion(tx, { inscripcionId: primera.inscripcion.id, vigencia: "QUITADA_CENTRO", actor: actorUsuario(usuarioId) })))
      .rejects.toMatchObject({ code: "INSCRIPCION_NO_VIGENTE" });
    await expect(enTx((tx) => finalizarInscripcion(tx, { inscripcionId: "no-existe", vigencia: "QUITADA_CENTRO", actor: PROCESO_AUTOMATICO })))
      .rejects.toMatchObject({ code: "INSCRIPCION_NO_ENCONTRADA", status: 404 });
  });

  it("soloSiReservaPendiente: rechaza una inscripción pagada o una reserva vencida (RESERVA_NO_PENDIENTE)", async () => {
    const turno = await crearTurnoDePrueba(db, { enDias: 7 });
    const alumno = await crearAlumnoDePrueba(db);
    const sinReserva = await inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno });
    await expect(enTx((tx) => finalizarInscripcion(tx, { inscripcionId: sinReserva.inscripcion.id, vigencia: "QUITADA_CENTRO", actor: actorUsuario(usuarioId), soloSiReservaPendiente: true })))
      .rejects.toMatchObject({ code: "RESERVA_NO_PENDIENTE", message: "Esta reserva ya no está pendiente: se pagó o venció." });
    const otro = await crearAlumnoDePrueba(db);
    const reserva = await inscribir({ turnoId: turno.idTurno, alumnoId: otro.idAlumno, origen: "ALUMNO", conReserva: true });
    await expect(enTx((tx) => finalizarInscripcion(tx, { inscripcionId: reserva.inscripcion.id, vigencia: "QUITADA_CENTRO", actor: actorUsuario(usuarioId), soloSiReservaPendiente: true }),
      new Date(reserva.inscripcion.venceEl!.getTime() + 1000))).rejects.toMatchObject({ code: "RESERVA_NO_PENDIENTE" });
    await expect(enTx((tx) => finalizarInscripcion(tx, { inscripcionId: reserva.inscripcion.id, vigencia: "QUITADA_CENTRO", actor: actorUsuario(usuarioId), soloSiReservaPendiente: true })))
      .resolves.toMatchObject({ vigencia: "QUITADA_CENTRO", estadoPago: "RESERVADA" });
  });

  it("recalcularVencimientos: con la clase adelantada, venceEl = min(venceBaseEl, nuevo inicio) y venceBaseEl no cambia", async () => {
    const turno = await crearTurnoDePrueba(db, { enDias: 6, hora: "10:00" });
    const alumno = await crearAlumnoDePrueba(db);
    const reserva = await inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "ALUMNO", conReserva: true });
    // Mañana en el centro (UTC−3), no en UTC.
    const nuevaFecha = new Date(fechaCentro(ahora()).getTime() + 24 * HORA);
    // La clase pasa a mañana a las 08:00: antes que el vencimiento original de 24 h.
    await db.turno.update({ where: { idTurno: turno.idTurno }, data: { fechaTurno: nuevaFecha, horaInicioTurno: new Date("1970-01-01T08:00:00.000Z") } });
    const actualizado = await db.turno.findUniqueOrThrow({ where: { idTurno: turno.idTurno } });
    const resultado = await enTx((tx) => recalcularVencimientos(tx, turno.idTurno));
    const fila = await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: reserva.inscripcion.id } });
    expect(fila.venceBaseEl).toEqual(reserva.inscripcion.venceBaseEl);
    expect(fila.venceEl!.getTime()).toBe(Math.min(reserva.inscripcion.venceBaseEl!.getTime(), inicioDeTurno(actualizado).getTime()));
    expect(resultado.marcadas).toBe(0);
  });

  it("recalcularEstadoPago sin pagos: una inscripción PAGADA de una clase que no empezó vuelve a RESERVADA con plazo nuevo y reabierta", async () => {
    const turno = await crearTurnoDePrueba(db, { enDias: 6 });
    const alumno = await crearAlumnoDePrueba(db);
    const pagada = await inscribir({ turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "PAGO" });
    expect(pagada.inscripcion.estadoPago).toBe("PAGADA");
    const momento = ahora();
    const cambio = await enTx((tx) => recalcularEstadoPago(tx, pagada.inscripcion.id, 0, actorUsuario(usuarioId)), momento);
    expect(cambio).toMatchObject({ cambio: true, anterior: "PAGADA", nuevo: "RESERVADA" });
    const fila = await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: pagada.inscripcion.id } });
    expect(fila).toMatchObject({ estadoPago: "RESERVADA", reabiertaPorAnulacion: true, inicioPlazo: momento });
    expect(fila.venceBaseEl!.getTime()).toBe(momento.getTime() + 24 * HORA);
  });
});
