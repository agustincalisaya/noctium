import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { historial, permiso, sesion } = vi.hoisted(() => ({
  historial: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/correccion.lecturas", () => ({ obtenerHistorialDePago: historial }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso }, usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) }, tokenRevocado: { findUnique: vi.fn() } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) => handler(Object.assign(req, { auth: sesion.actual }), ctx),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const consultar = () => GET(new NextRequest("http://localhost/api/pagos/p1/historial"), { params: Promise.resolve({ id: "p1" }) });
const DATA = { registro: { monto: "24000.00" }, cambios: [] };

beforeEach(() => {
  vi.resetAllMocks();
  sesion.actual = { user: { id: "u1", rol: "MESA_ENTRADA" } };
  permiso.mockResolvedValue({});
  historial.mockResolvedValue(DATA);
});

describe("GET /api/pagos/[id]/historial (HU-I-06, DEC-27)", () => {
  it("200 con pagos:leer, sin caché", async () => {
    const r = await consultar();
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toMatch(/^no-store/);
    expect(await r.json()).toEqual({ data: DATA, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADA", accionPermiso: "pagos:leer" } } });
    expect(historial).toHaveBeenCalledWith("p1");
  });

  it("rol sin pagos:leer (Alumno, Profesor) → 403 SIN_PERMISO", async () => {
    sesion.actual = { user: { id: "a", rol: "ALUMNO" } };
    permiso.mockResolvedValue(null);
    const r = await consultar();
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(historial).not.toHaveBeenCalled();
  });

  it("404 PAGO_NO_ENCONTRADO", async () => {
    historial.mockRejectedValue(new ErrorDeDominio("errores.pago.noEncontrado"));
    const r = await consultar();
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "PAGO_NO_ENCONTRADO" } });
  });
});
