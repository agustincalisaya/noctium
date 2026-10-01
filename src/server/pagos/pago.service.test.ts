import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  tx: { pago: { create: vi.fn() } }, bloquear: vi.fn(), inscriptos: vi.fn(), alumnos: vi.fn(),
  forma: vi.fn(), existe: vi.fn(), formas: vi.fn(), pagos: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx),
  pago: { findMany: mocks.pagos },
} }));
vi.mock("@/server/turnos/turno.publico", () => ({ bloquearTurnoParaOperacion: mocks.bloquear, obtenerAlumnosInscriptosDeTurno: mocks.inscriptos }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnosBasicos: mocks.alumnos }));
vi.mock("@/server/pagos/forma-pago.publico", () => ({ verificarFormaPagoActiva: mocks.forma, existeFormaPago: mocks.existe, listarFormasPagoActivas: mocks.formas }));
const { registrarPago, obtenerOpcionesPago, fechaHoyArgentina } = await import("./pago.service");
const { listarPagosDeTurno } = await import("./pago.publico");
const input = { turno_id: "seed-turno-02", alumno_id: "a1", forma_pago_id: "f1", monto: "1500.50" };
const alumno = { id: "a1", apellido: "Domínguez", nombre: "Lara", dni: "45976577", activo: false, forma_pago_preferida_id: "f1" };

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-01T01:30:00Z"));
  mocks.bloquear.mockResolvedValue({ estado: "DISPONIBLE", alumno_ids: ["a1"], vencido: true });
  mocks.forma.mockResolvedValue({ id: "f1", nombre: "Efectivo" });
  mocks.existe.mockResolvedValue(true);
  mocks.alumnos.mockResolvedValue([alumno]);
  mocks.inscriptos.mockResolvedValue(["a1"]);
  mocks.formas.mockResolvedValue([{ id: "f1", nombre: "Efectivo" }]);
  mocks.tx.pago.create.mockImplementation(async ({ data }) => ({ ...data, idPago: "p1", createdAtPago: new Date() }));
});
afterEach(() => vi.useRealTimers());

describe("registrarPago", () => {
  it.each(["DISPONIBLE", "COMPLETO"])("admite %s vencido con alumno inactivo y auditoría", async (estado) => {
    mocks.bloquear.mockResolvedValue({ estado, alumno_ids: ["a1"], vencido: true });
    const pago = await registrarPago(input, "u1");
    expect(pago).toMatchObject({ monto: "1500.50", fecha_pago: "2026-09-30", alumno: { id: "a1", nombre_completo: "Domínguez, Lara" } });
    expect(mocks.bloquear).toHaveBeenCalledWith(input.turno_id, mocks.tx);
    expect(mocks.tx.pago.create).toHaveBeenCalledWith({ data: expect.objectContaining({ creadoPorUsuarioId: "u1", montoPago: new Prisma.Decimal("1500.50") }) });
    expect(mocks.forma).toHaveBeenCalledWith("f1", mocks.tx);
  });
  it.each(["PENDIENTE", "CANCELADO"])("rechaza %s antes de validar fecha futura", async (estado) => {
    mocks.bloquear.mockResolvedValue({ estado, alumno_ids: ["a1"] });
    await expect(registrarPago({ ...input, fecha_pago: new Date("2099-01-01") }, "u1")).rejects.toMatchObject({ code: "TURNO_NO_ADMITE_PAGO" });
    expect(mocks.tx.pago.create).not.toHaveBeenCalled();
  });
  it("turno inexistente", async () => {
    mocks.bloquear.mockResolvedValue(null);
    await expect(registrarPago(input, "u1")).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
  });
  it("exige inscripción antes de validar forma o fecha", async () => {
    await expect(registrarPago({ ...input, alumno_id: "otro" }, "u1")).rejects.toMatchObject({ code: "ALUMNO_NO_INSCRIPTO" });
    expect(mocks.forma).not.toHaveBeenCalled(); expect(mocks.tx.pago.create).not.toHaveBeenCalled();
  });
  it.each([[true, "FORMA_PAGO_NO_DISPONIBLE"], [false, "FORMA_PAGO_NO_ENCONTRADA"]])("forma inválida existente=%s", async (existe, code) => {
    mocks.forma.mockResolvedValue(null); mocks.existe.mockResolvedValue(existe);
    await expect(registrarPago(input, "u1")).rejects.toMatchObject({ code });
    expect(mocks.tx.pago.create).not.toHaveBeenCalled();
  });
  it("rechaza mañana en Argentina aunque ya sea hoy en UTC", async () => {
    await expect(registrarPago({ ...input, fecha_pago: new Date("2026-10-01T00:00:00Z") }, "u1")).rejects.toMatchObject({ code: "FECHA_PAGO_FUTURA" });
    expect(mocks.tx.pago.create).not.toHaveBeenCalled();
  });
  it("cada parcial es un nuevo INSERT; no compara un total esperado", async () => {
    await registrarPago({ ...input, monto: "0.01" }, "u1");
    await registrarPago({ ...input, monto: "999999999.99" }, "u1");
    expect(mocks.tx.pago.create).toHaveBeenCalledTimes(2);
  });
  it("la fecha civil cambia recién a medianoche argentina", () => {
    expect(fechaHoyArgentina(new Date("2026-10-01T02:59:59Z"))).toBe("2026-09-30");
    expect(fechaHoyArgentina(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01");
  });
});

describe("opciones de pago", () => {
  it("preselecciona solo al único inscripto, aunque esté inactivo", async () => {
    expect(await obtenerOpcionesPago("t1")).toMatchObject({ preseleccionar_alumno_id: "a1", alumnos: [{ dni: "45976577", forma_pago_preferida_id: "f1" }] });
  });
  it("preferida desactivada se convierte a null", async () => {
    mocks.formas.mockResolvedValue([{ id: "f2", nombre: "Transferencia" }]);
    expect((await obtenerOpcionesPago("t1")).alumnos[0].forma_pago_preferida_id).toBeNull();
  });
  it("no preselecciona si hay dos alumnos", async () => {
    mocks.alumnos.mockResolvedValue([alumno, { ...alumno, id: "a2", forma_pago_preferida_id: null }]);
    expect(await obtenerOpcionesPago("t1")).not.toHaveProperty("preseleccionar_alumno_id");
  });
  it("turno vacío responde sin preselección", async () => {
    mocks.inscriptos.mockResolvedValue([]); mocks.alumnos.mockResolvedValue([]);
    const opciones = await obtenerOpcionesPago("t1");
    expect(opciones.alumnos).toEqual([]); expect(opciones).not.toHaveProperty("preseleccionar_alumno_id");
  });
  it("turno inexistente responde error", async () => {
    mocks.inscriptos.mockResolvedValue(null);
    await expect(obtenerOpcionesPago("t1")).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
  });
});

describe("consulta histórica", () => {
  it("conserva alumno/forma inactivos, serializa Decimal y obtiene nombres en lote", async () => {
    mocks.pagos.mockResolvedValue([0, 1].map((indice) => ({ idPago: `p${indice}`, alumnoId: "a1", montoPago: new Prisma.Decimal("0.10"), fechaPago: new Date("2026-09-30"), createdAtPago: new Date("2026-10-01"), formaPago: { idFormaPago: "f1", nombreFormaPago: "Efectivo" } })));
    const pagos = await listarPagosDeTurno("t1");
    expect(pagos).toHaveLength(2); expect(pagos[0]).toMatchObject({ monto: "0.10", alumno: { id: "a1", nombre_completo: "Domínguez, Lara" }, forma_pago: { nombre: "Efectivo" } });
    expect(mocks.alumnos).toHaveBeenCalledTimes(1);
    expect(mocks.pagos).toHaveBeenCalledWith(expect.objectContaining({ where: { turnoId: "t1" }, orderBy: [{ createdAtPago: "desc" }, { idPago: "desc" }] }));
  });
});
