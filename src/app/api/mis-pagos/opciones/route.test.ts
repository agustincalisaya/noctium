import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// HU-I-05 (spec_modulo_I.md §2.15): contrato de GET /api/mis-pagos/opciones.

const m = vi.hoisted(() => ({
  servicio: vi.fn(), permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/pago.service", () => ({ obtenerOpcionesMisPagos: m.servicio }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  rolPermiso: { findUnique: m.permiso },
  usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) },
  tokenRevocado: { findUnique: vi.fn() },
} }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler?: (req: NextRequest) => Promise<Response>) => handler
    ? (req: NextRequest) => handler(Object.assign(req, { auth: m.sesion.actual }))
    : Promise.resolve(m.sesion.actual),
  decodificarToken: vi.fn(),
}));
const { GET } = await import("./route");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const pedir = (query = "") => GET(new NextRequest(`http://localhost/api/mis-pagos/opciones${query ? `?${query}` : ""}`), { params: Promise.resolve({}) });
const DATA = { materias: [{ id: "m1", nombre: "Física I" }] };

beforeEach(() => {
  vi.resetAllMocks();
  m.sesion.actual = { user: { id: "usuario-A", rol: "ALUMNO" } };
  m.permiso.mockResolvedValue({});
  m.servicio.mockResolvedValue(DATA);
});

describe("GET /api/mis-pagos/opciones (HU-I-05)", () => {
  it("alumno: 200 { data: { materias } }, no-store, usuario de la sesión", async () => {
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toMatch(/^no-store/);
    expect(await r.json()).toEqual({ data: DATA, error: null });
    expect(m.servicio).toHaveBeenCalledWith("usuario-A");
    expect(m.permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "ALUMNO", accionPermiso: "pagos:leer_propios" } } });
  });
  it.each(["alumno_id=c123456789012345678901234", "pagina=1", "materia_id=m1"])("query no vacía → 400 VALIDACION: %s", async (query) => {
    const r = await pedir(query);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "VALIDACION", detalles: expect.any(Object) } });
    expect(m.servicio).not.toHaveBeenCalled();
  });
  it("401 sin sesión; 403 SIN_PERMISO para roles sin el permiso propio", async () => {
    m.sesion.actual = null;
    expect((await pedir()).status).toBe(401);
    for (const rol of ["MESA_ENTRADA", "GERENTE", "PROFESOR"]) {
      m.sesion.actual = { user: { id: "u", rol } };
      m.permiso.mockResolvedValue(null);
      const r = await pedir();
      expect(r.status).toBe(403);
      expect(await r.json()).toMatchObject({ error: { code: "SIN_PERMISO" } });
    }
    expect(m.servicio).not.toHaveBeenCalled();
  });
  it("cuenta sin ficha → 404 ALUMNO_NO_ENCONTRADO", async () => {
    m.servicio.mockRejectedValue(new ErrorDeDominio("errores.alumno.noEncontrado"));
    const r = await pedir();
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ error: { code: "ALUMNO_NO_ENCONTRADO" } });
  });
});
