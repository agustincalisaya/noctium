import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { registrarPago } from "@/server/pagos/pago.service";
import { listarPagosDeTurno } from "@/server/pagos/pago.publico";
import { abrirCajaDePrueba, crearFichaMesaEntradaDePrueba } from "@/server/testing/fabricas";

// Inscripción vigente sin plazo de pago (PR-0.md §2.1 y §2.15): los campos que la fila exige desde el PR 0.
const SIN_PLAZO = { estadoPago: "PAGO_SIN_REGISTRAR", precio: 10000, reservadaEl: new Date() } as const;

// Igual que los tests PostgreSQL existentes: nunca usar la base habitual.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const prefijo = `hui01${randomUUID().replaceAll("-", "").slice(0, 14)}`;
// Desde el PR 0 cobrar exige una caja abierta de quien registra (2.15): el autor
// es una cuenta de mesa de entrada con su ficha y su caja.
let autor: string;
let alumnoId: string;
let formaId: string;
let turnoId: string;
let concurrenteId: string;

describe.skipIf(!habilitada)("HU-I-01 PostgreSQL aislado", () => {
  beforeAll(async () => {
    autor = (await crearFichaMesaEntradaDePrueba(db!)).usuarioId!;
    await abrirCajaDePrueba(db!, { usuarioId: autor });
    const materia = await db!.materia.create({ data: { nombreMateria: prefijo, nombreNormalizadaMateria: prefijo } });
    const alumno = await db!.alumno.create({ data: {
      nombreAlumno: "Lara", apellidoAlumno: prefijo, nombreNormalizadoAlumno: "lara", apellidoNormalizadoAlumno: prefijo,
      dniAlumno: prefijo, fechaNacimientoAlumno: new Date("2005-01-01"), activoAlumno: false,
    } });
    alumnoId = alumno.idAlumno;
    const forma = await db!.formaPago.create({ data: { nombreFormaPago: prefijo, nombreNormalizadaFormaPago: prefijo } });
    formaId = forma.idFormaPago;
    const crear = (fecha = "2020-01-01") => db!.turno.create({ data: {
      materiaId: materia.idMateria, fechaTurno: new Date(fecha), horaInicioTurno: new Date("1970-01-01T16:00:00Z"),
      duracionMinutosTurno: 60, estadoTurno: "DISPONIBLE", cupoMaximoTurno: 1,
      alumnos: { create: { alumnoId, ...SIN_PLAZO } },
    } });
    turnoId = (await crear()).idTurno;
    concurrenteId = (await crear("2020-01-02")).idTurno;
  });
  // Las filas quedan en la base descartable como evidencia; no se borran pagos.
  afterAll(async () => db?.$disconnect());
  const input = (monto = "0.10") => ({ turno_id: turnoId, alumno_id: alumnoId, forma_pago_id: formaId, monto });

  it("guarda Decimal, fecha, autor y timestamp en un turno vencido con alumno inactivo", async () => {
    const pago = await registrarPago(input(), autor);
    const fila = await db!.pago.findUniqueOrThrow({ where: { idPago: pago.id } });
    expect(fila.montoPago.toFixed(2)).toBe("0.10");
    expect(fila.alumnoId).toBe(alumnoId); expect(fila.creadoPorUsuarioId).toBe(autor);
    expect(fila.createdAtPago).toBeInstanceOf(Date);
    expect(fila.fechaPago.toISOString().slice(0, 10)).toBe(pago.fecha_pago);
  });
  it("dos parciales concurrentes generan dos filas y suman exactamente 0.30", async () => {
    const pagos = await Promise.all([registrarPago(input("0.10"), autor), registrarPago(input("0.20"), autor)]);
    expect(pagos[0].id).not.toBe(pagos[1].id);
    const suma = await db!.pago.aggregate({ where: { idPago: { in: pagos.map(({ id }) => id) } }, _sum: { montoPago: true } });
    expect(suma._sum.montoPago!.toFixed(2)).toBe("0.30");
  });
  it("un rechazo de fecha futura no inserta filas", async () => {
    const antes = await db!.pago.count({ where: { turnoId } });
    await expect(registrarPago({ ...input(), fecha_pago: new Date("2099-01-01") }, autor)).rejects.toMatchObject({ code: "FECHA_PAGO_FUTURA" });
    expect(await db!.pago.count({ where: { turnoId } })).toBe(antes);
  });
  it("histórico conserva el pago después de quitar inscripción y desactivar la forma", async () => {
    // Quitar no borra (PR-0.md §2.0): la inscripción deja de ser vigente.
    await db!.turnoAlumno.updateMany({
      where: { turnoId, alumnoId, vigencia: "VIGENTE" },
      data: { vigencia: "QUITADA_CENTRO", finalizadaEl: new Date(), finalizadaPorActorTipo: "PROCESO_AUTOMATICO" },
    });
    await db!.formaPago.update({ where: { idFormaPago: formaId }, data: { activaFormaPago: false } });
    const pagos = await listarPagosDeTurno(turnoId);
    expect(pagos).toHaveLength(3);
    expect(pagos.every((pago) => pago.alumno.id === alumnoId && pago.forma_pago.nombre === prefijo)).toBe(true);
  });
  it("cancelación concurrente: FOR SHARE espera al UPDATE y luego rechaza sin INSERT", async () => {
    let desbloquear!: () => void;
    let bloqueado!: () => void;
    const espera = new Promise<void>((resolver) => { desbloquear = resolver; });
    const listo = new Promise<void>((resolver) => { bloqueado = resolver; });
    const cancelacion = db!.$transaction(async (tx) => {
      await tx.turno.update({ where: { idTurno: concurrenteId }, data: { estadoTurno: "CANCELADO" } });
      bloqueado(); await espera;
    });
    await listo;
    let resuelto = false;
    const pago = registrarPago({ ...input(), turno_id: concurrenteId }, autor)
      .then(() => { resuelto = true; return null; }, (error: unknown) => { resuelto = true; return error; });
    try {
      // Comprobar que el lector sigue bloqueado mientras la cancelación no hizo commit.
      await new Promise((resolver) => setTimeout(resolver, 100));
      expect(resuelto).toBe(false);
    } finally { desbloquear(); }
    await cancelacion;
    expect(await pago).toMatchObject({ code: "TURNO_NO_ADMITE_PAGO" });
    expect(await db!.pago.count({ where: { turnoId: concurrenteId } })).toBe(0);
  });
});
