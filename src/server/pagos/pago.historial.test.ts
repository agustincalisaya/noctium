import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  alumnos: vi.fn(), pagos: vi.fn(), clases: vi.fn(), inscripciones: vi.fn(), nombres: vi.fn(), corregir: vi.fn(),
}));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnosBasicos: m.alumnos, buscarAlumnosActivos: vi.fn() }));
vi.mock("@/server/pagos/pago.publico", () => ({ listarPagosDeAlumno: m.pagos }));
vi.mock("@/server/turnos/inscripcion.publico", () => ({ obtenerClasesBasicas: m.clases, listarInscripcionesDeAlumno: m.inscripciones }));
vi.mock("@/server/turnos/inscripcion.lecturas", () => ({ listarInscripcionesDeAlumno: m.inscripciones }));
vi.mock("@/server/personal/personal.publico", () => ({ obtenerNombresPersonal: m.nombres }));
vi.mock("@/server/pagos/correccion.service", () => ({ puedeCorregirPago: m.corregir }));
const { listarHistorialDePagos, obtenerOpcionesHistorialPagos } = await import("./pago.service");
const { HistorialPagosQuerySchema, OpcionesHistorialPagosQuerySchema } = await import("./pago.schema");

const CUID = "c123456789012345678901234";
const query = (extra: Record<string, unknown> = {}) => HistorialPagosQuerySchema.parse({ alumno_id: CUID, ...extra });
const usuario = { id: "mesa", rol: "MESA_ENTRADA" as const, puedeCrearPago: true };
const pago = (n: number, monto = "0.01") => ({
  pago_id: `p${n}`, turno_id: `t${n}`, inscripcion_id: `i${n}`, operacion_id: `o${n}`,
  monto, monto_original: null, precio: 100, motivo_ajuste: null, ajustado_por: null,
  forma_pago: { id: "f1", nombre: "Efectivo", is_active: false },
  fecha_pago: "2026-10-12", registrado_en: "2026-10-12T13:00:00.000Z", registrado_por: "mesa",
  anulado: false, comprobante_vigente: { id: `c${n}`, numero: `0001-${n}` },
  cambios: 0, clases_de_la_operacion: 1, caja_abierta: true,
});
const clase = (n: number) => ({ turno_id: `t${n}`, fecha: "2026-10-14", hora_inicio: "16:00",
  materia: { id: n % 2 ? "m1" : "m2", nombre: n % 2 ? "Álgebra" : "Biología" } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T15:00:00Z"));
  m.alumnos.mockResolvedValue([{ id: CUID }]);
  m.pagos.mockResolvedValue([]);
  m.clases.mockResolvedValue([]);
  m.inscripciones.mockResolvedValue([]);
  m.nombres.mockResolvedValue([{ usuario_id: "mesa", nombre_completo: "Pérez, Ana" }]);
  m.corregir.mockReturnValue(true);
});
afterEach(() => vi.useRealTimers());

describe("query de historial I-02", () => {
  it("acepta defaults y fechas calendario", () => {
    expect(query().pagina).toBe(1);
    expect(query({ desde: "2026-10-01" }).desde).toEqual(new Date("2026-10-01T00:00:00.000Z"));
  });
  it.each([
    { alumno_id: "mal" }, { alumno_id: CUID, pagina: 0 }, { alumno_id: CUID, pagina: "1.5" },
    { alumno_id: CUID, desde: "2026-02-30" }, { alumno_id: CUID, desde: "2026-10-15", hasta: "2026-10-14" },
    { alumno_id: CUID, estado_pago: "PAGADA", forma_pago_id: "formapago-efectivo" },
    { alumno_id: CUID, estado_pago: "RESERVADA", materia_id: "m1" },
    { alumno_id: CUID, desconocido: "x" },
  ])("rechaza query inválida %#", (entrada) => {
    expect(HistorialPagosQuerySchema.safeParse(entrada).success).toBe(false);
  });
  it("opciones solo admite alumno_id válido", () => {
    expect(OpcionesHistorialPagosQuerySchema.safeParse({ alumno_id: CUID }).success).toBe(true);
    expect(OpcionesHistorialPagosQuerySchema.safeParse({ alumno_id: CUID, pagina: "1" }).success).toBe(false);
  });
});

describe("listarHistorialDePagos", () => {
  it("404 por alumno ausente y permite inactivos", async () => {
    m.alumnos.mockResolvedValueOnce([]);
    await expect(listarHistorialDePagos(query(), usuario)).rejects.toMatchObject({ code: "ALUMNO_NO_ENCONTRADO" });
    m.alumnos.mockResolvedValueOnce([{ id: CUID, activo: false }]);
    await expect(listarHistorialDePagos(query(), usuario)).resolves.toMatchObject({ modo: "HISTORIAL" });
  });
  it("suma exactamente todas las páginas, excluye anulados y ajusta fuera de rango", async () => {
    const filas = Array.from({ length: 12 }, (_, i) => pago(i + 1));
    filas[11]!.anulado = true;
    filas[0]!.monto = "90071992547409.91";
    m.pagos.mockResolvedValue(filas);
    m.clases.mockImplementation(async (ids: string[]) => ids.map((id) => clase(Number(id.slice(1)))));
    const result = await listarHistorialDePagos(query({ pagina: 99 }), usuario);
    expect(result).toMatchObject({ modo: "HISTORIAL", total_pagado: "90071992547410.01",
      paginacion: { total: 12, pagina_actual: 2, total_paginas: 2, por_pagina: 10 } });
    if (result.modo !== "HISTORIAL") throw new Error("modo");
    expect(result.items.map((p) => p.pago_id)).toEqual(["p11", "p12"]);
    expect(result.items[1]).toMatchObject({ anulado: true, comprobante: { id: "c12" }, puede_corregir: true });
    expect(m.corregir).toHaveBeenCalledWith(usuario, expect.objectContaining({ cajaAbierta: true }), expect.any(Date));
  });
  it("filtra materia y usa valores corregidos vigentes de la fachada", async () => {
    m.pagos.mockResolvedValue([{ ...pago(1, "2.50"), monto_original: "1.00", motivo_ajuste: "Ajuste", ajustado_por: "mesa" }, pago(2, "7.00")]);
    m.clases.mockResolvedValue([clase(1), clase(2)]);
    const result = await listarHistorialDePagos(query({ materia_id: "m1", desde: "2026-10-01", forma_pago_id: "formapago-efectivo" }), usuario);
    expect(m.pagos).toHaveBeenCalledWith(CUID, { desde: "2026-10-01", hasta: undefined, formaPagoId: "formapago-efectivo" });
    expect(result).toMatchObject({ modo: "HISTORIAL", total_pagado: "2.50", paginacion: { total: 1 },
      items: [{ monto: "2.50", monto_original: "1.00", ajuste: { motivo: "Ajuste", ajustado_por: { nombre_completo: "Pérez, Ana" } } }] });
  });
  it("estado delega vigencia a C, muestra vencimiento y limita el atajo a mesa antes del inicio", async () => {
    const base = { inscripcion_id: "i1", turno_id: "t1", fecha: "2026-10-14", hora_inicio: "16:00",
      materia: { id: "m1", nombre: "Álgebra" }, profesor_id: "pr1", profesor: "López, Sol",
      precio: 550, estado_pago: "RESERVADA", vence_el: "2026-10-13T18:00:00-03:00" };
    m.inscripciones.mockResolvedValue([base]);
    const result = await listarHistorialDePagos(query({ estado_pago: "RESERVADA", desde: "2026-10-14" }), usuario);
    expect(m.inscripciones).toHaveBeenCalledWith(CUID, { desde: "2026-10-14", hasta: undefined, estadoPago: "RESERVADA" });
    expect(result).toMatchObject({ modo: "ESTADO_DE_PAGO", items: [{ puede_registrar_pago: true, vence_el: base.vence_el }] });
    expect(result).not.toHaveProperty("total_pagado");
    const gerente = await listarHistorialDePagos(query({ estado_pago: "RESERVADA" }), { id: "g", rol: "GERENTE", puedeCrearPago: false });
    expect(gerente).toMatchObject({ items: [{ puede_registrar_pago: false }] });
    m.inscripciones.mockResolvedValue([{ ...base, fecha: "2026-10-12" }]);
    const iniciada = await listarHistorialDePagos(query({ estado_pago: "RESERVADA" }), usuario);
    expect(iniciada).toMatchObject({ items: [{ puede_registrar_pago: false }] });
  });
  it("vacío devuelve página 1 y total cero", async () => {
    expect(await listarHistorialDePagos(query({ pagina: 999 }), usuario)).toMatchObject({
      paginacion: { pagina_actual: 1, total_paginas: 0, total: 0 }, total_pagado: "0.00" });
  });
});

describe("obtenerOpcionesHistorialPagos", () => {
  it("incluye formas inactivas y materias de anulados, orden alfabético", async () => {
    m.pagos.mockResolvedValue([
      { ...pago(1), forma_pago: { id: "f1", nombre: "Zeta", is_active: false }, anulado: true },
      { ...pago(2), forma_pago: { id: "f2", nombre: "Ágil", is_active: true } },
    ]);
    m.clases.mockResolvedValue([clase(1), clase(2)]);
    expect(await obtenerOpcionesHistorialPagos(CUID)).toEqual({
      formas_pago: [{ id: "f2", nombre: "Ágil", is_active: true }, { id: "f1", nombre: "Zeta", is_active: false }],
      materias: [{ id: "m1", nombre: "Álgebra" }, { id: "m2", nombre: "Biología" }],
    });
  });
});
