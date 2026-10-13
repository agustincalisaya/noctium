import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  servicio: vi.fn(), permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/pago.service", () => ({ obtenerOpcionesHistorialPagos: m.servicio }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  rolPermiso: { findUnique: m.permiso },
  usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) },
  tokenRevocado: { findUnique: vi.fn() },
} }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) => handler(Object.assign(req, { auth: m.sesion.actual })),
  decodificarToken: vi.fn(),
}));
const { GET } = await import("./route");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const CUID = "c123456789012345678901234";
const pedir = (query: string) => GET(new NextRequest(`http://localhost/api/pagos/historial/opciones?${query}`), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.resetAllMocks();
  m.sesion.actual = { user: { id: "mesa", rol: "MESA_ENTRADA" } };
  m.permiso.mockResolvedValue({});
  m.servicio.mockResolvedValue({ formas_pago: [], materias: [] });
});

describe("GET /api/pagos/historial/opciones", () => {
  it.each(["MESA_ENTRADA", "GERENTE"])("autoriza %s", async (rol) => {
    m.sesion.actual = { user: { id: "usuario", rol } };
    const r = await pedir(`alumno_id=${CUID}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: { formas_pago: [], materias: [] }, error: null });
    expect(m.servicio).toHaveBeenCalledWith(CUID);
  });
  it("401/403 sin acceso", async () => {
    m.sesion.actual = null;
    expect((await pedir(`alumno_id=${CUID}`)).status).toBe(401);
    m.sesion.actual = { user: { id: "alumno", rol: "ALUMNO" } };
    m.permiso.mockResolvedValue(null);
    expect((await pedir(`alumno_id=${CUID}`)).status).toBe(403);
    m.sesion.actual = { user: { id: "profesor", rol: "PROFESOR" } };
    expect((await pedir(`alumno_id=${CUID}`)).status).toBe(403);
  });
  it("400 por query extra y 404 por alumno inexistente", async () => {
    expect((await pedir(`alumno_id=${CUID}&pagina=2`)).status).toBe(400);
    expect(m.servicio).not.toHaveBeenCalled();
    m.servicio.mockRejectedValue(new ErrorDeDominio("errores.alumno.noEncontrado"));
    expect((await pedir(`alumno_id=${CUID}`)).status).toBe(404);
  });
});
