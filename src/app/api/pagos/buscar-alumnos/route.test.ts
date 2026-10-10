import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { buscar, permiso, sesion } = vi.hoisted(() => ({
  buscar: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/pago.service", () => ({ buscarAlumnosParaCobro: buscar }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso }, tokenRevocado: { findUnique: vi.fn() } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) => handler(Object.assign(req, { auth: sesion.actual })),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const consultar = (query: string) => GET(new NextRequest(`http://localhost/api/pagos/buscar-alumnos${query}`), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.resetAllMocks();
  sesion.actual = { user: { id: "u1", rol: "MESA_ENTRADA" } };
  permiso.mockResolvedValue({});
  buscar.mockResolvedValue([{ id: "a1", nombre: "Ana", apellido: "Pérez", dni: "40100001" }]);
});

describe("GET /api/pagos/buscar-alumnos (HU-I-10)", () => {
  it("200 con los alumnos activos, sin datos de contacto", async () => {
    const r = await consultar("?q=an");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: [{ id: "a1", nombre: "Ana", apellido: "Pérez", dni: "40100001" }], error: null });
    expect(buscar).toHaveBeenCalledWith("an");
  });
  it.each(["?q=a", "", "?q=ana&pagina=2"])("400 VALIDACION (%s)", async (query) => {
    const r = await consultar(query);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "VALIDACION" } });
    expect(buscar).not.toHaveBeenCalled();
  });
  it("Gerente → 403 SIN_PERMISO", async () => {
    sesion.actual = { user: { id: "g1", rol: "GERENTE" } };
    permiso.mockResolvedValue(null);
    expect((await consultar("?q=ana")).status).toBe(403);
    expect(buscar).not.toHaveBeenCalled();
  });
});
