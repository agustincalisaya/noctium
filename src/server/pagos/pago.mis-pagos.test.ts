import { beforeEach, describe, expect, it, vi } from "vitest";

// HU-I-05 (spec_modulo_I.md §2.15): servicio de «Mis pagos» sobre las lecturas
// públicas (fachadas de I, B y C simuladas). Lo de PostgreSQL real está en
// pago.mis-pagos.pg.test.ts.

const m = vi.hoisted(() => ({ alumnoDeUsuario: vi.fn(), pagos: vi.fn(), clases: vi.fn(), nombres: vi.fn() }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnoDeUsuario: m.alumnoDeUsuario, obtenerAlumnosBasicos: vi.fn(), buscarAlumnosActivos: vi.fn() }));
vi.mock("@/server/pagos/pago.publico", () => ({ listarPagosDeAlumno: m.pagos }));
vi.mock("@/server/turnos/inscripcion.publico", () => ({ obtenerClasesBasicas: m.clases }));
vi.mock("@/server/personal/personal.publico", () => ({ obtenerNombresPersonal: m.nombres }));
const { listarMisPagos, obtenerOpcionesMisPagos } = await import("./pago.service");
const { MisPagosQuerySchema } = await import("./pago.schema");

const q = (extra: Record<string, unknown> = {}) => MisPagosQuerySchema.parse(extra);
const pago = (n: number, extra: Record<string, unknown> = {}) => ({
  pago_id: `p${String(n).padStart(2, "0")}`, turno_id: `t${n}`, inscripcion_id: `i${n}`, operacion_id: `o${n}`,
  monto: "1000.00", monto_original: "1200.00", precio: 1200, motivo_ajuste: "Beca SECRETA", ajustado_por: "mesa-1",
  forma_pago: { id: "f1", nombre: "Efectivo", is_active: false },
  fecha_pago: "2026-10-12", registrado_en: "2026-10-12T13:00:00.000Z", registrado_por: "mesa-1",
  anulado: false, anulacion: null, comprobante_vigente: { id: `c${n}`, numero: `0001-0000000${n}` },
  cambios: 2, clases_de_la_operacion: 1, caja_abierta: true, ...extra,
});
const clase = (n: number, materia = n % 2 ? { id: "m-fis", nombre: "Física I" } : { id: "m-alg", nombre: "Álgebra" }) => ({
  turno_id: `t${n}`, fecha: "2026-10-14", hora_inicio: "16:00", hora_fin: "17:00", estado: "DISPONIBLE",
  materia, profesor: { id: "prof-1", nombre_para_mostrar: "Gómez, Laura" }, inicio: new Date(),
});
const clasesDe = (ids: string[]) => ids.map((id) => clase(Number(id.slice(1))));

beforeEach(() => {
  vi.resetAllMocks();
  m.alumnoDeUsuario.mockResolvedValue({ id: "alumno-A", activo: true });
  m.pagos.mockResolvedValue([]);
  m.clases.mockImplementation(async (ids: string[]) => clasesDe(ids));
});

describe("listarMisPagos", () => {
  it("resuelve el alumno por la sesión y lee solo sus pagos; sin ficha → 404 ALUMNO_NO_ENCONTRADO", async () => {
    await listarMisPagos("usuario-A", q());
    expect(m.alumnoDeUsuario).toHaveBeenCalledWith("usuario-A");
    expect(m.pagos).toHaveBeenCalledWith("alumno-A", { desde: undefined, hasta: undefined });
    m.alumnoDeUsuario.mockResolvedValue(null);
    await expect(listarMisPagos("usuario-sin-ficha", q())).rejects.toMatchObject({ code: "ALUMNO_NO_ENCONTRADO", status: 404 });
  });

  it("dos alumnos de la misma clase: la sesión de A recibe exclusivamente pagos de A", async () => {
    m.alumnoDeUsuario.mockImplementation(async (u: string) => ({ id: u === "usuario-A" ? "alumno-A" : "alumno-B", activo: true }));
    m.pagos.mockImplementation(async (alumnoId: string) => alumnoId === "alumno-A" ? [pago(1)] : [pago(2, { turno_id: "t1" })]);
    const a = await listarMisPagos("usuario-A", q());
    expect(a.items.map((i) => i.pago_id)).toEqual(["p01"]);
    expect(m.pagos).toHaveBeenCalledTimes(1);
    expect(m.pagos).toHaveBeenCalledWith("alumno-A", expect.anything());
  });

  it("pasa las fechas validadas como fecha civil AAAA-MM-DD a la lectura pública (fecha de pago vigente)", async () => {
    await listarMisPagos("usuario-A", q({ desde: "2026-10-01", hasta: "2026-10-31" }));
    expect(m.pagos).toHaveBeenCalledWith("alumno-A", { desde: "2026-10-01", hasta: "2026-10-31" });
  });

  it("más de diez filas: total exacto de todo el resultado (centavos), anulados cuentan como filas pero no suman, página 2", async () => {
    const filas = Array.from({ length: 13 }, (_, i) => pago(i + 1, { monto: "0.10" }));
    filas[0] = pago(1, { monto: "90071992547409.91" });
    filas[12] = pago(13, { monto: "500.00", anulado: true, anulacion: { fecha: "2026-10-13T00:00:00.000Z", motivo: "Reintegro SECRETO" } });
    m.pagos.mockResolvedValue(filas);
    const r = await listarMisPagos("usuario-A", q({ pagina: "2" }));
    expect(r.total_pagado).toBe("90071992547411.01");
    expect(r.paginacion).toEqual({ total: 13, pagina_actual: 2, total_paginas: 2, por_pagina: 10 });
    expect(r.items.map((i) => i.pago_id)).toEqual(["p11", "p12", "p13"]);
    expect(r.items[2]).toMatchObject({ anulado: true, monto: "500.00", comprobante: { id: "c13" } });
  });

  it("conserva el orden de la lectura pública (fecha, registro e id descendentes)", async () => {
    m.pagos.mockResolvedValue([pago(3), pago(1), pago(2)]);
    expect((await listarMisPagos("usuario-A", q())).items.map((i) => i.pago_id)).toEqual(["p03", "p01", "p02"]);
  });

  it("página fuera de rango → la última; vacío → página 1 y total_paginas 0 con total 0.00", async () => {
    m.pagos.mockResolvedValue(Array.from({ length: 11 }, (_, i) => pago(i + 1)));
    expect((await listarMisPagos("usuario-A", q({ pagina: "99" }))).paginacion).toMatchObject({ pagina_actual: 2, total_paginas: 2 });
    m.pagos.mockResolvedValue([]);
    expect(await listarMisPagos("usuario-A", q({ pagina: "5" }))).toEqual({
      total_pagado: "0.00", items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 },
    });
  });

  it("filtro por materia en el servidor combinado con fechas; materia ajena o inexistente → vacío", async () => {
    m.pagos.mockResolvedValue([pago(1), pago(2), pago(3, { monto: "0.05" })]);
    const fis = await listarMisPagos("usuario-A", q({ materia_id: "m-fis", desde: "2026-10-01" }));
    expect(fis.items.map((i) => i.pago_id)).toEqual(["p01", "p03"]);
    expect(fis.total_pagado).toBe("1000.05");
    expect(m.pagos).toHaveBeenLastCalledWith("alumno-A", { desde: "2026-10-01", hasta: undefined });
    const ajena = await listarMisPagos("usuario-A", q({ materia_id: "m-de-B" }));
    expect(ajena).toMatchObject({ items: [], total_pagado: "0.00", paginacion: { total: 0 } });
  });

  it("todos anulados: se listan y el total es 0.00", async () => {
    m.pagos.mockResolvedValue([pago(1, { anulado: true }), pago(2, { anulado: true })]);
    expect(await listarMisPagos("usuario-A", q())).toMatchObject({ total_pagado: "0.00", paginacion: { total: 2 } });
  });

  it("proyección propia por allowlist: claves exactas, sin precio, ajuste, motivo, actores, caja, operación ni cambios", async () => {
    m.pagos.mockResolvedValue([pago(1, { anulado: true, anulacion: { fecha: "2026-10-13T00:00:00.000Z", motivo: "Reintegro SECRETO" } })]);
    const r = await listarMisPagos("usuario-A", q());
    expect(Object.keys(r).sort()).toEqual(["items", "paginacion", "total_pagado"]);
    expect(r.items[0]).toEqual({
      pago_id: "p01", fecha_pago: "2026-10-12",
      clase: { fecha: "2026-10-14", hora_inicio: "16:00", materia: { id: "m-fis", nombre: "Física I" } },
      monto: "1000.00", forma_pago: { id: "f1", nombre: "Efectivo" }, anulado: true,
      comprobante: { id: "c1", numero: "0001-00000001" },
    });
    const json = JSON.stringify(r);
    for (const prohibido of ["SECRET", "mesa-1", "precio", "monto_original", "ajuste", "motivo", "registrado", "caja", "operacion", "cambios", "puede_corregir", "is_active", "Gómez", "prof-1", "turno_id", "inscripcion"]) {
      expect(json).not.toContain(prohibido);
    }
    expect(m.nombres).not.toHaveBeenCalled();
  });

  it("comprobante ausente en la lectura se refleja como null (no se inventa)", async () => {
    m.pagos.mockResolvedValue([pago(1, { comprobante_vigente: null })]);
    expect((await listarMisPagos("usuario-A", q())).items[0]!.comprobante).toBeNull();
  });

  it("un pago sin clase en C es una inconsistencia: falla, no se omite ni se inventa", async () => {
    m.pagos.mockResolvedValue([pago(1)]);
    m.clases.mockResolvedValue([]);
    await expect(listarMisPagos("usuario-A", q())).rejects.toThrow("Pago p01 sin clase t1");
  });

  it("lee las clases en lote, una sola vez", async () => {
    m.pagos.mockResolvedValue([pago(1), pago(2), pago(3)]);
    await listarMisPagos("usuario-A", q());
    expect(m.clases).toHaveBeenCalledTimes(1);
    expect(m.clases).toHaveBeenCalledWith(["t1", "t2", "t3"]);
  });
});

describe("obtenerOpcionesMisPagos", () => {
  it("materias de todos sus pagos (anulados incluidos), sin filtros, sin duplicados, en orden alfabético normalizado y sin formas", async () => {
    m.pagos.mockResolvedValue([pago(1), pago(2, { anulado: true }), pago(3), pago(4)]);
    m.clases.mockImplementation(async (ids: string[]) => ids.map((id) => {
      const n = Number(id.slice(1));
      return clase(n, n === 4 ? { id: "m-zoo", nombre: "zoología" } : undefined);
    }));
    const r = await obtenerOpcionesMisPagos("usuario-A");
    expect(m.pagos).toHaveBeenCalledWith("alumno-A");
    expect(r).toEqual({ materias: [{ id: "m-alg", nombre: "Álgebra" }, { id: "m-fis", nombre: "Física I" }, { id: "m-zoo", nombre: "zoología" }] });
  });
  it("sin pagos → lista vacía; sin ficha → 404", async () => {
    expect(await obtenerOpcionesMisPagos("usuario-A")).toEqual({ materias: [] });
    m.alumnoDeUsuario.mockResolvedValue(null);
    await expect(obtenerOpcionesMisPagos("x")).rejects.toMatchObject({ code: "ALUMNO_NO_ENCONTRADO" });
  });
});
