import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { leer, permiso, sesion } = vi.hoisted(() => ({
  leer: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/comprobante.lectura", () => ({ leerComprobante: leer }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso }, usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) }, tokenRevocado: { findUnique: vi.fn() } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) => handler(Object.assign(req, { auth: sesion.actual }), ctx),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const pedir = (id: string) => GET(new NextRequest(`http://localhost/api/comprobantes/${id}`), { params: Promise.resolve({ id }) });
const LEIDO = { id: "comp-1", numero: "0001-00000123", marcas: { anulado: null, reemplazado_por: null, reemplaza_a: null } };

beforeEach(() => {
  vi.resetAllMocks();
  sesion.actual = { user: { id: "u1", rol: "MESA_ENTRADA" } };
  permiso.mockResolvedValue({});
  leer.mockResolvedValue(LEIDO);
});

describe("GET /api/comprobantes/[id] (HU-I-11)", () => {
  it.each(["MESA_ENTRADA", "GERENTE"])("%s con comprobantes:leer → 200 con la vista completa", async (rol) => {
    sesion.actual = { user: { id: "u1", rol } };
    const r = await pedir("comp-1");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: LEIDO, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: rol, accionPermiso: "comprobantes:leer" } } });
    expect(leer).toHaveBeenCalledWith(expect.anything(), "comp-1");
  });

  it("Profesor (sin permiso) → 403 SIN_PERMISO sin leer nada", async () => {
    sesion.actual = { user: { id: "p1", rol: "PROFESOR" } };
    permiso.mockResolvedValue(null);
    const r = await pedir("comp-1");
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(leer).not.toHaveBeenCalled();
  });

  it("inexistente → 404 COMPROBANTE_NO_ENCONTRADO", async () => {
    leer.mockResolvedValue(null);
    const r = await pedir("nada");
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "COMPROBANTE_NO_ENCONTRADO" } });
  });
});
