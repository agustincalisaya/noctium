import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// HU-I-12: lecturas de la caja con la base simulada (las pruebas con
// PostgreSQL real están en caja.lecturas.pg.test.ts). Las fachadas de otros
// módulos y el servicio de la caja están simulados.

const m = vi.hoisted(() => ({
  cajaAbiertaDe: vi.fn(),
  calcularResumen: vi.fn(),
  nombres: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/pagos/caja.service", () => ({ cajaAbiertaDe: m.cajaAbiertaDe, calcularResumen: m.calcularResumen }));
vi.mock("@/server/personal/personal.publico", () => ({ obtenerNombresPersonal: m.nombres }));
vi.mock("@/server/alumnos/alumno.publico", () => ({
  obtenerAlumnosBasicos: async () => [{ id: "a1", nombre: "Ana", apellido: "Pérez", dni: "1", activo: true, forma_pago_preferida_id: null }],
}));
vi.mock("@/server/turnos/inscripcion.publico", () => ({
  obtenerClasesBasicas: async () => [{ turno_id: "t1", fecha: "2026-10-12", hora_inicio: "10:00", materia: { id: "m1", nombre: "Física I" } }],
}));
vi.mock("@/server/shared/parametros-vigentes", () => ({ datosCentro: async () => ({ nombre: "Centro", domicilio: "Calle 1", telefono: "123" }) }));
vi.mock("@/server/shared/reloj", () => ({ ahora: () => new Date("2026-10-09T15:00:00.000Z") }));

const { listarCajasYCierres, listarMisCierres, obtenerCajaPropia, obtenerDetalleCierre, obtenerResumenCierre } = await import("./caja.lecturas");

const d = (valor: string) => new Prisma.Decimal(valor);
const ABIERTA_EL = new Date("2026-10-09T12:00:00.000Z");

function pago(id: string, monto: string, extra: Partial<{ anulacion: object | null; createdAtPago: Date }> = {}) {
  return {
    idPago: id, turnoId: "t1", inscripcionId: `i-${id}`, precio: 12000, montoPago: d(monto), correcciones: [],
    motivoAjuste: null, ajustadoPorUsuarioId: null, createdAtPago: new Date("2026-10-09T13:00:00.000Z"), anulacion: null, ...extra,
  };
}

function baseSimulada() {
  return {
    caja: {
      findUniqueOrThrow: vi.fn(async () => ({ idCaja: "c1", usuarioId: "u1", abiertaEl: ABIERTA_EL, fondoInicial: d("5000"), efectivoDeclarado: null })),
      findUnique: vi.fn(),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    operacionPago: {
      findMany: vi.fn(async () => [{
        idOperacionPago: "o1", alumnoId: "a1", cajaId: "c1", creadoPorUsuarioId: "u1", registradaEl: new Date("2026-10-09T13:15:00.000Z"),
        formaPagoId: "f-efectivo", fechaPago: new Date("2026-10-09"), correcciones: [],
        pagos: [pago("p1", "12000"), pago("p2", "8000", { anulacion: { idAnulacionPago: "an1", createdAtAnulacionPago: new Date(), motivo: "x" } })],
      }]),
    },
    movimientoCaja: {
      findMany: vi.fn(async () => [{
        idMovimientoCaja: "mv1", tipo: "EGRESO", monto: d("1000"), concepto: "Retiro para comprar insumos",
        createdAtMovimientoCaja: new Date("2026-10-09T14:00:00.000Z"), anulacion: null,
      }]),
    },
    ajusteCaja: {
      findMany: vi.fn(async () => [{
        idAjusteCaja: "aj1", pagoId: "p9", anulacionPagoId: "an9", formaPagoId: "f-efectivo", monto: d("-24000"),
        createdAtAjusteCaja: new Date("2026-10-09T12:30:00.000Z"), pago: { alumnoId: "a1", turnoId: "t1" },
      }]),
    },
    formaPago: { findMany: vi.fn(async () => [{ idFormaPago: "f-efectivo", nombreFormaPago: "Efectivo" }]) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.nombres.mockImplementation(async (ids: string[]) => ids.map((id) => ({ usuario_id: id, nombre_completo: `Apellido ${id}, Nombre` })));
});

/** Todas las claves de un objeto, recorriendo arreglos y objetos anidados. */
const claves = (valor: unknown): string[] => Array.isArray(valor)
  ? valor.flatMap(claves)
  : valor && typeof valor === "object" ? Object.entries(valor).flatMap(([k, v]) => [k, ...claves(v)]) : [];

describe("obtenerCajaPropia (arqueo ciego, §2.10.2)", () => {
  it("sin caja abierta responde { caja: null }", async () => {
    m.cajaAbiertaDe.mockResolvedValue(null);
    expect(await obtenerCajaPropia("u1", baseSimulada() as never)).toEqual({ caja: null });
  });

  it("lista cobros (uno por pago), movimientos y ajustes del más nuevo al más viejo, con los anulados marcados y sin ningún total", async () => {
    m.cajaAbiertaDe.mockResolvedValue({ id: "c1", abiertaEl: ABIERTA_EL });
    const { caja } = await obtenerCajaPropia("u1", baseSimulada() as never);
    expect(caja).toMatchObject({ id: "c1", abierta_el: "2026-10-09T09:00:00-03:00", fondo_inicial: "5000.00", efectivo_declarado: null });
    expect(caja!.items.map((i) => [i.tipo, i.id])).toEqual([["MOVIMIENTO", "mv1"], ["COBRO", "p2"], ["COBRO", "p1"], ["AJUSTE", "aj1"]]);
    expect(caja!.items[0]).toEqual({
      tipo: "MOVIMIENTO", id: "mv1", momento: "2026-10-09T11:00:00-03:00", detalle: "Retiro para comprar insumos",
      movimiento: "EGRESO", monto: "1000.00", anulado: false,
    });
    expect(caja!.items[2]).toEqual({
      tipo: "COBRO", id: "p1", momento: "2026-10-09T10:15:00-03:00", detalle: "Pérez, Ana · Física I 12/10",
      forma_pago: { id: "f-efectivo", nombre: "Efectivo" }, monto: "12000.00", anulado: false,
    });
    expect(caja!.items[1]).toMatchObject({ anulado: true, monto: "8000.00" });
    expect(caja!.items[3]).toMatchObject({ tipo: "AJUSTE", origen: "ANULACION", monto: "-24000.00" });
    // Criterio 5: ni totales, ni subtotales, ni el esperado (tampoco anidados).
    const todas = claves(caja);
    for (const prohibida of ["efectivo_esperado", "total", "totales", "subtotal", "diferencia", "resumen", "huella"]) {
      expect(todas).not.toContain(prohibida);
    }
    expect(m.calcularResumen).not.toHaveBeenCalled();
  });
});

describe("obtenerResumenCierre (paso 2, §2.11)", () => {
  const caja = { idCaja: "c1", usuarioId: "u1", estado: "ABIERTA", abiertaEl: ABIERTA_EL, efectivoDeclarado: d("17000") };

  it("sin efectivo declarado responde EFECTIVO_NO_DECLARADO y no calcula el resumen", async () => {
    const db = baseSimulada();
    m.cajaAbiertaDe.mockResolvedValue({ id: "c1", abiertaEl: ABIERTA_EL });
    db.caja.findUnique.mockResolvedValue({ ...caja, efectivoDeclarado: null });
    await expect(obtenerResumenCierre({ usuarioId: "u1" }, db as never)).rejects.toMatchObject({ code: "EFECTIVO_NO_DECLARADO", status: 409 });
    expect(m.calcularResumen).not.toHaveBeenCalled();
  });

  it("propia sin caja abierta: CAJA_NO_ABIERTA", async () => {
    m.cajaAbiertaDe.mockResolvedValue(null);
    await expect(obtenerResumenCierre({ usuarioId: "u1" }, baseSimulada() as never)).rejects.toMatchObject({ code: "CAJA_NO_ABIERTA" });
  });

  it("declarado: el resumen y la huella de calcularResumen, con el integrante", async () => {
    const db = baseSimulada();
    m.cajaAbiertaDe.mockResolvedValue({ id: "c1", abiertaEl: ABIERTA_EL });
    db.caja.findUnique.mockResolvedValue(caja);
    m.calcularResumen.mockResolvedValue({ resumen: { efectivo_esperado: "17000.00" }, huella: "h1" });
    expect(await obtenerResumenCierre({ usuarioId: "u1" }, db as never)).toEqual({
      caja_id: "c1", abierta_el: "2026-10-09T09:00:00-03:00", integrante: { id: "u1", nombre_completo: "Apellido u1, Nombre" },
      resumen: { efectivo_esperado: "17000.00" }, huella: "h1",
    });
  });

  it("por ausencia: la caja propia es FUERA_DE_ALCANCE; inexistente 404; cerrada CAJA_YA_CERRADA", async () => {
    const db = baseSimulada();
    db.caja.findUnique.mockResolvedValueOnce(caja);
    await expect(obtenerResumenCierre({ usuarioId: "u1", cajaId: "c1" }, db as never)).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE", status: 403 });
    db.caja.findUnique.mockResolvedValueOnce(null);
    await expect(obtenerResumenCierre({ usuarioId: "g1", cajaId: "x" }, db as never)).rejects.toMatchObject({ code: "CAJA_NO_ENCONTRADA", status: 404 });
    db.caja.findUnique.mockResolvedValueOnce({ ...caja, estado: "CERRADA" });
    await expect(obtenerResumenCierre({ usuarioId: "g1", cajaId: "c1" }, db as never)).rejects.toMatchObject({ code: "CAJA_YA_CERRADA" });
  });
});

function cerrada(id: string, extra: object = {}) {
  return {
    idCaja: id, usuarioId: "u1", estado: "CERRADA", abiertaEl: ABIERTA_EL, cerradaEl: new Date("2026-10-09T22:30:00.000Z"),
    fondoInicial: d("5000"), efectivoEsperado: d("12500"), efectivoDeclarado: d("11000"), diferencia: d("-1500"),
    motivo: "Se dio mal un vuelto", porAusencia: false, cerradaPorUsuarioId: "u1", resumen: { efectivo_esperado: "12500.00" }, ...extra,
  };
}

describe("listados de cierres (§2.12, criterio 11)", () => {
  it("«Mis cierres»: solo los del usuario, cerrados, más nuevos primero, de a 10", async () => {
    const db = baseSimulada();
    db.caja.count.mockResolvedValue(23);
    db.caja.findMany.mockResolvedValue([cerrada("c3")] as never);
    const r = await listarMisCierres("u1", 3, db as never);
    expect(db.caja.count).toHaveBeenCalledWith({ where: { usuarioId: "u1", estado: "CERRADA" } });
    expect(db.caja.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuarioId: "u1", estado: "CERRADA" }, orderBy: [{ cerradaEl: "desc" }, { idCaja: "desc" }], skip: 20, take: 10,
    }));
    expect(r.paginacion).toEqual({ total: 23, pagina_actual: 3, total_paginas: 3, por_pagina: 10 });
    expect(r.items[0]).toEqual({
      id: "c3", integrante: { id: "u1", nombre_completo: "Apellido u1, Nombre" }, abierta_el: "2026-10-09T09:00:00-03:00",
      cerrada_el: "2026-10-09T19:30:00-03:00", fondo_inicial: "5000.00", efectivo_esperado: "12500.00", efectivo_declarado: "11000.00",
      diferencia: "-1500.00", tipo_diferencia: "FALTANTE", motivo: "Se dio mal un vuelto", por_ausencia: false, cerrada_por: null,
    });
  });

  it("una página fuera de rango se lleva a la última; sin resultados, página 1 y 0 páginas", async () => {
    const db = baseSimulada();
    db.caja.count.mockResolvedValueOnce(12);
    expect((await listarMisCierres("u1", 9, db as never)).paginacion).toMatchObject({ pagina_actual: 2, total_paginas: 2 });
    db.caja.count.mockResolvedValueOnce(0);
    expect((await listarMisCierres("u1", 4, db as never)).paginacion).toEqual({ total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 });
  });

  it("gerente: filtra los cierres por integrante y por fecha de CIERRE (días del centro, inclusivos) y lista todas las abiertas con su antigüedad", async () => {
    const db = baseSimulada();
    db.caja.findMany.mockImplementation((async (args: { where: { estado: string } }) =>
      args.where.estado === "ABIERTA" ? [{ idCaja: "ab1", usuarioId: "u2", abiertaEl: new Date("2026-10-09T12:00:00.000Z") }] : []) as never);
    const r = await listarCajasYCierres({ integranteId: "u1", desde: "2026-10-01", hasta: "2026-10-09", pagina: 1 }, db as never);
    const filtro = { usuarioId: "u1", cerradaEl: { gte: new Date("2026-10-01T03:00:00.000Z"), lt: new Date("2026-10-10T03:00:00.000Z") }, estado: "CERRADA" };
    expect(db.caja.count).toHaveBeenCalledWith({ where: filtro });
    expect(db.caja.findMany).toHaveBeenCalledWith({ where: { estado: "ABIERTA" }, orderBy: [{ abiertaEl: "asc" }, { idCaja: "asc" }] });
    expect(r.abiertas).toEqual([{
      id: "ab1", integrante: { id: "u2", nombre_completo: "Apellido u2, Nombre" }, abierta_el: "2026-10-09T09:00:00-03:00", antiguedad_minutos: 180,
    }]);
    // Las abiertas no traen ningún monto (arqueo ciego también para el gerente).
    expect(claves(r.abiertas)).not.toContain("fondo_inicial");
  });

  it("sin filtros no restringe los cierres", async () => {
    const db = baseSimulada();
    await listarCajasYCierres({ pagina: 1 }, db as never);
    expect(db.caja.count).toHaveBeenCalledWith({ where: { estado: "CERRADA" } });
  });
});

describe("obtenerDetalleCierre (§2.12, criterio 8)", () => {
  it("devuelve el resumen fijo guardado (no recalcula), el responsable del cierre por ausencia y los datos del centro", async () => {
    const db = baseSimulada();
    db.caja.findUnique.mockResolvedValue(cerrada("c1", { porAusencia: true, cerradaPorUsuarioId: "g1" }));
    const r = await obtenerDetalleCierre("c1", { usuarioId: "g1", esGerente: true }, db as never);
    expect(r).toMatchObject({
      id: "c1", por_ausencia: true, cerrada_por: { id: "g1", nombre_completo: "Apellido g1, Nombre" },
      resumen: { efectivo_esperado: "12500.00" }, centro: { nombre: "Centro", domicilio: "Calle 1", telefono: "123" },
    });
    expect(m.calcularResumen).not.toHaveBeenCalled();
  });

  it("mesa de entrada: un cierre ajeno es FUERA_DE_ALCANCE; una caja abierta, CAJA_NO_CERRADA; inexistente, 404", async () => {
    const db = baseSimulada();
    db.caja.findUnique.mockResolvedValueOnce(cerrada("c1"));
    await expect(obtenerDetalleCierre("c1", { usuarioId: "otro", esGerente: false }, db as never)).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE", status: 403 });
    db.caja.findUnique.mockResolvedValueOnce({ ...cerrada("c1"), estado: "ABIERTA", resumen: null });
    await expect(obtenerDetalleCierre("c1", { usuarioId: "u1", esGerente: false }, db as never)).rejects.toMatchObject({ code: "CAJA_NO_CERRADA", status: 409 });
    db.caja.findUnique.mockResolvedValueOnce(null);
    await expect(obtenerDetalleCierre("x", { usuarioId: "g1", esGerente: true }, db as never)).rejects.toMatchObject({ code: "CAJA_NO_ENCONTRADA", status: 404 });
  });
});
