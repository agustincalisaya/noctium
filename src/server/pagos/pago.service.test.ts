import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// Persistencia del cobro desde el PR 0 (2.15): POST /api/pagos busca la
// inscripción vigente del par y cobra con registrarOperacion en el modo de
// compatibilidad, que valida forma y fecha, exige caja abierta, crea la
// operación y el pago y emite el comprobante. Esas reglas se prueban además
// contra PostgreSQL real (operacion.service.pg.test.ts y pago.service.pg.test.ts).
const mocks = vi.hoisted(() => ({
  tx: { $executeRawUnsafe: vi.fn() }, clase: vi.fn(), vigente: vi.fn(), operacion: vi.fn(), inscriptos: vi.fn(), alumnos: vi.fn(),
  forma: vi.fn(), formas: vi.fn(), operaciones: vi.fn(), formasPorId: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  // Cada transacción recibe su propio tx (copia con los mismos mocks).
  $transaction: async (fn: (tx: typeof mocks.tx) => unknown) => fn({ ...mocks.tx }),
  operacionPago: { findMany: mocks.operaciones },
  formaPago: { findMany: mocks.formasPorId },
} }));
vi.mock("@/server/turnos/turno.publico", () => ({ obtenerAlumnosInscriptosDeTurno: mocks.inscriptos }));
vi.mock("@/server/turnos/inscripcion.publico", () => ({ obtenerClasesBasicas: mocks.clase, inscripcionVigenteDelPar: mocks.vigente }));
vi.mock("@/server/pagos/operacion.service", () => ({ registrarOperacion: mocks.operacion }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnosBasicos: mocks.alumnos }));
vi.mock("@/server/pagos/forma-pago.publico", () => ({ verificarFormaPagoActiva: mocks.forma, listarFormasPagoActivas: mocks.formas }));
const { registrarPago, obtenerOpcionesPago, fechaHoyArgentina } = await import("./pago.service");
const { listarPagosDeTurno } = await import("./pago.publico");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const input = { turno_id: "seed-turno-02", alumno_id: "a1", forma_pago_id: "f1", monto: "1500.50" };
const alumno = { id: "a1", apellido: "Domínguez", nombre: "Lara", dni: "45976577", activo: false, forma_pago_preferida_id: "f1" };
let pagos = 0;
/** registrarOperacion en modo compatSprint2: un pago por llamada, con la fecha de pago informada o la de hoy en el centro. */
const operacionRegistrada = async (_tx: unknown, datos: { items: { monto: string }[]; fechaPago?: Date; usuarioId: string }) => ({
  operacion: { id: "op1", fechaPago: datos.fechaPago ?? new Date(`${fechaHoyArgentina()}T00:00:00.000Z`), cajaId: "caja-1" },
  pagos: [{ id: `p${++pagos}`, turnoId: input.turno_id, inscripcionId: "insc-1", precio: 12000, monto: new Prisma.Decimal(datos.items[0]!.monto).toFixed(2), motivoAjuste: null }],
  comprobante: { id: "c1", numero: 1, numeroVisible: "0001-00000001", datos: {} },
});

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-01T01:30:00Z"));
  mocks.tx.$executeRawUnsafe.mockResolvedValue(0);
  mocks.clase.mockResolvedValue([{ turno_id: input.turno_id, estado: "DISPONIBLE" }]);
  mocks.vigente.mockResolvedValue({ id: "insc-1" });
  mocks.operacion.mockImplementation(operacionRegistrada);
  mocks.forma.mockResolvedValue({ id: "f1", nombre: "Efectivo" });
  mocks.alumnos.mockResolvedValue([alumno]);
  mocks.inscriptos.mockResolvedValue(["a1"]);
  mocks.formas.mockResolvedValue([{ id: "f1", nombre: "Efectivo" }]);
});
afterEach(() => vi.useRealTimers());

describe("registrarPago", () => {
  it.each(["DISPONIBLE", "COMPLETO"])("admite %s vencido con alumno inactivo y auditoría", async (estado) => {
    mocks.clase.mockResolvedValue([{ turno_id: input.turno_id, estado }]);
    const pago = await registrarPago(input, "u1");
    expect(pago).toMatchObject({ monto: "1500.50", fecha_pago: "2026-09-30", alumno: { id: "a1", nombre_completo: "Domínguez, Lara" } });
    expect(mocks.clase).toHaveBeenCalledWith([input.turno_id], expect.objectContaining(mocks.tx));
    // El pago lo crea registrarOperacion con el usuario que registra, en el modo de compatibilidad (PR-0.md §2.13).
    expect(mocks.operacion).toHaveBeenCalledWith(expect.objectContaining(mocks.tx), {
      alumnoId: "a1", items: [{ inscripcionId: "insc-1", monto: "1500.50" }], formaPagoId: "f1", fechaPago: undefined, usuarioId: "u1", modo: "compatSprint2",
    });
    expect(mocks.forma).toHaveBeenCalledWith("f1", expect.objectContaining(mocks.tx));
    // Campo extra de la respuesta (1.1): el comprobante emitido.
    expect(pago).toMatchObject({ comprobante: { id: "c1", numero: "0001-00000001" } });
  });
  it.each(["PENDIENTE", "CANCELADO"])("rechaza %s antes de validar fecha futura", async (estado) => {
    mocks.clase.mockResolvedValue([{ turno_id: input.turno_id, estado }]);
    await expect(registrarPago({ ...input, fecha_pago: new Date("2099-01-01") }, "u1")).rejects.toMatchObject({ code: "TURNO_NO_ADMITE_PAGO" });
    expect(mocks.operacion).not.toHaveBeenCalled();
  });
  it("turno inexistente", async () => {
    mocks.clase.mockResolvedValue([]);
    await expect(registrarPago(input, "u1")).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
  });
  it("exige inscripción antes de validar forma o fecha", async () => {
    mocks.vigente.mockResolvedValue(null);
    await expect(registrarPago({ ...input, alumno_id: "otro" }, "u1")).rejects.toMatchObject({ code: "ALUMNO_NO_INSCRIPTO" });
    expect(mocks.vigente).toHaveBeenCalledWith("otro", input.turno_id, expect.anything());
    expect(mocks.forma).not.toHaveBeenCalled(); expect(mocks.operacion).not.toHaveBeenCalled();
  });
  it.each([["errores.formaPago.noDisponible", "FORMA_PAGO_NO_DISPONIBLE"], ["errores.formaPago.noEncontrada", "FORMA_PAGO_NO_ENCONTRADA"]] as const)("forma inválida existente=%s", async (codigo, code) => {
    mocks.operacion.mockRejectedValue(new ErrorDeDominio(codigo));
    await expect(registrarPago(input, "u1")).rejects.toMatchObject({ code });
  });
  it("rechaza mañana en Argentina aunque ya sea hoy en UTC", async () => {
    mocks.operacion.mockRejectedValue(new ErrorDeDominio("errores.pago.fechaFutura"));
    await expect(registrarPago({ ...input, fecha_pago: new Date("2026-10-01T00:00:00Z") }, "u1")).rejects.toMatchObject({ code: "FECHA_PAGO_FUTURA" });
    expect(mocks.operacion).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ fechaPago: new Date("2026-10-01T00:00:00Z") }));
  });
  it("cada parcial es un nuevo INSERT; no compara un total esperado", async () => {
    await registrarPago({ ...input, monto: "0.01" }, "u1");
    await registrarPago({ ...input, monto: "999999999.99" }, "u1");
    expect(mocks.operacion).toHaveBeenCalledTimes(2);
    expect(mocks.operacion.mock.calls.map(([, datos]) => datos.items)).toEqual([[{ inscripcionId: "insc-1", monto: "0.01" }], [{ inscripcionId: "insc-1", monto: "999999999.99" }]]);
  });
  it("sin caja abierta responde el código nuevo CAJA_NO_ABIERTA (2.15)", async () => {
    mocks.operacion.mockRejectedValue(new ErrorDeDominio("errores.caja.sinCajaAbierta"));
    await expect(registrarPago(input, "u1")).rejects.toMatchObject({ code: "CAJA_NO_ABIERTA", status: 409 });
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
    mocks.formasPorId.mockResolvedValue([{ idFormaPago: "f1", nombreFormaPago: "Efectivo", activaFormaPago: false }]);
    mocks.operaciones.mockResolvedValue([0, 1].map((indice) => ({
      idOperacionPago: `op${indice}`, alumnoId: "a1", formaPagoId: "f1", fechaPago: new Date("2026-09-30"), creadoPorUsuarioId: "u1",
      registradaEl: new Date("2026-10-01"), cajaId: "caja-1", correcciones: [], comprobantes: [],
      pagos: [{
        idPago: `p${indice}`, turnoId: "t1", alumnoId: "a1", inscripcionId: "insc-1", precio: 12000, montoPago: new Prisma.Decimal("0.10"),
        fechaPago: new Date("2026-09-30"), createdAtPago: new Date("2026-10-01"), motivoAjuste: null, ajustadoPorUsuarioId: null, anulacion: null, correcciones: [],
      }],
    })));
    const pagos = await listarPagosDeTurno("t1");
    expect(pagos).toHaveLength(2); expect(pagos[0]).toMatchObject({ monto: "0.10", alumno: { id: "a1", nombre_completo: "Domínguez, Lara" }, forma_pago: { nombre: "Efectivo" } });
    expect(mocks.alumnos).toHaveBeenCalledTimes(1);
    expect(mocks.operaciones).toHaveBeenCalledWith(expect.objectContaining({ where: { pagos: { some: { turnoId: "t1" } } } }));
    // Más recientes primero, con el id como desempate (mismo orden que en Sprint 2).
    expect(pagos.map(({ id }) => id)).toEqual(["p1", "p0"]);
  });
});
