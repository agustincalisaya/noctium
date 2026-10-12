import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { leer, delPago, permiso, sesion } = vi.hoisted(() => ({
  leer: vi.fn(),
  delPago: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/comprobante.lectura", () => ({ leerComprobante: leer, comprobanteDelPago: delPago }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso }, usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) }, tokenRevocado: { findUnique: vi.fn() } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) => handler(Object.assign(req, { auth: sesion.actual }), ctx),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const pedir = (id: string) => GET(new NextRequest(`http://localhost/api/pagos/${id}/comprobante`), { params: Promise.resolve({ id }) });
const LEIDO = { id: "comp-1", numero: "0001-00000123" };

beforeEach(() => {
  vi.resetAllMocks();
  sesion.actual = { user: { id: "u1", rol: "MESA_ENTRADA" } };
  permiso.mockResolvedValue({});
  delPago.mockResolvedValue({ id: "comp-1", numero: "0001-00000123" });
  leer.mockResolvedValue(LEIDO);
});

describe("GET /api/pagos/[id]/comprobante (HU-I-11)", () => {
  it("200: resuelve el comprobante del pago y devuelve la vista completa", async () => {
    const r = await pedir("pago-1");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: LEIDO, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADA", accionPermiso: "comprobantes:leer" } } });
    expect(delPago).toHaveBeenCalledWith(expect.anything(), "pago-1");
    expect(leer).toHaveBeenCalledWith(expect.anything(), "comp-1");
  });

  it("pago inexistente → 404 PAGO_NO_ENCONTRADO", async () => {
    delPago.mockRejectedValue(new ErrorDeDominio("errores.pago.noEncontrado"));
    const r = await pedir("nada");
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "PAGO_NO_ENCONTRADO" } });
    expect(leer).not.toHaveBeenCalled();
  });

  it("pago sin comprobante (inconsistencia) → se relanza como error de servidor", async () => {
    delPago.mockRejectedValue(new Error("El pago pago-1 no tiene comprobante"));
    await expect(pedir("pago-1")).rejects.toThrow("no tiene comprobante");
  });

  it("Profesor → 403 SIN_PERMISO", async () => {
    sesion.actual = { user: { id: "p1", rol: "PROFESOR" } };
    permiso.mockResolvedValue(null);
    const r = await pedir("pago-1");
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ error: { code: "SIN_PERMISO" } });
    expect(delPago).not.toHaveBeenCalled();
  });
});
