import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, tx, obtenerAlumnosBasicos } = vi.hoisted(() => ({
  db: { pago: { findMany: vi.fn() } },
  tx: { pago: { findMany: vi.fn() } },
  obtenerAlumnosBasicos: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnosBasicos }));

const { listarPagosDeTurno } = await import("./pago.publico");

const fila = (id: string, alumnoId: string, monto: string, fecha: string, registrado: string) => ({
  idPago: id,
  alumnoId,
  montoPago: new Prisma.Decimal(monto),
  fechaPago: new Date(`${fecha}T00:00:00.000Z`),
  createdAtPago: new Date(registrado),
  formaPago: { idFormaPago: "fp-transferencia", nombreFormaPago: "Transferencia" },
});
const basico = (id: string, apellido: string, nombre: string) =>
  ({ id, nombre, apellido, dni: "1", activo: true, forma_pago_preferida_id: null });

beforeEach(() => vi.clearAllMocks());

describe("listarPagosDeTurno (spec_modulo_I.md §2.3)", () => {
  it("devuelve [] sin consultar alumnos cuando el turno no tiene pagos", async () => {
    db.pago.findMany.mockResolvedValue([]);

    await expect(listarPagosDeTurno("turno-1")).resolves.toEqual([]);
    expect(obtenerAlumnosBasicos).not.toHaveBeenCalled();
  });

  it("lee los pagos del turno, más recientes primero, con la forma de pago por su relación", async () => {
    db.pago.findMany.mockResolvedValue([]);

    await listarPagosDeTurno("turno-1");

    expect(db.pago.findMany).toHaveBeenCalledWith({
      where: { turnoId: "turno-1" },
      orderBy: [{ createdAtPago: "desc" }, { idPago: "desc" }],
      select: {
        idPago: true, alumnoId: true, montoPago: true, fechaPago: true, createdAtPago: true,
        formaPago: { select: { idFormaPago: true, nombreFormaPago: true } },
      },
    });
  });

  it("arma cada pago con el nombre «Apellido, Nombre», monto decimal, fecha de calendario e instante de registro", async () => {
    db.pago.findMany.mockResolvedValue([
      fila("pago-2", "alumno-b", "12000", "2026-09-28", "2026-09-28T15:00:00.000Z"),
      fila("pago-1", "alumno-a", "15000.5", "2026-09-27", "2026-09-27T13:30:00.000Z"),
    ]);
    obtenerAlumnosBasicos.mockResolvedValue([basico("alumno-b", "Gómez", "Lucía"), basico("alumno-a", "Pérez", "Ana")]);

    await expect(listarPagosDeTurno("turno-1")).resolves.toEqual([
      {
        id: "pago-2", alumno: { id: "alumno-b", nombre_completo: "Gómez, Lucía" }, monto: "12000.00",
        forma_pago: { id: "fp-transferencia", nombre: "Transferencia" }, fecha_pago: "2026-09-28",
        registrado_en: "2026-09-28T15:00:00.000Z",
      },
      {
        id: "pago-1", alumno: { id: "alumno-a", nombre_completo: "Pérez, Ana" }, monto: "15000.50",
        forma_pago: { id: "fp-transferencia", nombre: "Transferencia" }, fecha_pago: "2026-09-27",
        registrado_en: "2026-09-27T13:30:00.000Z",
      },
    ]);
  });

  it("resuelve los nombres en una sola consulta en lote, aunque un alumno tenga varios pagos", async () => {
    db.pago.findMany.mockResolvedValue([
      fila("pago-3", "alumno-a", "100", "2026-09-28", "2026-09-28T15:00:00.000Z"),
      fila("pago-2", "alumno-b", "100", "2026-09-28", "2026-09-28T14:00:00.000Z"),
      fila("pago-1", "alumno-a", "100", "2026-09-27", "2026-09-27T13:30:00.000Z"),
    ]);
    obtenerAlumnosBasicos.mockResolvedValue([basico("alumno-a", "Pérez", "Ana"), basico("alumno-b", "Gómez", "Lucía")]);

    const pagos = await listarPagosDeTurno("turno-1");

    expect(obtenerAlumnosBasicos).toHaveBeenCalledTimes(1);
    expect(obtenerAlumnosBasicos).toHaveBeenCalledWith(["alumno-a", "alumno-b", "alumno-a"], db);
    expect(pagos.map(({ alumno }) => alumno.nombre_completo)).toEqual(["Pérez, Ana", "Gómez, Lucía", "Pérez, Ana"]);
  });

  it("no filtra por inscripción: conserva el pago de un alumno ya retirado del turno", async () => {
    db.pago.findMany.mockResolvedValue([fila("pago-1", "alumno-retirado", "5000", "2026-09-20", "2026-09-20T12:00:00.000Z")]);
    obtenerAlumnosBasicos.mockResolvedValue([basico("alumno-retirado", "Ruiz", "Tomás")]);

    const [pago] = await listarPagosDeTurno("turno-1");

    expect(pago?.alumno).toEqual({ id: "alumno-retirado", nombre_completo: "Ruiz, Tomás" });
  });

  it("usa el db recibido para los pagos y para los alumnos", async () => {
    tx.pago.findMany.mockResolvedValue([fila("pago-1", "alumno-a", "100", "2026-09-27", "2026-09-27T13:30:00.000Z")]);
    obtenerAlumnosBasicos.mockResolvedValue([basico("alumno-a", "Pérez", "Ana")]);

    await listarPagosDeTurno("turno-1", tx as never);

    expect(tx.pago.findMany).toHaveBeenCalled();
    expect(db.pago.findMany).not.toHaveBeenCalled();
    expect(obtenerAlumnosBasicos).toHaveBeenCalledWith(["alumno-a"], tx);
  });

  it("si falta el alumno de un pago, falla en vez de inventar un nombre", async () => {
    db.pago.findMany.mockResolvedValue([fila("pago-1", "alumno-a", "100", "2026-09-27", "2026-09-27T13:30:00.000Z")]);
    obtenerAlumnosBasicos.mockResolvedValue([]);

    await expect(listarPagosDeTurno("turno-1")).rejects.toThrow("Pago pago-1 sin alumno alumno-a");
  });
});
