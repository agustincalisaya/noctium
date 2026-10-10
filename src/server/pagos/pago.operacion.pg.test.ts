import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  abrirCajaDePrueba, crearAlumnoDePrueba, crearFichaMesaEntradaDePrueba, crearInscripcionDePrueba, crearMateriaDePrueba, crearTurnoDePrueba, unico,
} from "@/server/testing/fabricas";
import { ahora } from "@/server/shared/reloj";
import { listarClasesPendientesDePago, registrarOperacionDePago } from "@/server/pagos/pago.service";

// PostgreSQL real (`npm run test:pg -- <ruta>`): HU-I-10 de punta a punta
// sobre los servicios (spec_modulo_I.md §2.7.2-2.7.5), con las comprobaciones
// de la capa de datos del Nivel 3 de la task. Las filas quedan como evidencia.
describe.skipIf(!basePgHabilitada)("HU-I-10 registrar pago buscando al alumno con PostgreSQL real", () => {
  let db: PrismaClient;
  let autor: string;
  let formaId: string;
  let materiaId: string;
  const HORA = 60 * 60 * 1000;

  beforeAll(async () => {
    db = clientePg();
    autor = (await crearFichaMesaEntradaDePrueba(db)).usuarioId!;
    await abrirCajaDePrueba(db, { usuarioId: autor });
    const nombre = unico("fp");
    formaId = (await db.formaPago.create({ data: { nombreFormaPago: nombre, nombreNormalizadaFormaPago: nombre.toLowerCase() } })).idFormaPago;
    materiaId = (await crearMateriaDePrueba(db, { tarifaHora: 15000 })).idMateria;
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("dos clases en una operación: una OperacionPago, dos Pago con el mismo operacionId, inscripciones PAGADA y un comprobante", async () => {
    const alumno = await crearAlumnoDePrueba(db);
    const a = await crearTurnoDePrueba(db, { enDias: 3, hora: "18:00", materiaId });
    const b = await crearTurnoDePrueba(db, { enDias: 4, hora: "18:00", materiaId });
    const ia = await crearInscripcionDePrueba(db, { turnoId: a.idTurno, alumnoId: alumno.idAlumno, estadoPago: "RESERVADA", precio: 12000 });
    const ib = await crearInscripcionDePrueba(db, { turnoId: b.idTurno, alumnoId: alumno.idAlumno, precio: 11000 });

    const pendientes = await listarClasesPendientesDePago(alumno.idAlumno);
    expect(pendientes.clases.map((c) => [c.inscripcion_id, c.estado_pago, c.precio])).toEqual([[ia.idInscripcion, "RESERVADA", 12000], [ib.idInscripcion, "PAGO_SIN_REGISTRAR", 11000]]);

    const respuesta = await registrarOperacionDePago({
      alumno_id: alumno.idAlumno, forma_pago_id: formaId,
      items: [{ inscripcion_id: ia.idInscripcion, monto: "12000" }, { inscripcion_id: ib.idInscripcion, monto: "10000", motivo_ajuste: "Beca" }],
    }, autor);
    expect(respuesta).toMatchObject({ total: "22000.00", pagos: [{ monto: "12000.00", motivo_ajuste: null }, { monto: "10000.00", motivo_ajuste: "Beca" }] });

    const operaciones = await db.operacionPago.findMany({ where: { alumnoId: alumno.idAlumno } });
    expect(operaciones).toHaveLength(1);
    const pagos = await db.pago.findMany({ where: { operacionId: operaciones[0]!.idOperacionPago }, orderBy: { precio: "desc" } });
    expect(pagos.map((p) => [p.inscripcionId, p.precio, p.montoPago.toFixed(2), p.motivoAjuste, p.ajustadoPorUsuarioId])).toEqual([
      [ia.idInscripcion, 12000, "12000.00", null, null],
      [ib.idInscripcion, 11000, "10000.00", "Beca", autor],
    ]);
    const inscripciones = await db.turnoAlumno.findMany({ where: { idInscripcion: { in: [ia.idInscripcion, ib.idInscripcion] } } });
    expect(inscripciones.every((i) => i.estadoPago === "PAGADA")).toBe(true);
    expect(await db.comprobante.count({ where: { operacionId: operaciones[0]!.idOperacionPago } })).toBe(1);
    // Una clase se paga una sola vez: ya no figuran como pendientes.
    expect((await listarClasesPendientesDePago(alumno.idAlumno)).clases).toEqual([]);
  });

  it("todo o nada: con una clase ya empezada no se registra ninguna", async () => {
    const alumno = await crearAlumnoDePrueba(db);
    const futura = await crearTurnoDePrueba(db, { enDias: 5, hora: "18:00", materiaId });
    const empezada = await crearTurnoDePrueba(db, { enDias: -1, hora: "18:00", materiaId });
    const iFutura = await crearInscripcionDePrueba(db, { turnoId: futura.idTurno, alumnoId: alumno.idAlumno });
    const iEmpezada = await crearInscripcionDePrueba(db, { turnoId: empezada.idTurno, alumnoId: alumno.idAlumno });

    await expect(registrarOperacionDePago({
      alumno_id: alumno.idAlumno, forma_pago_id: formaId,
      items: [{ inscripcion_id: iFutura.idInscripcion, monto: "12000" }, { inscripcion_id: iEmpezada.idInscripcion, monto: "12000" }],
    }, autor)).rejects.toMatchObject({ code: "TURNO_YA_EMPEZO", status: 409, datos: { turno_id: empezada.idTurno } });
    expect(await db.operacionPago.count({ where: { alumnoId: alumno.idAlumno } })).toBe(0);
    expect(await db.pago.count({ where: { alumnoId: alumno.idAlumno } })).toBe(0);
    expect((await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: iFutura.idInscripcion } })).estadoPago).toBe("PAGO_SIN_REGISTRAR");
  });

  it("monto distinto del precio sin motivo: 400 MOTIVO_AJUSTE_REQUERIDO con precio_vigente", async () => {
    const alumno = await crearAlumnoDePrueba(db);
    const turno = await crearTurnoDePrueba(db, { enDias: 6, hora: "18:00", materiaId });
    const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, precio: 12000 });
    await expect(registrarOperacionDePago({
      alumno_id: alumno.idAlumno, forma_pago_id: formaId, items: [{ inscripcion_id: inscripcion.idInscripcion, monto: "9000" }],
    }, autor)).rejects.toMatchObject({ code: "MOTIVO_AJUSTE_REQUERIDO", status: 400, datos: { turno_id: turno.idTurno, precio_vigente: 12000 } });
  });

  it("«Se inscribe al confirmar el pago»: tras una reserva vencida, la fila usa la tarifa vigente y la inscripción nace PAGADA con ese precio", async () => {
    const alumno = await crearAlumnoDePrueba(db);
    const turno = await crearTurnoDePrueba(db, { enDias: 7, hora: "18:00", materiaId });
    // Reserva con precio viejo y plazo de 1 h que ya venció (sin marcar).
    await crearInscripcionDePrueba(db, {
      turnoId: turno.idTurno, alumnoId: alumno.idAlumno, estadoPago: "RESERVADA", precio: 12000,
      reservadaEl: new Date(ahora().getTime() - 2 * HORA), plazoHoras: 1,
    });

    expect((await listarClasesPendientesDePago(alumno.idAlumno)).clases).toEqual([]);
    const { clases } = await listarClasesPendientesDePago(alumno.idAlumno, turno.idTurno);
    expect(clases).toEqual([expect.objectContaining({ inscripcion_id: null, estado_pago: "SE_INSCRIBE_AL_PAGAR", precio: 15000, origen_precio: "TARIFA_VIGENTE", marcada: true })]);

    const respuesta = await registrarOperacionDePago({
      alumno_id: alumno.idAlumno, forma_pago_id: formaId, items: [{ turno_id: turno.idTurno, monto: "15000" }],
    }, autor);
    const nueva = await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: respuesta.pagos[0]!.inscripcion_id } });
    expect(nueva).toMatchObject({ vigencia: "VIGENTE", estadoPago: "PAGADA", precio: 15000 });
    expect(respuesta.pagos[0]).toMatchObject({ precio: 15000, monto: "15000.00" });
  });

  it("sin caja abierta: 409 CAJA_NO_ABIERTA", async () => {
    const otro = (await crearFichaMesaEntradaDePrueba(db)).usuarioId!;
    const alumno = await crearAlumnoDePrueba(db);
    const turno = await crearTurnoDePrueba(db, { enDias: 8, hora: "18:00", materiaId });
    const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno });
    await expect(registrarOperacionDePago({
      alumno_id: alumno.idAlumno, forma_pago_id: formaId, items: [{ inscripcion_id: inscripcion.idInscripcion, monto: "12000" }],
    }, otro)).rejects.toMatchObject({ code: "CAJA_NO_ABIERTA", status: 409 });
  });
});
