import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// HU-I-12: contrato HTTP de las 11 rutas de /api/cajas (spec_modulo_I.md
// §2.10 a §2.12): permiso granular, Zod antes del servicio y sobre { data, error }.
// Los flujos y las lecturas están simulados; sus reglas se prueban con PostgreSQL real.

const m = vi.hoisted(() => ({
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
  abrirMiCaja: vi.fn(), declararMiEfectivo: vi.fn(), cerrarMiCaja: vi.fn(), declararPorAusencia: vi.fn(), cerrarPorAusencia: vi.fn(),
  obtenerCajaPropia: vi.fn(), obtenerResumenCierre: vi.fn(), listarMisCierres: vi.fn(), listarCajasYCierres: vi.fn(), obtenerDetalleCierre: vi.fn(),
}));
vi.mock("@/server/pagos/caja.flujos", () => ({
  abrirMiCaja: m.abrirMiCaja, declararMiEfectivo: m.declararMiEfectivo, cerrarMiCaja: m.cerrarMiCaja,
  declararPorAusencia: m.declararPorAusencia, cerrarPorAusencia: m.cerrarPorAusencia,
}));
vi.mock("@/server/pagos/caja.lecturas", () => ({
  obtenerCajaPropia: m.obtenerCajaPropia, obtenerResumenCierre: m.obtenerResumenCierre, listarMisCierres: m.listarMisCierres,
  listarCajasYCierres: m.listarCajasYCierres, obtenerDetalleCierre: m.obtenerDetalleCierre,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rolPermiso: { findUnique: m.permiso },
    usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) },
    tokenRevocado: { findUnique: vi.fn() },
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) =>
    handler(Object.assign(req, { auth: m.sesion.actual }), ctx),
  decodificarToken: vi.fn(),
}));

const raiz = await import("./route");
const mia = await import("./mia/route");
const declaracion = await import("./mia/declaracion/route");
const resumen = await import("./mia/resumen/route");
const cierre = await import("./mia/cierre/route");
const misCierres = await import("./mia/cierres/route");
const miCierre = await import("./mia/cierres/[id]/route");
const detalle = await import("./[id]/route");
const ausenciaDeclaracion = await import("./[id]/ausencia/declaracion/route");
const ausenciaResumen = await import("./[id]/ausencia/resumen/route");
const ausenciaCierre = await import("./[id]/ausencia/cierre/route");

type Handler = (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>;
const llamar = (handler: Handler, url: string, { body, id }: { body?: unknown; id?: string } = {}) =>
  handler(new NextRequest(`http://localhost${url}`, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
  }), { params: Promise.resolve(id ? { id } : {}) });

const permisoPedido = () => m.permiso.mock.calls[0]?.[0]?.where?.rolPermiso_accionPermiso?.accionPermiso;

beforeEach(() => {
  vi.resetAllMocks();
  m.sesion.actual = { user: { id: "u1", rol: "MESA_ENTRADA" } };
  m.permiso.mockResolvedValue({});
});

// [nombre, handler, url, opciones, permiso, servicio que no se tiene que llamar sin permiso]
const RUTAS: [string, Handler, string, { body?: unknown; id?: string }, string, keyof typeof m][] = [
  ["POST /api/cajas", raiz.POST as Handler, "/api/cajas", { body: { fondo_inicial: "0" } }, "cajas:abrir", "abrirMiCaja"],
  ["GET /api/cajas", raiz.GET as Handler, "/api/cajas", {}, "cajas:leer_todas", "listarCajasYCierres"],
  ["GET /mia", mia.GET as Handler, "/api/cajas/mia", {}, "cajas:leer", "obtenerCajaPropia"],
  ["POST /mia/declaracion", declaracion.POST as Handler, "/api/cajas/mia/declaracion", { body: { efectivo_declarado: "10" } }, "cajas:cerrar", "declararMiEfectivo"],
  ["GET /mia/resumen", resumen.GET as Handler, "/api/cajas/mia/resumen", {}, "cajas:cerrar", "obtenerResumenCierre"],
  ["POST /mia/cierre", cierre.POST as Handler, "/api/cajas/mia/cierre", { body: { huella: "h" } }, "cajas:cerrar", "cerrarMiCaja"],
  ["GET /mia/cierres", misCierres.GET as Handler, "/api/cajas/mia/cierres", {}, "cajas:leer", "listarMisCierres"],
  ["GET /mia/cierres/[id]", miCierre.GET as Handler, "/api/cajas/mia/cierres/c1", { id: "c1" }, "cajas:leer", "obtenerDetalleCierre"],
  ["GET /[id]", detalle.GET as Handler, "/api/cajas/c1", { id: "c1" }, "cajas:leer_todas", "obtenerDetalleCierre"],
  ["POST /[id]/ausencia/declaracion", ausenciaDeclaracion.POST as Handler, "/api/cajas/c1/ausencia/declaracion", { body: { efectivo_declarado: "10" }, id: "c1" }, "cajas:cerrar_ausencia", "declararPorAusencia"],
  ["GET /[id]/ausencia/resumen", ausenciaResumen.GET as Handler, "/api/cajas/c1/ausencia/resumen", { id: "c1" }, "cajas:cerrar_ausencia", "obtenerResumenCierre"],
  ["POST /[id]/ausencia/cierre", ausenciaCierre.POST as Handler, "/api/cajas/c1/ausencia/cierre", { body: { huella: "h" }, id: "c1" }, "cajas:cerrar_ausencia", "cerrarPorAusencia"],
];

describe("HU-I-12 rutas de /api/cajas: sesión y permiso granular", () => {
  it.each(RUTAS)("%s sin sesión 401; sin permiso 403 SIN_PERMISO sin llamar al servicio; pide %s", async (_n, handler, url, opciones, permiso, servicio) => {
    m.sesion.actual = null;
    expect((await llamar(handler, url, opciones)).status).toBe(401);
    m.sesion.actual = { user: { id: "u1", rol: "PROFESOR" } };
    m.permiso.mockResolvedValue(null);
    const r = await llamar(handler, url, opciones);
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(permisoPedido()).toBe(permiso);
    expect(m[servicio]).not.toHaveBeenCalled();
  });
});

describe("abrir (§2.10.1)", () => {
  it("201 con { data, error: null } y el usuario de la sesión", async () => {
    m.abrirMiCaja.mockResolvedValue({ id: "c1", abierta_el: "2026-10-09T09:00:00-03:00", fondo_inicial: "0.00" });
    const r = await llamar(raiz.POST as Handler, "/api/cajas", { body: { fondo_inicial: "0" } });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ data: { id: "c1", abierta_el: "2026-10-09T09:00:00-03:00", fondo_inicial: "0.00" }, error: null });
    expect(m.abrirMiCaja).toHaveBeenCalledWith("u1", "0");
    expect(r.headers.get("Cache-Control")).toContain("no-store");
  });
  it.each([{ fondo_inicial: "-1" }, { fondo_inicial: "1.234" }, {}, { fondo_inicial: "1", extra: true }, "no es JSON"])("400 VALIDACION sin llamar al servicio (%j)", async (body) => {
    const r = await llamar(raiz.POST as Handler, "/api/cajas", { body });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "VALIDACION", detalles: { fieldErrors: expect.any(Object) } } });
    expect(m.abrirMiCaja).not.toHaveBeenCalled();
  });
  it("409 CAJA_YA_ABIERTA e INTEGRANTE_INACTIVO desde el servicio", async () => {
    m.abrirMiCaja.mockRejectedValueOnce(new ErrorDeDominio("errores.caja.yaAbierta"));
    const r = await llamar(raiz.POST as Handler, "/api/cajas", { body: { fondo_inicial: "10" } });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ data: null, error: { code: "CAJA_YA_ABIERTA", message: "Ya tenés una caja abierta." } });
    m.abrirMiCaja.mockRejectedValueOnce(new ErrorDeDominio("errores.caja.integranteInactivo"));
    expect((await llamar(raiz.POST as Handler, "/api/cajas", { body: { fondo_inicial: "10" } })).status).toBe(409);
  });
});

describe("caja propia y cierre en dos pasos (§2.10.2 y §2.11)", () => {
  it("GET /mia responde { caja: null } sin caja", async () => {
    m.obtenerCajaPropia.mockResolvedValue({ caja: null });
    const r = await llamar(mia.GET as Handler, "/api/cajas/mia");
    expect(await r.json()).toEqual({ data: { caja: null }, error: null });
    expect(m.obtenerCajaPropia).toHaveBeenCalledWith("u1");
  });
  it("declaración: 200 con el resumen; la segunda, 409 EFECTIVO_YA_DECLARADO", async () => {
    m.declararMiEfectivo.mockResolvedValueOnce({ caja_id: "c1", huella: "h" });
    const ok = await llamar(declaracion.POST as Handler, "/api/cajas/mia/declaracion", { body: { efectivo_declarado: "16000" } });
    expect(ok.status).toBe(200);
    expect(m.declararMiEfectivo).toHaveBeenCalledWith("u1", "16000");
    m.declararMiEfectivo.mockRejectedValueOnce(new ErrorDeDominio("errores.caja.efectivoYaDeclarado"));
    const r = await llamar(declaracion.POST as Handler, "/api/cajas/mia/declaracion", { body: { efectivo_declarado: "16000" } });
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe("EFECTIVO_YA_DECLARADO");
  });
  it("resumen antes de declarar: 409 EFECTIVO_NO_DECLARADO", async () => {
    m.obtenerResumenCierre.mockRejectedValue(new ErrorDeDominio("errores.caja.efectivoNoDeclarado"));
    const r = await llamar(resumen.GET as Handler, "/api/cajas/mia/resumen");
    expect(r.status).toBe(409);
    expect((await r.json()).error).toEqual({ code: "EFECTIVO_NO_DECLARADO", message: "Primero declará el efectivo contado." });
    expect(m.obtenerResumenCierre).toHaveBeenCalledWith({ usuarioId: "u1" });
  });
  it("cierre con la huella vieja: 409 CAJA_CAMBIO con el resumen y la huella nuevos en detalles", async () => {
    m.cerrarMiCaja.mockRejectedValue(new ErrorDeDominio("errores.caja.cambio", { resumen: { efectivo_esperado: "19000.00" }, huella: "h2" }));
    const r = await llamar(cierre.POST as Handler, "/api/cajas/mia/cierre", { body: { huella: "h1" } });
    expect(r.status).toBe(409);
    expect((await r.json()).error).toEqual({
      code: "CAJA_CAMBIO", message: "La caja cambió mientras cerrabas. Revisá el resumen.",
      detalles: { resumen: { efectivo_esperado: "19000.00" }, huella: "h2" },
    });
  });
  it("cierre con diferencia sin motivo: 400 MOTIVO_DIFERENCIA_REQUERIDO; con motivo, 200", async () => {
    m.cerrarMiCaja.mockRejectedValueOnce(new ErrorDeDominio("errores.caja.motivoDiferenciaRequerido"));
    const r = await llamar(cierre.POST as Handler, "/api/cajas/mia/cierre", { body: { huella: "h1" } });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("MOTIVO_DIFERENCIA_REQUERIDO");
    m.cerrarMiCaja.mockResolvedValueOnce({ caja_id: "c1", estado: "CERRADA", tipo_diferencia: "FALTANTE" });
    const ok = await llamar(cierre.POST as Handler, "/api/cajas/mia/cierre", { body: { huella: "h1", motivo: "Vuelto" } });
    expect(ok.status).toBe(200);
    expect(m.cerrarMiCaja).toHaveBeenLastCalledWith("u1", { huella: "h1", motivo: "Vuelto" });
  });
  it("cierre: motivo de más de 300 caracteres o sin huella es 400 sin llamar al servicio", async () => {
    for (const body of [{ huella: "h", motivo: "x".repeat(301) }, { motivo: "x" }]) {
      expect((await llamar(cierre.POST as Handler, "/api/cajas/mia/cierre", { body })).status).toBe(400);
    }
    expect(m.cerrarMiCaja).not.toHaveBeenCalled();
  });
  it("doble cierre: 409 CAJA_YA_CERRADA", async () => {
    m.cerrarMiCaja.mockRejectedValue(new ErrorDeDominio("errores.caja.yaCerrada"));
    const r = await llamar(cierre.POST as Handler, "/api/cajas/mia/cierre", { body: { huella: "h1" } });
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe("CAJA_YA_CERRADA");
  });
});

describe("mis cierres y listado del gerente (§2.12)", () => {
  it("mis cierres: pagina de la query (vacía = 1); página inválida 400", async () => {
    m.listarMisCierres.mockResolvedValue({ items: [], paginacion: {} });
    await llamar(misCierres.GET as Handler, "/api/cajas/mia/cierres?pagina=");
    expect(m.listarMisCierres).toHaveBeenLastCalledWith("u1", 1);
    await llamar(misCierres.GET as Handler, "/api/cajas/mia/cierres?pagina=2");
    expect(m.listarMisCierres).toHaveBeenLastCalledWith("u1", 2);
    expect((await llamar(misCierres.GET as Handler, "/api/cajas/mia/cierres?pagina=0")).status).toBe(400);
  });
  it("detalle de un cierre ajeno: 403 FUERA_DE_ALCANCE (mesa de entrada, sin alcance de gerente)", async () => {
    m.obtenerDetalleCierre.mockRejectedValue(new ErrorDeDominio("errores.caja.fueraDeAlcance"));
    const r = await llamar(miCierre.GET as Handler, "/api/cajas/mia/cierres/c9", { id: "c9" });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("FUERA_DE_ALCANCE");
    expect(m.obtenerDetalleCierre).toHaveBeenCalledWith("c9", { usuarioId: "u1", esGerente: false });
  });
  it("gerente: GET /api/cajas con filtros → 200 paginado", async () => {
    m.sesion.actual = { user: { id: "g1", rol: "GERENTE" } };
    m.listarCajasYCierres.mockResolvedValue({ abiertas: [], cierres: { items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 } } });
    const r = await llamar(raiz.GET as Handler, "/api/cajas?integrante_id=u1&desde=2026-10-01&hasta=2026-10-31&pagina=2");
    expect(r.status).toBe(200);
    expect(m.listarCajasYCierres).toHaveBeenCalledWith({ integranteId: "u1", desde: "2026-10-01", hasta: "2026-10-31", pagina: 2 });
  });
  it.each(["?desde=2026-10-31&hasta=2026-10-01", "?desde=31/10/2026", "?por_pagina=50", "?pagina=-1"])("gerente: query inválida %s → 400", async (query) => {
    m.sesion.actual = { user: { id: "g1", rol: "GERENTE" } };
    const r = await llamar(raiz.GET as Handler, `/api/cajas${query}`);
    expect(r.status).toBe(400);
    expect(m.listarCajasYCierres).not.toHaveBeenCalled();
  });
  it("gerente: detalle de una caja abierta → 409 CAJA_NO_CERRADA", async () => {
    m.sesion.actual = { user: { id: "g1", rol: "GERENTE" } };
    m.obtenerDetalleCierre.mockRejectedValue(new ErrorDeDominio("errores.caja.noCerrada"));
    const r = await llamar(detalle.GET as Handler, "/api/cajas/c1", { id: "c1" });
    expect(r.status).toBe(409);
    expect(m.obtenerDetalleCierre).toHaveBeenCalledWith("c1", { usuarioId: "g1", esGerente: true });
  });
});

describe("cierre por ausencia (§2.12, criterio 10)", () => {
  beforeEach(() => { m.sesion.actual = { user: { id: "g1", rol: "GERENTE" } }; });
  it("declara, consulta y cierra sobre la caja de la ruta, con el gerente de la sesión", async () => {
    m.declararPorAusencia.mockResolvedValue({ caja_id: "c1", huella: "h" });
    m.obtenerResumenCierre.mockResolvedValue({ caja_id: "c1", huella: "h" });
    m.cerrarPorAusencia.mockResolvedValue({ caja_id: "c1", por_ausencia: true });
    expect((await llamar(ausenciaDeclaracion.POST as Handler, "/x", { body: { efectivo_declarado: "100" }, id: "c1" })).status).toBe(200);
    expect(m.declararPorAusencia).toHaveBeenCalledWith("g1", "c1", "100");
    expect((await llamar(ausenciaResumen.GET as Handler, "/x", { id: "c1" })).status).toBe(200);
    expect(m.obtenerResumenCierre).toHaveBeenCalledWith({ usuarioId: "g1", cajaId: "c1" });
    const r = await llamar(ausenciaCierre.POST as Handler, "/x", { body: { huella: "h", motivo: "Dejó el centro" }, id: "c1" });
    expect(await r.json()).toEqual({ data: { caja_id: "c1", por_ausencia: true }, error: null });
    expect(m.cerrarPorAusencia).toHaveBeenCalledWith("g1", "c1", { huella: "h", motivo: "Dejó el centro" });
  });
  it("sobre la propia caja: 403 FUERA_DE_ALCANCE", async () => {
    m.declararPorAusencia.mockRejectedValue(new ErrorDeDominio("errores.caja.fueraDeAlcance"));
    const r = await llamar(ausenciaDeclaracion.POST as Handler, "/x", { body: { efectivo_declarado: "100" }, id: "c1" });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("FUERA_DE_ALCANCE");
  });
});
