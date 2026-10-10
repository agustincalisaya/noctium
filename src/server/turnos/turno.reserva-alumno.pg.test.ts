import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  abrirCajaDePrueba, crearAlumnoDePrueba, crearInscripcionDePrueba,
  crearOperacionDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba, unico,
} from "@/server/testing/fabricas";
import { conReloj } from "@/server/shared/reloj";
import { actorUsuario } from "@/server/shared/historial";
import { transaccion } from "@/server/shared/transaccion";
import { inicioDeTurno, isoCentro } from "@/server/shared/fechas-centro";
import {
  crearInscripcion, finalizarInscripcion, recalcularEstadoPago,
  type VigenciaFinal,
} from "@/server/turnos/inscripcion.publico";
import {
  listarTurnosPropios, obtenerConfirmacionReservaPropia,
  quitarAlumnoTurno, solicitarTurnoPropio,
} from "@/server/turnos/turno.service";
import { obtenerResumenInscripcion } from "@/server/turnos/turno.resumen-inscripcion.service";
import { reprogramarTurno } from "@/server/turnos/turno.reprogramacion.service";

// Consumidores reales de C-22, PostgreSQL descartable de npm run test:pg.
// Preparar estados por PR 0 no acredita los flujos diferidos I-10/C-14/B-07/C-24/N-01.
const MOMENTO = new Date("2026-10-05T12:00:00.000Z"); // Lunes, 09:00 del centro.
const HORA = 3_600_000;
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);

describe.skipIf(!basePgHabilitada)("HU-C-22: reserva del alumno en PostgreSQL real", () => {
  let db: PrismaClient;
  let mesaId: string;
  let plazoOriginal: string | undefined;

  async function plazo(valor: string) {
    await db.parametroSistema.upsert({
      where: { clave: "plazo_pago_horas" }, update: { valor },
      create: { clave: "plazo_pago_horas", valor },
    });
  }
  async function alumno() {
    const usuario = await crearUsuarioDePrueba(db, { rol: "ALUMNO" });
    const ficha = await crearAlumnoDePrueba(db, { usuarioId: usuario.idUsuario });
    return { usuarioId: usuario.idUsuario, alumnoId: ficha.idAlumno };
  }
  const fila = (idInscripcion: string) => db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion } });
  const propias = (usuarioId: string, momento = MOMENTO, vista: "proximos" | "anteriores" = "proximos") =>
    conReloj(momento, () => listarTurnosPropios({ vista, pagina: 1, por_pagina: 10 }, usuarioId, db, momento));
  async function terminar(idInscripcion: string, vigencia: VigenciaFinal) {
    await transaccion((tx) => finalizarInscripcion(tx, {
      inscripcionId: idInscripcion, vigencia, actor: actorUsuario(mesaId),
    }), { db });
  }

  beforeAll(async () => {
    db = clientePg();
    mesaId = (await crearUsuarioDePrueba(db)).idUsuario;
    plazoOriginal = (await db.parametroSistema.findUnique({ where: { clave: "plazo_pago_horas" } }))?.valor;
  });
  beforeEach(async () => { await plazo("24"); });
  afterAll(async () => {
    if (db) {
      // Si no existía, 24 preserva el mismo valor efectivo; la base se descarta al terminar.
      await plazo(plazoOriginal ?? "24");
      await db.$disconnect();
    }
    await prisma.$disconnect();
  });

  it("una sola alta concurrente ocupa cupo y horario; rechazos no crean inscripciones", () => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const otro = await alumno();
    const turno = await crearTurnoDePrueba(db, { cupo: 1 });
    const resultados = await Promise.allSettled([
      solicitarTurnoPropio(turno.idTurno, propio.usuarioId),
      solicitarTurnoPropio(turno.idTurno, propio.usuarioId),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((r) => r.status === "rejected")).toHaveLength(1);
    const reservas = await db.turnoAlumno.findMany({ where: { turnoId: turno.idTurno } });
    expect(reservas).toHaveLength(1);
    expect(reservas[0]).toMatchObject({ vigencia: "VIGENTE", estadoPago: "RESERVADA", alumnoId: propio.alumnoId });
    expect(await db.turno.findUniqueOrThrow({ where: { idTurno: turno.idTurno } })).toMatchObject({ estadoTurno: "COMPLETO" });
    expect(await db.reservaTurno.count({ where: { turnoId: turno.idTurno, tipoRecurso: "ALUMNO", recursoId: propio.alumnoId } })).toBe(1);
    await expect(solicitarTurnoPropio(turno.idTurno, otro.usuarioId)).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE" });
    const superpuesta = await crearTurnoDePrueba(db);
    await expect(solicitarTurnoPropio(superpuesta.idTurno, propio.usuarioId)).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE" });
    expect(await db.turnoAlumno.count({ where: { turnoId: superpuesta.idTurno } })).toBe(0);
    expect(await db.turnoAlumno.count({ where: { turnoId: turno.idTurno } })).toBe(1);
  }));

  it("GET estima y POST calcula vencimiento definitivo y tarifa actual; luego precio y plazo quedan congelados", () => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const turno = await crearTurnoDePrueba(db, { enDias: 4, duracionMin: 120 });
    const resumen = await obtenerResumenInscripcion(turno.idTurno, propio.usuarioId, db);
    expect(resumen).toMatchObject({ precio: 24000, plazo_pago_horas: 24, vence_pago_el: isoCentro(new Date(MOMENTO.getTime() + 24 * HORA)) });
    expect(await db.turnoAlumno.count({ where: { turnoId: turno.idTurno } })).toBe(0);
    await db.materia.update({ where: { idMateria: turno.materiaId }, data: { tarifaHoraMateria: 15000 } });
    const confirmacionEl = new Date(MOMENTO.getTime() + HORA);
    const resultado = await conReloj(confirmacionEl, () => solicitarTurnoPropio(turno.idTurno, propio.usuarioId));
    expect(resultado.inscripcion).toMatchObject({ estado_pago: "RESERVADA", precio: 30000, vence_el: isoCentro(new Date(confirmacionEl.getTime() + 24 * HORA)) });
    const guardada = await fila(resultado.inscripcion.id);
    expect(guardada).toMatchObject({ precio: 30000, reservadaEl: confirmacionEl, inicioPlazo: confirmacionEl });
    await plazo("48");
    await db.materia.update({ where: { idMateria: turno.materiaId }, data: { tarifaHoraMateria: 20000 } });
    expect(await fila(resultado.inscripcion.id)).toEqual(guardada);
    expect((await propias(propio.usuarioId)).items[0].inscripcion).toMatchObject({ id: resultado.inscripcion.id, precio: 30000, situacion: "RESERVADA" });
    expect(await obtenerConfirmacionReservaPropia(resultado.inscripcion.id, propio.usuarioId, db, MOMENTO)).toMatchObject({ precio: 30000, situacion: "RESERVADA", vence_el: resultado.inscripcion.vence_el });
    const ajeno = await alumno();
    expect(await obtenerConfirmacionReservaPropia(resultado.inscripcion.id, ajeno.usuarioId, db, MOMENTO)).toBeNull();
  }));

  it("24 horas por defecto y vencimiento limitado al inicio; parámetro vigente se aplica solo a altas nuevas", () => conReloj(MOMENTO, async () => {
    await plazo(""); // Ausencia de un entero positivo usa el valor por defecto del PR 0.
    const propio = await alumno();
    const cerca = await crearTurnoDePrueba(db, { enDias: 0, hora: "16:00" });
    const resumen = await obtenerResumenInscripcion(cerca.idTurno, propio.usuarioId, db);
    expect(resumen).toMatchObject({ plazo_pago_horas: 24, vence_pago_el: isoCentro(inicioDeTurno(cerca)) });
    const alta = await solicitarTurnoPropio(cerca.idTurno, propio.usuarioId);
    expect(await fila(alta.inscripcion.id)).toMatchObject({ venceBaseEl: new Date(MOMENTO.getTime() + 24 * HORA), venceEl: inicioDeTurno(cerca) });
    await plazo("48");
    const lejos = await crearTurnoDePrueba(db, { enDias: 5 });
    const nueva = await solicitarTurnoPropio(lejos.idTurno, propio.usuarioId);
    expect(await fila(nueva.inscripcion.id)).toMatchObject({ venceBaseEl: new Date(MOMENTO.getTime() + 48 * HORA), venceEl: new Date(MOMENTO.getTime() + 48 * HORA) });
    expect((await fila(alta.inscripcion.id)).venceBaseEl).toEqual(new Date(MOMENTO.getTime() + 24 * HORA));
  }));

  it("reprogramar atrás y adelante cambia solo el tope; conserva vencimiento base y período originales", () => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const turno = await crearTurnoDePrueba(db, { enDias: 0, hora: "16:00" });
    for (const diaSemanaHorario of ["LUNES", "MARTES"] as const) {
      await db.horarioProfesor.create({ data: { profesorId: turno.profesorId!, diaSemanaHorario, horaDesdeHorario: hora("08:00"), horaHastaHorario: hora("20:00") } });
    }
    const alta = await solicitarTurnoPropio(turno.idTurno, propio.usuarioId);
    const original = await fila(alta.inscripcion.id);
    await plazo("48");
    await reprogramarTurno(turno.idTurno, { fecha: new Date("2026-10-05T00:00:00.000Z"), hora_inicio: "12:00" }, mesaId);
    expect(await fila(alta.inscripcion.id)).toMatchObject({ venceBaseEl: original.venceBaseEl, inicioPlazo: original.inicioPlazo, venceEl: new Date("2026-10-05T15:00:00.000Z") });
    await reprogramarTurno(turno.idTurno, { fecha: new Date("2026-10-06T00:00:00.000Z"), hora_inicio: "10:00" }, mesaId);
    expect(await fila(alta.inscripcion.id)).toMatchObject({ venceBaseEl: original.venceBaseEl, inicioPlazo: original.inicioPlazo, venceEl: original.venceBaseEl });
  }));

  it("Mis clases: sin plazo futura invita a pagar; iniciada y cancelada son informativas", () => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const futura = await crearTurnoDePrueba(db, { enDias: 2 });
    const iniciada = await crearTurnoDePrueba(db, { enDias: 0, hora: "08:00" });
    const cancelada = await crearTurnoDePrueba(db, { enDias: 3, estado: "CANCELADO" });
    for (const turno of [futura, iniciada, cancelada]) {
      await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, precio: 17000 });
    }
    const proximas = (await propias(propio.usuarioId)).items;
    expect(proximas.find((t) => t.turno_id === futura.idTurno)?.inscripcion).toMatchObject({ situacion: "PAGO_PENDIENTE", precio: 17000, vence_el: null });
    expect(proximas.find((t) => t.turno_id === cancelada.idTurno)?.inscripcion).toMatchObject({ situacion: "PAGO_SIN_REGISTRAR", precio: 17000, vence_el: null });
    expect((await propias(propio.usuarioId, MOMENTO, "anteriores")).items[0].inscripcion).toMatchObject({ situacion: "PAGO_SIN_REGISTRAR", precio: 17000, vence_el: null });
  }));

  it("reprogramar después del vencimiento no reactiva ni extiende una reserva ya vencida", () => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const turno = await crearTurnoDePrueba(db, { enDias: 3 });
    await db.horarioProfesor.create({ data: {
      profesorId: turno.profesorId!, diaSemanaHorario: "VIERNES",
      horaDesdeHorario: hora("08:00"), horaHastaHorario: hora("20:00"),
    } });
    const alta = await solicitarTurnoPropio(turno.idTurno, propio.usuarioId);
    const original = await fila(alta.inscripcion.id);
    await plazo("48");
    await conReloj(original.venceEl!, () => reprogramarTurno(turno.idTurno, {
      fecha: new Date("2026-10-09T00:00:00.000Z"), hora_inicio: "10:00",
    }, mesaId));
    expect(await fila(alta.inscripcion.id)).toMatchObject({
      vigencia: "RESERVA_VENCIDA", finalizadaEl: original.venceEl,
      venceBaseEl: original.venceBaseEl, venceEl: original.venceEl,
    });
    expect(await db.reservaTurno.count({ where: { turnoId: turno.idTurno, tipoRecurso: "ALUMNO", recursoId: propio.alumnoId } })).toBe(0);
  }));

  it("en la igualdad exacta con venceEl muestra Reserva vencida sin depender del proceso", () => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const turno = await crearTurnoDePrueba(db, { enDias: 4 });
    const alta = await solicitarTurnoPropio(turno.idTurno, propio.usuarioId);
    const limite = (await fila(alta.inscripcion.id)).venceEl!;
    expect((await propias(propio.usuarioId, new Date(limite.getTime() - 1))).items[0].inscripcion.situacion).toBe("RESERVADA");
    expect((await propias(propio.usuarioId, limite)).items[0].inscripcion.situacion).toBe("RESERVA_VENCIDA");
    expect(await obtenerConfirmacionReservaPropia(alta.inscripcion.id, propio.usuarioId, db, limite)).toMatchObject({ situacion: "RESERVA_VENCIDA" });
    expect((await fila(alta.inscripcion.id)).vigencia).toBe("VIGENTE"); // Lecturas sin mutación.
  }));

  it("una reserva de clase cancelada deja de invitar a pagar aun después de venceEl", () => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const turno = await crearTurnoDePrueba(db, { enDias: 4 });
    const alta = await solicitarTurnoPropio(turno.idTurno, propio.usuarioId);
    // Estado preparado: no acredita el flujo C-05/C-24 de cancelación del centro.
    await db.turno.update({ where: { idTurno: turno.idTurno }, data: { estadoTurno: "CANCELADO" } });
    const despues = new Date(MOMENTO.getTime() + 25 * HORA);
    // El vencimiento guardado conserva su trazabilidad; la situación decide qué se muestra.
    // C §2.17.4 exige no invitar a pagar, no borrar ni ocultar el instante del DTO.
    expect((await propias(propio.usuarioId, despues)).items[0].inscripcion).toMatchObject({ situacion: "PAGO_SIN_REGISTRAR", vence_el: alta.inscripcion.vence_el });
    expect(await obtenerConfirmacionReservaPropia(alta.inscripcion.id, propio.usuarioId, db, despues)).toMatchObject({ situacion: "PAGO_SIN_REGISTRAR", vence_el: alta.inscripcion.vence_el });
    expect((await fila(alta.inscripcion.id)).vigencia).toBe("VIGENTE");
  }));

  it.each(["RESERVA_VENCIDA", "CANCELADA_ALUMNO"] as const)("re-reserva rechazada tras %s sin pago, sin alta", (vigencia) => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const turno = await crearTurnoDePrueba(db, { enDias: 5 });
    const anterior = await solicitarTurnoPropio(turno.idTurno, propio.usuarioId);
    if (vigencia === "CANCELADA_ALUMNO") await terminar(anterior.inscripcion.id, vigencia);
    const momento = vigencia === "RESERVA_VENCIDA" ? (await fila(anterior.inscripcion.id)).venceEl! : MOMENTO;
    await conReloj(momento, async () => {
      await expect(obtenerResumenInscripcion(turno.idTurno, propio.usuarioId, db)).resolves.toMatchObject({ turno_id: turno.idTurno });
      const antes = await db.turnoAlumno.findMany({ where: { turnoId: turno.idTurno } });
      await expect(solicitarTurnoPropio(turno.idTurno, propio.usuarioId)).rejects.toMatchObject({ code: "RESERVA_PREVIA_SIN_PAGO", status: 409 });
      expect(await db.turnoAlumno.findMany({ where: { turnoId: turno.idTurno } })).toEqual(antes);
    });
  }));

  it.each(["CANCELADA_ALUMNO", "QUITADA_CENTRO", "BAJA_ALUMNO"] as const)("exclusión %s admite una reserva nueva", (vigencia) => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const turno = await crearTurnoDePrueba(db);
    const anterior = await crearInscripcionDePrueba(db, {
      turnoId: turno.idTurno, alumnoId: propio.alumnoId,
      estadoPago: vigencia === "CANCELADA_ALUMNO" ? "PAGO_SIN_REGISTRAR" : "RESERVADA",
    });
    await terminar(anterior.idInscripcion, vigencia);
    const nueva = await solicitarTurnoPropio(turno.idTurno, propio.usuarioId);
    expect(nueva.inscripcion).toMatchObject({ estado_pago: "RESERVADA" });
    expect(nueva.inscripcion.id).not.toBe(anterior.idInscripcion);
    expect((await fila(anterior.idInscripcion)).vigencia).toBe(vigencia);
    expect(await db.turnoAlumno.count({ where: { turnoId: turno.idTurno } })).toBe(2);
  }));

  it("reserva reabierta vencida queda excluida de re-reserva (estado preparado por PR 0)", () => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const turno = await crearTurnoDePrueba(db, { enDias: 5 });
    // Evidencia indirecta de I-06/C-24: la fachada recibe el conteo de pagos;
    // no ejecuta una anulación ni el endpoint de cobro pendiente I-10.
    const pagada = await transaccion((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: propio.alumnoId, origen: "PAGO", conReserva: false, actor: actorUsuario(mesaId) }), { db });
    await transaccion((tx) => recalcularEstadoPago(tx, pagada.inscripcion.id, 0, actorUsuario(mesaId)), { db });
    const reabierta = await fila(pagada.inscripcion.id);
    expect(reabierta.reabiertaPorAnulacion).toBe(true);
    await conReloj(reabierta.venceEl!, async () => {
      const nueva = await solicitarTurnoPropio(turno.idTurno, propio.usuarioId);
      expect(nueva.inscripcion.id).not.toBe(reabierta.idInscripcion);
      expect((await fila(reabierta.idInscripcion)).vigencia).toBe("RESERVA_VENCIDA");
    });
  }));

  it("pago histórico pertenece a la inscripción cancelada; la nueva sigue Reservada", () => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const turno = await crearTurnoDePrueba(db);
    const anterior = await solicitarTurnoPropio(turno.idTurno, propio.usuarioId);
    const caja = await abrirCajaDePrueba(db, { usuarioId: mesaId });
    const nombre = unico("fp");
    const forma = await db.formaPago.create({ data: { nombreFormaPago: nombre, nombreNormalizadaFormaPago: nombre } });
    // Persistencia real de pagos por fábrica; no acredita el flujo HTTP I-10.
    const cobro = await crearOperacionDePrueba(db, { cajaId: caja.idCaja, inscripcionIds: [anterior.inscripcion.id], formaPagoId: forma.idFormaPago });
    expect((await propias(propio.usuarioId)).items[0].inscripcion.situacion).toBe("PAGADA");
    await terminar(anterior.inscripcion.id, "CANCELADA_ALUMNO");
    const nueva = await solicitarTurnoPropio(turno.idTurno, propio.usuarioId);
    expect(nueva.inscripcion.estado_pago).toBe("RESERVADA");
    expect((await propias(propio.usuarioId)).items[0].inscripcion).toMatchObject({ id: nueva.inscripcion.id, situacion: "RESERVADA" });
    expect(await db.pago.count({ where: { inscripcionId: nueva.inscripcion.id } })).toBe(0);
    expect(await db.pago.findUniqueOrThrow({ where: { idPago: cobro.pagos[0].idPago } })).toMatchObject({ inscripcionId: anterior.inscripcion.id });
  }));

  it("quitar por el centro preserva fila, fecha y usuario, libera cupo y horario y permite nueva alta", () => conReloj(MOMENTO, async () => {
    const propio = await alumno();
    const turno = await crearTurnoDePrueba(db, { cupo: 1 });
    const alta = await solicitarTurnoPropio(turno.idTurno, propio.usuarioId);
    const guardada = await fila(alta.inscripcion.id);
    await quitarAlumnoTurno(turno.idTurno, propio.alumnoId, mesaId);
    expect(await fila(alta.inscripcion.id)).toMatchObject({ vigencia: "QUITADA_CENTRO", finalizadaEl: MOMENTO, finalizadaPorUsuarioId: mesaId, finalizadaPorActorTipo: "USUARIO", precio: guardada.precio, venceEl: guardada.venceEl });
    expect(await db.reservaTurno.count({ where: { turnoId: turno.idTurno, tipoRecurso: "ALUMNO", recursoId: propio.alumnoId } })).toBe(0);
    expect(await db.turno.findUniqueOrThrow({ where: { idTurno: turno.idTurno } })).toMatchObject({ estadoTurno: "DISPONIBLE" });
    expect((await propias(propio.usuarioId)).items[0].inscripcion.situacion).toBe("QUITADA_CENTRO");
    const nueva = await solicitarTurnoPropio(turno.idTurno, propio.usuarioId);
    expect(nueva.inscripcion.id).not.toBe(alta.inscripcion.id);
    expect(await db.turnoAlumno.count({ where: { turnoId: turno.idTurno } })).toBe(2);
  }));
});
