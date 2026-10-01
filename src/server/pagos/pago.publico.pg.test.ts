import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { listarPagosDeTurno } from "./pago.publico";

// Misma guarda que turno.publico.pg.test.ts: nunca escribir en la base habitual.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const prefijo = `pgpago${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const id = (sufijo: string) => `${prefijo}-${sufijo}`;
const dia = (valor: string) => new Date(`${valor}T00:00:00.000Z`);

describe.skipIf(!habilitada)("pago.publico: PostgreSQL real aislado", () => {
  beforeAll(async () => {
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
    await db!.turnoAlumno.create({ data: { turnoId: id("t"), alumnoId: id("s1") } });
    await db!.pago.createMany({
      data: [
        { idPago: id("p1"), turnoId: id("t"), alumnoId: id("s1"), montoPago: "15000.50", formaPagoId: id("fa"), fechaPago: dia("2026-09-20"), createdAtPago: new Date("2026-09-20T13:00:00.000Z") },
        { idPago: id("p2"), turnoId: id("t"), alumnoId: id("s2"), montoPago: "12000", formaPagoId: id("fi"), fechaPago: dia("2026-09-21"), createdAtPago: new Date("2026-09-21T13:00:00.000Z") },
      ],
    });
  });

  afterAll(async () => {
    try {
      if (db) {
        await db.pago.deleteMany({ where: { idPago: { startsWith: prefijo } } });
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
});
