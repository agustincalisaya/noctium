import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  servicio: vi.fn(), permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/pago.service", () => ({ listarHistorialDePagos: m.servicio }));
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
const CUID = "c123456789012345678901234";
const pedir = (query: string) => GET(new NextRequest(`http://localhost/api/pagos/historial?${query}`), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.resetAllMocks();
  m.sesion.actual = { user: { id: "mesa", rol: "MESA_ENTRADA" } };
  m.permiso.mockResolvedValue({});
  m.servicio.mockResolvedValue({ modo: "HISTORIAL", items: [], total_pagado: "0.00", paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 } });
});

describe("GET /api/pagos/historial", () => {
  it.each(["MESA_ENTRADA", "GERENTE"])("autoriza %s", async (rol) => {
    m.sesion.actual = { user: { id: "usuario", rol } };
    const r = await pedir(`alumno_id=${CUID}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ data: { modo: "HISTORIAL" }, error: null });
    expect(m.permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: rol, accionPermiso: "pagos:leer" } } });
  });
  it("401 sin sesión y 403 sin permiso", async () => {
    m.sesion.actual = null;
    expect((await pedir(`alumno_id=${CUID}`)).status).toBe(401);
    m.sesion.actual = { user: { id: "alumno", rol: "ALUMNO" } };
    m.permiso.mockResolvedValue(null);
    expect((await pedir(`alumno_id=${CUID}`)).status).toBe(403);
    m.sesion.actual = { user: { id: "profesor", rol: "PROFESOR" } };
    expect((await pedir(`alumno_id=${CUID}`)).status).toBe(403);
    expect(m.servicio).not.toHaveBeenCalled();
  });
  it("400 antes de servicio para query inválida", async () => {
    const r = await pedir(`alumno_id=${CUID}&estado_pago=PAGADA&materia_id=m1`);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "VALIDACION" } });
    expect(m.servicio).not.toHaveBeenCalled();
  });
  it("404 por alumno inexistente", async () => {
    m.servicio.mockRejectedValue(new ErrorDeDominio("errores.alumno.noEncontrado"));
    const r = await pedir(`alumno_id=${CUID}`);
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "ALUMNO_NO_ENCONTRADO" } });
  });
  it("envía el modo estado y la página al servicio", async () => {
    m.servicio.mockResolvedValue({ modo: "ESTADO_DE_PAGO", items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 } });
    const r = await pedir(`alumno_id=${CUID}&estado_pago=RESERVADA&pagina=2`);
    expect(r.status).toBe(200);
    expect(m.servicio).toHaveBeenCalledWith(expect.objectContaining({ estado_pago: "RESERVADA", pagina: 2 }), { id: "mesa", rol: "MESA_ENTRADA", puedeCrearPago: true });
    expect((await r.json()).data).not.toHaveProperty("total_pagado");
  });
});
