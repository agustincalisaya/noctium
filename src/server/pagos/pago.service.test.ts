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
  buscar: vi.fn(), pendientes: vi.fn(), exige: vi.fn(), tarifas: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  // Cada transacción recibe su propio tx (copia con los mismos mocks).
  $transaction: async (fn: (tx: typeof mocks.tx) => unknown) => fn({ ...mocks.tx }),
  operacionPago: { findMany: mocks.operaciones },
  formaPago: { findMany: mocks.formasPorId },
} }));
vi.mock("@/server/turnos/turno.publico", () => ({ obtenerAlumnosInscriptosDeTurno: mocks.inscriptos }));
vi.mock("@/server/turnos/inscripcion.publico", () => ({
  obtenerClasesBasicas: mocks.clase, inscripcionVigenteDelPar: mocks.vigente,
  listarInscripcionesPendientesDePagoDeAlumno: mocks.pendientes, exigeInscripcionConPago: mocks.exige,
}));
vi.mock("@/server/pagos/operacion.service", () => ({ registrarOperacion: mocks.operacion }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnosBasicos: mocks.alumnos, buscarAlumnosActivos: mocks.buscar }));
vi.mock("@/server/materias/materia.publico", () => ({ obtenerTarifasPorIds: mocks.tarifas }));
vi.mock("@/server/pagos/forma-pago.publico", () => ({ verificarFormaPagoActiva: mocks.forma, listarFormasPagoActivas: mocks.formas }));
const { registrarPago, obtenerOpcionesPago, fechaHoyArgentina, buscarAlumnosParaCobro, listarClasesPendientesDePago, registrarOperacionDePago } = await import("./pago.service");
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

// ---------------------------------------------------------------------------
// HU-I-10: registrar pago buscando al alumno (spec_modulo_I.md §2.7)
// ---------------------------------------------------------------------------

const pendiente = (extra: Record<string, unknown> = {}) => ({
  inscripcion_id: "c-insc-1", turno_id: "t1", fecha: "2026-10-05", hora_inicio: "18:00", hora_fin: "19:00",
  materia: { id: "m1", nombre: "Física I" }, profesor: { id: "p1", nombre_completo: "Gómez, Laura" },
  estado_pago: "RESERVADA", vence_el: "2026-10-04T18:00:00-03:00", precio: 12000, ...extra,
});
const claseNueva = (extra: Record<string, unknown> = {}) => ({
  turno_id: "t9", fecha: "2026-10-03", hora_inicio: "10:00", hora_fin: "12:00", estado: "DISPONIBLE",
  materia: { id: "m2", nombre: "Química" }, profesor: null, inicio: new Date("2026-10-03T13:00:00Z"), ...extra,
});

describe("buscarAlumnosParaCobro (paso 1)", () => {
  it("delega en buscarAlumnosActivos de B, que ya busca por palabras", async () => {
    mocks.buscar.mockResolvedValue([{ id: "a1", nombre: "Lara", apellido: "Domínguez", dni: "45976577" }]);
    expect(await buscarAlumnosParaCobro("lara dom")).toHaveLength(1);
    expect(mocks.buscar).toHaveBeenCalledWith("lara dom");
  });
});

describe("listarClasesPendientesDePago (paso 2)", () => {
  beforeEach(() => {
    mocks.pendientes.mockResolvedValue([
      pendiente(),
      pendiente({ inscripcion_id: "c-insc-2", turno_id: "t2", fecha: "2026-10-06", estado_pago: "PAGO_SIN_REGISTRAR", vence_el: null, precio: 11000 }),
    ]);
    mocks.exige.mockResolvedValue({ exige: true, motivo: "RESERVA_VENCIDA" });
    mocks.vigente.mockResolvedValue(null);
    mocks.clase.mockResolvedValue([claseNueva()]);
    mocks.tarifas.mockResolvedValue([{ id: "m2", tarifaHora: 9000 }]);
  });

  it("404 si el alumno no existe", async () => {
    mocks.alumnos.mockResolvedValue([]);
    await expect(listarClasesPendientesDePago("a1")).rejects.toMatchObject({ code: "ALUMNO_NO_ENCONTRADO", status: 404 });
  });
  it("lista RESERVADA con vence_el y PAGO_SIN_REGISTRAR sin vencimiento, con el precio de la inscripción y las formas activas", async () => {
    const datos = await listarClasesPendientesDePago("a1");
    expect(mocks.pendientes).toHaveBeenCalledWith("a1");
    expect(datos.alumno).toEqual({ id: "a1", nombre_completo: "Domínguez, Lara", dni: "45976577", forma_pago_preferida_id: "f1" });
    expect(datos.clases.map((c) => [c.estado_pago, c.vence_el, c.precio, c.origen_precio, c.marcada])).toEqual([
      ["RESERVADA", "2026-10-04T18:00:00-03:00", 12000, "INSCRIPCION", false],
      ["PAGO_SIN_REGISTRAR", null, 11000, "INSCRIPCION", false],
    ]);
    expect(datos.formas_pago).toEqual([{ id: "f1", nombre: "Efectivo" }]);
  });
  it("preferida inactiva se informa como null", async () => {
    mocks.formas.mockResolvedValue([{ id: "f2", nombre: "Transferencia" }]);
    expect((await listarClasesPendientesDePago("a1")).alumno.forma_pago_preferida_id).toBeNull();
  });
  it("sin clases pendientes devuelve []", async () => {
    mocks.pendientes.mockResolvedValue([]);
    expect((await listarClasesPendientesDePago("a1")).clases).toEqual([]);
  });
  it("con turno_id de una inscripción pendiente, esa fila viene marcada", async () => {
    const { clases } = await listarClasesPendientesDePago("a1", "t2");
    expect(clases.map((c) => c.marcada)).toEqual([false, true]);
    expect(mocks.exige).not.toHaveBeenCalled();
  });
  it("«Se inscribe al confirmar el pago»: fila marcada, sin inscripción, con la tarifa vigente y en orden por fecha", async () => {
    mocks.alumnos.mockResolvedValue([{ ...alumno, activo: true }]);
    const { clases } = await listarClasesPendientesDePago("a1", "t9");
    expect(clases[0]).toEqual({
      inscripcion_id: null, turno_id: "t9", fecha: "2026-10-03", hora_inicio: "10:00", hora_fin: "12:00",
      materia: { id: "m2", nombre: "Química" }, profesor: null, estado_pago: "SE_INSCRIBE_AL_PAGAR", vence_el: null,
      precio: 18000, origen_precio: "TARIFA_VIGENTE", marcada: true,
    });
    expect(clases).toHaveLength(3);
    expect(mocks.exige).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ turnoId: "t9", alumnoId: "a1" }));
  });
  it.each([
    ["clase inexistente", () => mocks.clase.mockResolvedValue([]), "TURNO_NO_ENCONTRADO", 404],
    ["clase pendiente", () => mocks.clase.mockResolvedValue([claseNueva({ estado: "PENDIENTE" })]), "TURNO_NO_ADMITE_PAGO", 409],
    ["clase ya empezada", () => mocks.clase.mockResolvedValue([claseNueva({ inicio: new Date("2026-10-01T01:00:00Z") })]), "TURNO_YA_EMPEZO", 409],
    ["inscripción vigente ya pagada", () => mocks.vigente.mockResolvedValue({ id: "i9", estadoPago: "PAGADA" }), "INSCRIPCION_YA_PAGADA", 409],
    ["no corresponde inscribir al pagar", () => mocks.exige.mockResolvedValue({ exige: false, motivo: null }), "ALUMNO_NO_INSCRIPTO", 409],
    ["alumno inactivo", () => mocks.alumnos.mockResolvedValue([{ ...alumno, activo: false }]), "ALUMNO_INACTIVO", 409],
    ["materia sin tarifa", () => mocks.tarifas.mockResolvedValue([{ id: "m2", tarifaHora: null }]), "MATERIA_SIN_TARIFA", 422],
  ])("con turno_id: %s → %s", async (_caso, preparar, code, status) => {
    mocks.alumnos.mockResolvedValue([{ ...alumno, activo: true }]);
    preparar();
    await expect(listarClasesPendientesDePago("a1", "t9")).rejects.toMatchObject({ code, status });
  });
});

describe("registrarOperacionDePago (paso 3)", () => {
  const entrada = {
    alumno_id: "a1",
    items: [{ inscripcion_id: "i1", monto: "11000", motivo_ajuste: "Beca" }, { turno_id: "t9", monto: "18000" }],
    forma_pago_id: "f1",
  };
  beforeEach(() => {
    mocks.operacion.mockResolvedValue({
      operacion: { id: "op1", fechaPago: new Date("2026-09-30T00:00:00Z") },
      pagos: [
        { id: "p1", turnoId: "t1", inscripcionId: "i1", precio: 12000, monto: "11000.00", motivoAjuste: "Beca" },
        { id: "p2", turnoId: "t9", inscripcionId: "i2", precio: 18000, monto: "18000.00", motivoAjuste: null },
      ],
      comprobante: { id: "c1", numero: 1, numeroVisible: "0001-00000001", datos: {} },
    });
    mocks.clase.mockResolvedValue([
      claseNueva({ turno_id: "t1", fecha: "2026-10-05", hora_inicio: "18:00", materia: { id: "m1", nombre: "Física I" } }),
      claseNueva(),
    ]);
  });

  it("arma el pedido de registrarOperacion en modo completo y la respuesta 2.7.5 con el total de los montos", async () => {
    const respuesta = await registrarOperacionDePago(entrada, "u1");
    expect(mocks.operacion).toHaveBeenCalledWith(expect.objectContaining(mocks.tx), {
      alumnoId: "a1",
      items: [
        { inscripcionId: "i1", monto: "11000", motivoAjuste: "Beca" },
        { crearInscripcion: { turnoId: "t9" }, monto: "18000", motivoAjuste: undefined },
      ],
      formaPagoId: "f1", fechaPago: undefined, usuarioId: "u1", modo: "completo",
    });
    expect(respuesta).toEqual({
      operacion_id: "op1",
      alumno: { id: "a1", nombre_completo: "Domínguez, Lara" },
      forma_pago: { id: "f1", nombre: "Efectivo" },
      fecha_pago: "2026-09-30",
      total: "29000.00",
      pagos: [
        { id: "p1", turno_id: "t1", inscripcion_id: "i1", materia: { id: "m1", nombre: "Física I" }, fecha: "2026-10-05", hora_inicio: "18:00", precio: 12000, monto: "11000.00", motivo_ajuste: "Beca" },
        { id: "p2", turno_id: "t9", inscripcion_id: "i2", materia: { id: "m2", nombre: "Química" }, fecha: "2026-10-03", hora_inicio: "10:00", precio: 18000, monto: "18000.00", motivo_ajuste: null },
      ],
      comprobante: { id: "c1", numero: "0001-00000001" },
    });
  });
  it("404 ALUMNO_NO_ENCONTRADO sin llamar a registrarOperacion", async () => {
    mocks.alumnos.mockResolvedValue([]);
    await expect(registrarOperacionDePago(entrada, "u1")).rejects.toMatchObject({ code: "ALUMNO_NO_ENCONTRADO", status: 404 });
    expect(mocks.operacion).not.toHaveBeenCalled();
  });
  it("propaga el rechazo de registrarOperacion con la clase en los datos", async () => {
    mocks.operacion.mockRejectedValue(new ErrorDeDominio("errores.pago.motivoAjusteRequerido", { turno_id: "t1", precio_vigente: 12000 }));
    await expect(registrarOperacionDePago(entrada, "u1")).rejects.toMatchObject({ code: "MOTIVO_AJUSTE_REQUERIDO", status: 400, datos: { precio_vigente: 12000 } });
  });
});
