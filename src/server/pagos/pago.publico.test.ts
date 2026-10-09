import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Persistencia de los pagos desde el PR 0 (2.3 y 2.13): cada pago pertenece a
// una operación y el valor vigente sale de la operación con sus correcciones y
// anulaciones (pago.vigente.ts). Las aserciones de resultado son las de Sprint 2.
const { db, tx, obtenerAlumnosBasicos } = vi.hoisted(() => ({
  db: { operacionPago: { findMany: vi.fn() }, formaPago: { findMany: vi.fn() }, $queryRaw: vi.fn() },
  tx: { operacionPago: { findMany: vi.fn() }, formaPago: { findMany: vi.fn() }, $queryRaw: vi.fn() },
  obtenerAlumnosBasicos: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnosBasicos }));

const { listarPagosDeTurno, sumarPagosPorMes } = await import("./pago.publico");

const FORMA = { idFormaPago: "fp-transferencia", nombreFormaPago: "Transferencia", activaFormaPago: true };
/** Un pago del turno-1 en su propia operación, sin correcciones ni anulación. */
const fila = (id: string, alumnoId: string, monto: string, fecha: string, registrado: string) => ({
  idOperacionPago: `op-${id}`, alumnoId, formaPagoId: FORMA.idFormaPago, fechaPago: new Date(`${fecha}T00:00:00.000Z`),
  creadoPorUsuarioId: "mesa-1", registradaEl: new Date(registrado), cajaId: "caja-1", correcciones: [], comprobantes: [],
  pagos: [{
    idPago: id, turnoId: "turno-1", alumnoId, inscripcionId: `insc-${alumnoId}`, precio: 12000,
    montoPago: new Prisma.Decimal(monto), fechaPago: new Date(`${fecha}T00:00:00.000Z`), createdAtPago: new Date(registrado),
    motivoAjuste: null, ajustadoPorUsuarioId: null, anulacion: null, correcciones: [],
  }],
});
const basico = (id: string, apellido: string, nombre: string) =>
  ({ id, nombre, apellido, dni: "1", activo: true, forma_pago_preferida_id: null });

beforeEach(() => {
  vi.clearAllMocks();
  db.formaPago.findMany.mockResolvedValue([FORMA]);
  tx.formaPago.findMany.mockResolvedValue([FORMA]);
});

describe("listarPagosDeTurno (spec_modulo_I.md §2.3)", () => {
  it("devuelve [] sin consultar alumnos cuando el turno no tiene pagos", async () => {
    db.operacionPago.findMany.mockResolvedValue([]);

    await expect(listarPagosDeTurno("turno-1")).resolves.toEqual([]);
    expect(obtenerAlumnosBasicos).not.toHaveBeenCalled();
  });

  it("lee los pagos del turno, más recientes primero, con la forma de pago por su relación", async () => {
    db.operacionPago.findMany.mockResolvedValue([
      fila("pago-1", "alumno-a", "100", "2026-09-27", "2026-09-27T13:30:00.000Z"),
      fila("pago-2", "alumno-a", "100", "2026-09-28", "2026-09-28T15:00:00.000Z"),
    ]);
    obtenerAlumnosBasicos.mockResolvedValue([basico("alumno-a", "Pérez", "Ana")]);

    const pagos = await listarPagosDeTurno("turno-1");

    expect(db.operacionPago.findMany).toHaveBeenCalledWith({
      where: { pagos: { some: { turnoId: "turno-1" } } },
      include: expect.objectContaining({ pagos: expect.anything(), correcciones: expect.anything() }),
    });
    expect(db.formaPago.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { idFormaPago: { in: [FORMA.idFormaPago] } } }));
    expect(pagos.map(({ id }) => id)).toEqual(["pago-2", "pago-1"]);
  });

  it("arma cada pago con el nombre «Apellido, Nombre», monto decimal, fecha de calendario e instante de registro", async () => {
    db.operacionPago.findMany.mockResolvedValue([
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
    db.operacionPago.findMany.mockResolvedValue([
      fila("pago-3", "alumno-a", "100", "2026-09-28", "2026-09-28T15:00:00.000Z"),
      fila("pago-2", "alumno-b", "100", "2026-09-28", "2026-09-28T14:00:00.000Z"),
      fila("pago-1", "alumno-a", "100", "2026-09-27", "2026-09-27T13:30:00.000Z"),
    ]);
    obtenerAlumnosBasicos.mockResolvedValue([basico("alumno-a", "Pérez", "Ana"), basico("alumno-b", "Gómez", "Lucía")]);

    const pagos = await listarPagosDeTurno("turno-1");

    expect(obtenerAlumnosBasicos).toHaveBeenCalledTimes(1);
    expect(obtenerAlumnosBasicos).toHaveBeenCalledWith(expect.arrayContaining(["alumno-a", "alumno-b"]), db);
    expect(pagos.map(({ alumno }) => alumno.nombre_completo)).toEqual(["Pérez, Ana", "Gómez, Lucía", "Pérez, Ana"]);
  });

  it("no filtra por inscripción: conserva el pago de un alumno ya retirado del turno", async () => {
    db.operacionPago.findMany.mockResolvedValue([fila("pago-1", "alumno-retirado", "5000", "2026-09-20", "2026-09-20T12:00:00.000Z")]);
    obtenerAlumnosBasicos.mockResolvedValue([basico("alumno-retirado", "Ruiz", "Tomás")]);

    const [pago] = await listarPagosDeTurno("turno-1");

    expect(pago?.alumno).toEqual({ id: "alumno-retirado", nombre_completo: "Ruiz, Tomás" });
  });

  it("usa el db recibido para los pagos y para los alumnos", async () => {
    tx.operacionPago.findMany.mockResolvedValue([fila("pago-1", "alumno-a", "100", "2026-09-27", "2026-09-27T13:30:00.000Z")]);
    obtenerAlumnosBasicos.mockResolvedValue([basico("alumno-a", "Pérez", "Ana")]);

    await listarPagosDeTurno("turno-1", tx as never);

    expect(tx.operacionPago.findMany).toHaveBeenCalled();
    expect(db.operacionPago.findMany).not.toHaveBeenCalled();
    expect(obtenerAlumnosBasicos).toHaveBeenCalledWith(["alumno-a"], tx);
  });

  it("si falta el alumno de un pago, falla en vez de inventar un nombre", async () => {
    db.operacionPago.findMany.mockResolvedValue([fila("pago-1", "alumno-a", "100", "2026-09-27", "2026-09-27T13:30:00.000Z")]);
    obtenerAlumnosBasicos.mockResolvedValue([]);

    await expect(listarPagosDeTurno("turno-1")).rejects.toThrow("Pago pago-1 sin alumno alumno-a");
  });

  it("valor vigente (PR-0.md §2.13): el monto corregido reemplaza al original y el pago anulado no figura", async () => {
    const corregido = fila("pago-2", "alumno-a", "12000", "2026-09-28", "2026-09-28T15:00:00.000Z");
    corregido.pagos[0]!.correcciones = [{ montoNuevo: new Prisma.Decimal("9000") }] as never;
    const anulado = fila("pago-1", "alumno-a", "100", "2026-09-27", "2026-09-27T13:30:00.000Z");
    anulado.pagos[0]!.anulacion = { createdAtAnulacionPago: new Date("2026-09-29T10:00:00.000Z"), motivo: "Error" } as never;
    db.operacionPago.findMany.mockResolvedValue([corregido, anulado]);
    obtenerAlumnosBasicos.mockResolvedValue([basico("alumno-a", "Pérez", "Ana")]);

    await expect(listarPagosDeTurno("turno-1")).resolves.toEqual([expect.objectContaining({ id: "pago-2", monto: "9000.00" })]);
  });
});

describe("sumarPagosPorMes (spec_modulo_I.md §2.3)", () => {
  const consulta = (mock: typeof db.$queryRaw) => mock.mock.calls[0]![0] as Prisma.Sql;

  it("suma montoPago por mes de fechaPago, sin filtrar forma de pago ni turno, con límite superior exclusivo", async () => {
    db.$queryRaw.mockResolvedValue([{ mes: "2026-12", total: "15000.50" }, { mes: "2027-01", total: "12000.00" }]);
    await expect(sumarPagosPorMes("2026-12", "2027-01")).resolves.toEqual([
      { mes: "2026-12", total: "15000.50" }, { mes: "2027-01", total: "12000.00" },
    ]);
    const { sql, values } = consulta(db.$queryRaw);
    // Con el valor vigente (PR-0.md §2.13): monto y fecha de pago vigentes, sin los anulados.
    expect(sql).toContain("SUM(v.monto)::text");
    expect(sql).toContain('FROM "pagos" p');
    expect(sql).toContain('"correcciones_pago"');
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM "anulaciones_pago"');
    expect(sql).toContain("GROUP BY to_char(v.fecha, 'YYYY-MM')");
    expect(sql).not.toMatch(/formaPagoId|turnoId|turnos/);
    expect(values).toEqual(["2026-12-01", "2027-02-01"]);
  });

  it("usa el db recibido", async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(sumarPagosPorMes("2026-01", "2026-03", tx as never)).resolves.toEqual([]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});
