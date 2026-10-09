import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { abrirCajaDePrueba } from "@/server/testing/fabricas";
import { listarPagosDeTurno, sumarPagosPorMes } from "./pago.publico";

// Inscripción vigente sin plazo de pago (PR-0.md §2.1 y §2.15): los campos que la fila exige desde el PR 0.
const SIN_PLAZO = { estadoPago: "PAGO_SIN_REGISTRAR", precio: 10000, reservadaEl: new Date() } as const;

// Misma guarda que turno.publico.pg.test.ts: nunca escribir en la base habitual.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const prefijo = `pgpago${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const id = (sufijo: string) => `${prefijo}-${sufijo}`;
const dia = (valor: string) => new Date(`${valor}T00:00:00.000Z`);

describe.skipIf(!habilitada)("pago.publico: PostgreSQL real aislado", () => {
  // Desde el PR 0 (2.3) cada pago pertenece a una operación de una caja y a una
  // inscripción del par (alumno, turno): mismos datos de Sprint 2, con esas filas.
  let cajaId: string;
  const inscripciones = new Map<string, string>();
  async function inscripcion(turnoId: string, alumnoId: string) {
    const clave = `${turnoId}|${alumnoId}`;
    if (!inscripciones.has(clave)) {
      inscripciones.set(clave, (await db!.turnoAlumno.create({ data: { turnoId, alumnoId, ...SIN_PLAZO } })).idInscripcion);
    }
    return inscripciones.get(clave)!;
  }
  async function crearPagos(pagos: { idPago: string; turnoId: string; alumnoId: string; montoPago: string; formaPagoId: string; fechaPago: Date; createdAtPago?: Date }[]) {
    for (const pago of pagos) {
      const operacion = await db!.operacionPago.create({ data: {
        alumnoId: pago.alumnoId, formaPagoId: pago.formaPagoId, fechaPago: pago.fechaPago, creadoPorUsuarioId: (await db!.caja.findUniqueOrThrow({ where: { idCaja: cajaId } })).usuarioId,
        registradaEl: pago.createdAtPago ?? new Date(), cajaId,
      } });
      await db!.pago.create({ data: {
        ...pago, creadoPorUsuarioId: operacion.creadoPorUsuarioId, operacionId: operacion.idOperacionPago,
        inscripcionId: await inscripcion(pago.turnoId, pago.alumnoId), precio: SIN_PLAZO.precio,
      } });
    }
  }

  beforeAll(async () => {
    cajaId = (await abrirCajaDePrueba(db!)).idCaja;
    // Fixtures propias (sin seed.ts): un turno con un inscripto, un alumno ya
    // retirado que igual tiene un pago, y una forma de pago hoy inactiva.
    await db!.materia.create({ data: { idMateria: id("m"), nombreMateria: id("m"), nombreNormalizadaMateria: id("m") } });
    for (const [sufijo, apellido] of [["s1", "Pérez"], ["s2", "Gómez"]] as const) {
      await db!.alumno.create({
        data: {
          idAlumno: id(sufijo), nombreAlumno: "Ana", apellidoAlumno: apellido,
          nombreNormalizadoAlumno: "ana", apellidoNormalizadoAlumno: apellido.toLowerCase(),
          dniAlumno: `${prefijo}-dni-${sufijo}`, fechaNacimientoAlumno: dia("2000-01-01"),
        },
      });
    }
    for (const [sufijo, activa] of [["fa", true], ["fi", false]] as const) {
      await db!.formaPago.create({
        data: { idFormaPago: id(sufijo), nombreFormaPago: id(sufijo), nombreNormalizadaFormaPago: id(sufijo), activaFormaPago: activa },
      });
    }
    for (const sufijo of ["t", "t-vacio"]) {
      await db!.turno.create({
        data: {
          idTurno: id(sufijo), fechaTurno: dia("2026-09-20"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"),
          duracionMinutosTurno: 60, cupoMaximoTurno: 4, materiaId: id("m"), estadoTurno: "PENDIENTE",
        },
      });
    }
    await inscripcion(id("t"), id("s1"));
    await crearPagos(
      [
        { idPago: id("p1"), turnoId: id("t"), alumnoId: id("s1"), montoPago: "15000.50", formaPagoId: id("fa"), fechaPago: dia("2026-09-20"), createdAtPago: new Date("2026-09-20T13:00:00.000Z") },
        { idPago: id("p2"), turnoId: id("t"), alumnoId: id("s2"), montoPago: "12000", formaPagoId: id("fi"), fechaPago: dia("2026-09-21"), createdAtPago: new Date("2026-09-21T13:00:00.000Z") },
      ],
    );
    // El alumno s2 ya no está inscripto: su inscripción se finalizó (no se borra, PR-0.md §2.0).
    await db!.turnoAlumno.update({
      where: { idInscripcion: inscripciones.get(`${id("t")}|${id("s2")}`)! },
      data: { vigencia: "QUITADA_CENTRO", finalizadaEl: new Date(), finalizadaPorActorTipo: "PROCESO_AUTOMATICO" },
    });
  });

  afterAll(async () => {
    try {
      if (db) {
        await db.pago.deleteMany({ where: { idPago: { startsWith: prefijo } } });
        await db.operacionPago.deleteMany({ where: { alumnoId: { startsWith: prefijo } } });
        await db.eventoTurno.deleteMany({ where: { turnoId: { startsWith: prefijo } } });
        await db.turno.deleteMany({ where: { idTurno: { startsWith: prefijo } } });
        await db.alumno.deleteMany({ where: { idAlumno: { startsWith: prefijo } } });
        await db.formaPago.deleteMany({ where: { idFormaPago: { startsWith: prefijo } } });
        await db.materia.deleteMany({ where: { idMateria: { startsWith: prefijo } } });
      }
    } finally {
      await db?.$disconnect();
    }
  });

  it("lista todos los pagos del turno, más recientes primero, incluido el de un alumno no inscripto", async () => {
    await expect(listarPagosDeTurno(id("t"), db!)).resolves.toEqual([
      {
        id: id("p2"), alumno: { id: id("s2"), nombre_completo: "Gómez, Ana" }, monto: "12000.00",
        forma_pago: { id: id("fi"), nombre: id("fi") }, fecha_pago: "2026-09-21", registrado_en: "2026-09-21T13:00:00.000Z",
      },
      {
        id: id("p1"), alumno: { id: id("s1"), nombre_completo: "Pérez, Ana" }, monto: "15000.50",
        forma_pago: { id: id("fa"), nombre: id("fa") }, fecha_pago: "2026-09-20", registrado_en: "2026-09-20T13:00:00.000Z",
      },
    ]);
  });

  it("devuelve [] para un turno sin pagos y para un id inexistente", async () => {
    await expect(listarPagosDeTurno(id("t-vacio"), db!)).resolves.toEqual([]);
    await expect(listarPagosDeTurno(id("inexistente"), db!)).resolves.toEqual([]);
  });

  it("funciona dentro de una transacción del llamador", async () => {
    const pagos = await db!.$transaction((tx) => listarPagosDeTurno(id("t"), tx));
    expect(pagos.map(({ id: pagoId }) => pagoId)).toEqual([id("p2"), id("p1")]);
  });

  it("sumarPagosPorMes suma exacto por mes de fechaPago, incluye pagos de turnos cancelados y cruza año", async () => {
    // Años lejanos para no mezclarse con otros pagos de la base de test (la suma es global).
    const anio = new Date().getUTCFullYear() + 10;
    await db!.turno.create({
      data: {
        idTurno: id("t-cancelado"), fechaTurno: dia(`${anio}-12-01`), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"),
        duracionMinutosTurno: 60, cupoMaximoTurno: 4, materiaId: id("m"), estadoTurno: "CANCELADO",
      },
    });
    await crearPagos(
      [
        { idPago: id("s-nov"), turnoId: id("t"), alumnoId: id("s1"), montoPago: "999", formaPagoId: id("fa"), fechaPago: dia(`${anio}-11-30`) },
        { idPago: id("s-dic1"), turnoId: id("t"), alumnoId: id("s1"), montoPago: "0.10", formaPagoId: id("fa"), fechaPago: dia(`${anio}-12-01`) },
        { idPago: id("s-dic2"), turnoId: id("t-cancelado"), alumnoId: id("s2"), montoPago: "0.20", formaPagoId: id("fi"), fechaPago: dia(`${anio}-12-31`) },
        { idPago: id("s-ene"), turnoId: id("t"), alumnoId: id("s1"), montoPago: "15000.50", formaPagoId: id("fa"), fechaPago: dia(`${anio + 1}-01-31`) },
        { idPago: id("s-mar"), turnoId: id("t"), alumnoId: id("s1"), montoPago: "1", formaPagoId: id("fa"), fechaPago: dia(`${anio + 1}-03-01`) },
      ],
    );
    // 0.10 + 0.20 = "0.30" exacto (en coma flotante sería 0.30000000000000004); febrero no aparece.
    await expect(sumarPagosPorMes(`${anio}-12`, `${anio + 1}-02`, db!)).resolves.toEqual([
      { mes: `${anio}-12`, total: "0.30" },
      { mes: `${anio + 1}-01`, total: "15000.50" },
    ]);
  });
});
