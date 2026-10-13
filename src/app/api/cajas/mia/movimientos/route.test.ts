import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// HU-I-12-b: contrato HTTP de los movimientos manuales (spec_modulo_I.md
// §2.10.3 a §2.10.5): permiso cajas:movimiento, Zod antes del servicio y sobre
// { data, error }. Los flujos están simulados; sus reglas se prueban con PostgreSQL real.

const m = vi.hoisted(() => ({
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
  registrarMiMovimiento: vi.fn(), anularMiMovimiento: vi.fn(),
}));
vi.mock("@/server/pagos/caja.flujos", () => ({ registrarMiMovimiento: m.registrarMiMovimiento, anularMiMovimiento: m.anularMiMovimiento }));
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

const movimientos = await import("./route");
const anulacion = await import("./[movimientoId]/anulacion/route");

type Handler = (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>;
const registrar = movimientos.POST as Handler;
const anular = anulacion.POST as Handler;
const llamar = (handler: Handler, url: string, body: unknown, params: Record<string, string> = {}) =>
  handler(new NextRequest(`http://localhost${url}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
  }), { params: Promise.resolve(params) });
const registrarCon = (body: unknown) => llamar(registrar, "/api/cajas/mia/movimientos", body);
const anularCon = (body: unknown, movimientoId = "mov1") =>
  llamar(anular, `/api/cajas/mia/movimientos/${movimientoId}/anulacion`, body, { movimientoId });

const permisoPedido = () => m.permiso.mock.calls[0]?.[0]?.where?.rolPermiso_accionPermiso?.accionPermiso;
const VALIDO = { tipo: "INGRESO", monto: "1000", concepto: "Ingreso de cambio para la caja" };

beforeEach(() => {
  vi.resetAllMocks();
  m.sesion.actual = { user: { id: "u1", rol: "MESA_ENTRADA" } };
  m.permiso.mockResolvedValue({});
});

describe("HU-I-12-b: sesión y permiso cajas:movimiento", () => {
  it.each([
    ["POST /mia/movimientos", () => registrarCon(VALIDO), "registrarMiMovimiento"],
    ["POST /mia/movimientos/[id]/anulacion", () => anularCon({ motivo: "Error de carga" }), "anularMiMovimiento"],
  ] as const)("%s: sin sesión 401; gerente sin el permiso 403 SIN_PERMISO sin llamar al flujo", async (_n, llamada, flujo) => {
    m.sesion.actual = null;
    expect((await llamada()).status).toBe(401);
    m.sesion.actual = { user: { id: "g1", rol: "GERENTE" } };
    m.permiso.mockResolvedValue(null);
    const r = await llamada();
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(permisoPedido()).toBe("cajas:movimiento");
    expect(m[flujo]).not.toHaveBeenCalled();
  });
});

describe("registrar movimiento (§2.10.3)", () => {
  it("201 con { data, error: null }, el usuario de la sesión y los datos ya recortados", async () => {
    const data = { id: "mov1", tipo: "INGRESO", monto: "1000.00", concepto: "Ingreso de cambio para la caja", momento: "2026-10-12T11:00:00-03:00" };
    m.registrarMiMovimiento.mockResolvedValue(data);
    const r = await registrarCon({ ...VALIDO, concepto: "  Ingreso de cambio para la caja  " });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ data, error: null });
    expect(m.registrarMiMovimiento).toHaveBeenCalledWith("u1", VALIDO);
  });
  it.each([
    { ...VALIDO, monto: "0" }, { ...VALIDO, monto: "-5" }, { ...VALIDO, monto: "1.234" }, { ...VALIDO, tipo: "AJUSTE" },
    { ...VALIDO, concepto: "   " }, { ...VALIDO, concepto: "x".repeat(201) }, { ...VALIDO, caja_id: "c1" }, { tipo: "INGRESO" }, "no es JSON",
  ])("400 VALIDACION sin llamar al flujo (%j)", async (body) => {
    const r = await registrarCon(body);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "VALIDACION", detalles: { fieldErrors: expect.any(Object) } } });
    expect(m.registrarMiMovimiento).not.toHaveBeenCalled();
  });
  it("egreso que supera el efectivo: 409 EGRESO_SUPERA_EFECTIVO sin detalles (arqueo ciego)", async () => {
    m.registrarMiMovimiento.mockRejectedValue(new ErrorDeDominio("errores.caja.egresoSuperaEfectivo"));
    const r = await registrarCon({ ...VALIDO, tipo: "EGRESO", monto: "999999" });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ data: null, error: { code: "EGRESO_SUPERA_EFECTIVO", message: "El egreso supera el efectivo de la caja." } });
  });
  it("sin caja abierta: 409 CAJA_NO_ABIERTA", async () => {
    m.registrarMiMovimiento.mockRejectedValue(new ErrorDeDominio("errores.caja.sinCajaAbierta"));
    const r = await registrarCon(VALIDO);
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe("CAJA_NO_ABIERTA");
  });
});

describe("anular movimiento (§2.10.4)", () => {
  it("201 con el id de la anulación; pasa el id de la ruta y el motivo recortado", async () => {
    m.anularMiMovimiento.mockResolvedValue({ id: "an1" });
    const r = await anularCon({ motivo: "  Error de carga " });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ data: { id: "an1" }, error: null });
    expect(m.anularMiMovimiento).toHaveBeenCalledWith("u1", "mov1", "Error de carga");
  });
  it.each([{}, { motivo: "" }, { motivo: "   " }, { motivo: "x".repeat(301) }, { motivo: "ok", extra: 1 }])("400 VALIDACION sin llamar al flujo (%j)", async (body) => {
    expect((await anularCon(body)).status).toBe(400);
    expect(m.anularMiMovimiento).not.toHaveBeenCalled();
  });
  it("id de ruta demasiado largo: 400", async () => {
    expect((await anularCon({ motivo: "x" }, "x".repeat(65))).status).toBe(400);
    expect(m.anularMiMovimiento).not.toHaveBeenCalled();
  });
  it.each([
    ["errores.caja.movimientoNoEncontrado", 404, "MOVIMIENTO_NO_ENCONTRADO"],
    ["errores.caja.movimientoYaAnulado", 409, "MOVIMIENTO_YA_ANULADO"],
    ["errores.caja.anulacionDejaEfectivoNegativo", 409, "ANULACION_DEJA_EFECTIVO_NEGATIVO"],
    ["errores.caja.sinCajaAbierta", 409, "CAJA_NO_ABIERTA"],
  ] as const)("%s → %i %s, sin detalles", async (clave, status, code) => {
    m.anularMiMovimiento.mockRejectedValue(new ErrorDeDominio(clave));
    const r = await anularCon({ motivo: "Error de carga" });
    expect(r.status).toBe(status);
    const cuerpo = await r.json();
    expect(cuerpo.error.code).toBe(code);
    expect(cuerpo.error.detalles).toBeUndefined();
  });
});
