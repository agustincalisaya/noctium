import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { abrirCajaDePrueba, crearAlumnoDePrueba, crearInscripcionDePrueba, crearOperacionDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { conReloj } from "@/server/shared/reloj";
import { listarReservasVencidas } from "@/server/turnos/inscripcion.publico";
import { quitarReservaPendiente } from "@/server/turnos/reserva.pendiente.service";
import { agregarAlumnoTurno, quitarAlumnoTurno } from "@/server/turnos/turno.service";

// HU-C-26 «Quitar» (spec_modulo_C.md §2.20.4) contra PostgreSQL descartable de
// `npm run test:pg`: la condición atómica real de `finalizarInscripcion` con
// `soloSiReservaPendiente`, la marca previa de vencidas, la liberación del
// lugar, el historial y el payload ampliado de `turno:alumno_quitado` (§4).
const MOMENTO = new Date("2026-10-05T12:00:00.000Z"); // Lunes, 09:00 del centro.
const HORA = 3_600_000;

describe.skipIf(!basePgHabilitada)("HU-C-26: quitar una reserva pendiente en PostgreSQL real", () => {
  let db: PrismaClient;
  let mesaId: string;

  const alumno = async () => (await crearAlumnoDePrueba(db)).idAlumno;
  const fila = (idInscripcion: string) => db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion } });
  const estadoClase = async (idTurno: string) => (await db.turno.findUniqueOrThrow({ where: { idTurno } })).estadoTurno;
  const historial = (inscripcionId: string) => db.historialInscripcion.findMany({ where: { inscripcionId }, orderBy: { fecha: "asc" } });
  const eventos = (turnoId: string) => db.eventoTurno.findMany({ where: { turnoId }, orderBy: { creadoEnEvento: "asc" } });
  /** Reserva vigente a MOMENTO: hecha hace una hora. */
  const reserva = (turnoId: string, alumnoId: string) =>
    crearInscripcionDePrueba(db, { turnoId, alumnoId, estadoPago: "RESERVADA", reservadaEl: new Date(MOMENTO.getTime() - HORA) });
  /** Reserva ya vencida a MOMENTO, sin marcar: hecha hace 25 h con plazo de 24 h. */
  const vencidaSinMarcar = (turnoId: string, alumnoId: string) =>
    crearInscripcionDePrueba(db, { turnoId, alumnoId, estadoPago: "RESERVADA", reservadaEl: new Date(MOMENTO.getTime() - 25 * HORA) });

  beforeAll(async () => {
    db = clientePg();
    mesaId = (await crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA" })).idUsuario;
  });
  afterAll(async () => {
    if (db) await db.$disconnect();
    await prisma.$disconnect();
  });

  it("quita la reserva: QUITADA_CENTRO con fecha y usuario, sin borrar la fila, libera el lugar y no impide volver a inscribir", () => conReloj(MOMENTO, async () => {
    const turno = await crearTurnoDePrueba(db, { cupo: 1, estado: "COMPLETO" });
    const alumnoId = await alumno();
    const inscripcion = await reserva(turno.idTurno, alumnoId);

    await expect(quitarReservaPendiente(inscripcion.idInscripcion, mesaId)).resolves.toEqual({
      inscripcion_id: inscripcion.idInscripcion, vigencia: "QUITADA_CENTRO", alumnos_inscriptos: "0/1", estado: "DISPONIBLE",
    });

    // Regla N.° 1: la fila sigue, con su trazabilidad (opción a de la Regla N.° 2).
    const despues = await fila(inscripcion.idInscripcion);
    expect(despues).toMatchObject({ vigencia: "QUITADA_CENTRO", estadoPago: "RESERVADA", finalizadaPorActorTipo: "USUARIO", finalizadaPorUsuarioId: mesaId, precio: inscripcion.precio });
    expect(despues.finalizadaEl).toEqual(MOMENTO);
    expect(await estadoClase(turno.idTurno)).toBe("DISPONIBLE");
    // Historial de estados del PR 0, escrito después del commit.
    expect(await historial(inscripcion.idInscripcion)).toEqual([expect.objectContaining({
      vigenciaAnterior: "VIGENTE", vigenciaNueva: "QUITADA_CENTRO", actorTipo: "USUARIO", usuarioId: mesaId,
    })]);
    // Eventos con el payload ampliado (Revisión 6, §4).
    expect((await eventos(turno.idTurno)).map((e) => [e.tipoEvento, e.payloadEvento])).toEqual([
      ["turno:alumno_quitado", { turno_id: turno.idTurno, alumno_id: alumnoId, inscripcion_id: inscripcion.idInscripcion, usuario_id: mesaId }],
      ["turno:disponible_nuevamente", { turno_id: turno.idTurno, alumno_id_liberado: alumnoId, usuario_id: mesaId }],
    ]);
    // El mismo alumno se puede volver a inscribir (§2.20.4 paso 3).
    await expect(agregarAlumnoTurno(turno.idTurno, { alumno_id: alumnoId }, mesaId)).resolves.toMatchObject({ alumnos_inscriptos: "1/1", estado: "COMPLETO" });
  }));

  it("una reserva ya pagada: 409 RESERVA_NO_PENDIENTE y nada cambia", () => conReloj(MOMENTO, async () => {
    const turno = await crearTurnoDePrueba(db, { cupo: 1, estado: "COMPLETO" });
    const inscripcion = await reserva(turno.idTurno, await alumno());
    await crearOperacionDePrueba(db, { cajaId: (await abrirCajaDePrueba(db)).idCaja, inscripcionIds: [inscripcion.idInscripcion] });
    const antes = await fila(inscripcion.idInscripcion);
    expect(antes).toMatchObject({ vigencia: "VIGENTE", estadoPago: "PAGADA" });

    await expect(quitarReservaPendiente(inscripcion.idInscripcion, mesaId)).rejects.toMatchObject({
      code: "RESERVA_NO_PENDIENTE", status: 409, message: "Esta reserva ya no está pendiente: se pagó o venció.",
    });
    expect(await fila(inscripcion.idInscripcion)).toEqual(antes);
    expect(await estadoClase(turno.idTurno)).toBe("COMPLETO");
    expect(await historial(inscripcion.idInscripcion)).toHaveLength(0);
    expect(await eventos(turno.idTurno)).toHaveLength(0);
  }));

  it("una reserva vencida sin marcar: se marca dentro de la transacción y se rechaza; nunca se quita como si siguiera pendiente", () => conReloj(MOMENTO, async () => {
    const turno = await crearTurnoDePrueba(db);
    const inscripcion = await vencidaSinMarcar(turno.idTurno, await alumno());
    const antes = await fila(inscripcion.idInscripcion);
    expect(antes).toMatchObject({ vigencia: "VIGENTE", estadoPago: "RESERVADA" });

    await expect(quitarReservaPendiente(inscripcion.idInscripcion, mesaId)).rejects.toMatchObject({ code: "RESERVA_NO_PENDIENTE", status: 409 });
    // El rechazo revierte toda la transacción, también la marca de vencimiento:
    // la fila queda como estaba (la marca la próxima corrida del proceso u otra
    // operación sobre la clase) y nunca pasa a QUITADA_CENTRO.
    expect(await fila(inscripcion.idInscripcion)).toEqual(antes);
    expect(await historial(inscripcion.idInscripcion)).toHaveLength(0);
    expect(await eventos(turno.idTurno)).toHaveLength(0);
  }));

  it("una reserva ya marcada como vencida: 409 RESERVA_NO_PENDIENTE", () => conReloj(MOMENTO, async () => {
    const turno = await crearTurnoDePrueba(db);
    const inscripcion = await vencidaSinMarcar(turno.idTurno, await alumno());
    await db.turnoAlumno.update({ where: { idInscripcion: inscripcion.idInscripcion }, data: { vigencia: "RESERVA_VENCIDA", finalizadaEl: inscripcion.venceEl, finalizadaPorActorTipo: "PROCESO_AUTOMATICO" } });
    await expect(quitarReservaPendiente(inscripcion.idInscripcion, mesaId)).rejects.toMatchObject({ code: "RESERVA_NO_PENDIENTE" });
    expect(await fila(inscripcion.idInscripcion)).toMatchObject({ vigencia: "RESERVA_VENCIDA" });
  }));

  it("una inscripción inexistente: 404 INSCRIPCION_NO_ENCONTRADA", () => conReloj(MOMENTO, async () => {
    await expect(quitarReservaPendiente("no-existe", mesaId)).rejects.toMatchObject({ code: "INSCRIPCION_NO_ENCONTRADA", status: 404 });
  }));

  it("dos «Quitar» simultáneos sobre la misma reserva: uno quita y el otro recibe RESERVA_NO_PENDIENTE", () => conReloj(MOMENTO, async () => {
    const turno = await crearTurnoDePrueba(db);
    const inscripcion = await reserva(turno.idTurno, await alumno());
    const resultados = await Promise.allSettled([
      quitarReservaPendiente(inscripcion.idInscripcion, mesaId),
      quitarReservaPendiente(inscripcion.idInscripcion, mesaId),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "RESERVA_NO_PENDIENTE" } });
    expect(await historial(inscripcion.idInscripcion)).toHaveLength(1);
  }));

  it("quitar desde el detalle de la clase (2.5, HU-C-04) también emite `inscripcion_id` en turno:alumno_quitado", () => conReloj(MOMENTO, async () => {
    const turno = await crearTurnoDePrueba(db);
    const alumnoId = await alumno();
    const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId });
    await quitarAlumnoTurno(turno.idTurno, alumnoId, mesaId);
    const [evento] = await eventos(turno.idTurno);
    expect(evento).toMatchObject({ tipoEvento: "turno:alumno_quitado", payloadEvento: { turno_id: turno.idTurno, alumno_id: alumnoId, inscripcion_id: inscripcion.idInscripcion, usuario_id: mesaId } });
  }));

  it("la pestaña Vencidas trae el profesor y el aula de la clase (foto del prototipo, nota de sincronización §2.20.3)", () => conReloj(MOMENTO, async () => {
    const turno = await crearTurnoDePrueba(db);
    const alumnoId = await alumno();
    const inscripcion = await vencidaSinMarcar(turno.idTurno, alumnoId);
    const dni = (await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumnoId } })).dniAlumno;
    const { items } = await listarReservasVencidas({ alumno: dni }, db);
    const profesor = await db.profesor.findUniqueOrThrow({ where: { idProfesor: turno.profesorId! } });
    const aula = await db.aula.findUniqueOrThrow({ where: { idAula: turno.aulaId! } });
    expect(items).toEqual([expect.objectContaining({
      inscripcion_id: inscripcion.idInscripcion, sin_marcar: true,
      clase: expect.objectContaining({ turno_id: turno.idTurno, aula: { id: aula.idAula, nombre: aula.nombreAula } }),
      profesor: { id: profesor.idProfesor, nombre_para_mostrar: `${profesor.apellidoProfesor}, ${profesor.nombreProfesor}` },
    })]);
  }));
});
