import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// HU-I-05 (spec_modulo_I.md §2.15): contrato de GET /api/mis-pagos. La sesión
// y el permiso pasan por el wrapper real (`withPermission`) con la base simulada.

const m = vi.hoisted(() => ({
  servicio: vi.fn(), permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/pago.service", () => ({ listarMisPagos: m.servicio }));
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
const pedir = (query = "") => GET(new NextRequest(`http://localhost/api/mis-pagos${query ? `?${query}` : ""}`), { params: Promise.resolve({}) });
const DATA = { total_pagado: "0.00", items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 } };

beforeEach(() => {
  vi.resetAllMocks();
  m.sesion.actual = { user: { id: "usuario-A", rol: "ALUMNO" } };
  m.permiso.mockResolvedValue({});
  m.servicio.mockResolvedValue(DATA);
});

describe("GET /api/mis-pagos (HU-I-05)", () => {
  it("alumno: 200 con el sobre estándar, no-store e identidad tomada de la sesión", async () => {
    const r = await pedir("desde=2026-10-01&hasta=2026-10-31&materia_id=m1&pagina=2");
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toMatch(/^no-store/);
    expect(await r.json()).toEqual({ data: DATA, error: null });
    expect(m.permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "ALUMNO", accionPermiso: "pagos:leer_propios" } } });
    expect(m.servicio).toHaveBeenCalledWith("usuario-A", {
      desde: new Date("2026-10-01T00:00:00.000Z"), hasta: new Date("2026-10-31T00:00:00.000Z"), materia_id: "m1", pagina: 2,
    });
  });

  it.each([
    "alumno_id=c123456789012345678901234", "forma_pago_id=formapago-efectivo", "estado_pago=PAGADA", "por_pagina=50", "x=1",
    "desde=2026-02-31", "desde=2026-10-15&hasta=2026-10-14", "pagina=0", "pagina=1.5", "pagina=abc", "desde=", "materia_id=",
  ])("400 VALIDACION con flatten y sin consultar: %s", async (query) => {
    const r = await pedir(query);
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body).toMatchObject({ data: null, error: { code: "VALIDACION", detalles: { formErrors: expect.any(Array), fieldErrors: expect.any(Object) } } });
    expect(m.servicio).not.toHaveBeenCalled();
  });

  it("401 sin sesión", async () => {
    m.sesion.actual = null;
    expect((await pedir()).status).toBe(401);
    expect(m.servicio).not.toHaveBeenCalled();
  });

  it.each(["MESA_ENTRADA", "GERENTE", "PROFESOR"])("%s sin pagos:leer_propios → 403 SIN_PERMISO antes de validar o consultar", async (rol) => {
    m.sesion.actual = { user: { id: "u", rol } };
    m.permiso.mockResolvedValue(null);
    const r = await pedir("alumno_id=c123456789012345678901234");
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(m.servicio).not.toHaveBeenCalled();
  });

  it("cuenta de alumno sin ficha → 404 ALUMNO_NO_ENCONTRADO", async () => {
    m.servicio.mockRejectedValue(new ErrorDeDominio("errores.alumno.noEncontrado"));
    const r = await pedir();
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "ALUMNO_NO_ENCONTRADO" } });
  });
});
