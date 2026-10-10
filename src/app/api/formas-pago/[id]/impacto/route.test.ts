import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ servicio: vi.fn(), permiso: vi.fn(), sesion: { actual: null as { user: { id: string; rol: string } } | null } }));
vi.mock("@/server/pagos/forma-pago.service", () => ({ obtenerImpactoFormaPago: m.servicio }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: (fn: (tx: unknown) => unknown) => fn({ prueba: true }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: m.permiso }, tokenRevocado: { findUnique: vi.fn() } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) => handler(Object.assign(req, { auth: m.sesion.actual }), ctx),
  decodificarToken: vi.fn(),
}));
import { ErrorDeDominio } from "@/server/shared/error-dominio";
const { GET } = await import("./route");
const impacto = { alumnos_con_preferida: 6, tiene_pagos: true, es_ultima_activa: false };
const llamar = (body: unknown = undefined) => GET(new NextRequest("http://localhost/api/formas-pago/fp1/impacto", {
  method: "GET", ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
}), { params: Promise.resolve({ id: "fp1" }) });
beforeEach(() => {
  vi.resetAllMocks(); m.sesion.actual = { user: { id: "gerente", rol: "GERENTE" } };
  m.permiso.mockImplementation(async ({ where }) => where.rolPermiso_accionPermiso.rolPermiso === "GERENTE" ? {} : null);
  m.servicio.mockResolvedValue(impacto);
});
describe("I-07 impacto GET", () => {
  it("Gerente obtiene respuesta contractual y no-store", async () => {
    const r = await llamar(); expect(r.status).toBe(200); expect(await r.json()).toEqual(impacto);
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(m.permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "formas_pago:desactivar" } } });
  });
  it.each(["ALUMNO", "PROFESOR", "MESA_ENTRADA"])("rechaza %s sin llamar al dominio", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    const r = await llamar(); expect(r.status).toBe(403); expect(await r.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(m.servicio).not.toHaveBeenCalled();
  });
  it("sin sesión devuelve 401", async () => {
    m.sesion.actual = null; expect((await llamar()).status).toBe(401); expect(m.servicio).not.toHaveBeenCalled();
  });
  it.each([
    ["errores.formaPago.noEncontrada", 404, "FORMA_PAGO_NO_ENCONTRADA"],
    ["errores.transaccion.ocupada", 409, "TRANSACCION_OCUPADA"],
  ] as const)("mapea %s", async (clave, status, code) => {
    m.servicio.mockRejectedValue(new ErrorDeDominio(clave));
    const r = await llamar(); expect(r.status).toBe(status); expect(await r.json()).toMatchObject({ data: null, error: { code } });
  });
});
