import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { listar, permiso, cookie, sesion } = vi.hoisted(() => ({
  listar: vi.fn(),
  permiso: vi.fn(),
  cookie: vi.fn(),
  sesion: { actual: { user: { id: "usuario-1", rol: "ALUMNO" } } as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/turnos/turno.service", () => ({ listarTurnosPropios: listar }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso }, tokenRevocado: { findUnique: vi.fn() } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: sesion.actual })),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const consultar = (query = "") => GET(new NextRequest(`http://localhost/api/turnos/propios${query ? `?${query}` : ""}`), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.clearAllMocks();
  sesion.actual = { user: { id: "usuario-1", rol: "ALUMNO" } };
  permiso.mockResolvedValue({});
  listar.mockResolvedValue({ items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 }, totales: { proximos: 0, anteriores: 0 } });
});

describe("GET /api/turnos/propios (HU-C-13)", () => {
  it("exige turnos:leer_propios, aplica los defaults y devuelve los totales", async () => {
    const respuesta = await consultar();

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: {
      items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 },
      totales: { proximos: 0, anteriores: 0 },
    }, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "ALUMNO", accionPermiso: "turnos:leer_propios" } } });
    expect(listar).toHaveBeenCalledExactlyOnceWith({ vista: "proximos", pagina: 1, por_pagina: 10 }, "usuario-1");
  });

  it("pasa los filtros válidos al servicio sin aceptar un alumno_id", async () => {
    const respuesta = await consultar("vista=anteriores&pagina=2&por_pagina=5");

    expect(respuesta.status).toBe(200);
    expect(listar).toHaveBeenCalledExactlyOnceWith({ vista: "anteriores", pagina: 2, por_pagina: 5 }, "usuario-1");
    const invalida = await consultar("alumno_id=alumno-de-otro");
    expect(invalida.status).toBe(400);
    expect(await invalida.json()).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR" } });
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it.each(["vista=otro", "pagina=0", "por_pagina=11", "vista=proximos&inesperado=1"])("rechaza query inválida (%s)", async (query) => {
    const respuesta = await consultar(query);
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR" } });
    expect(listar).not.toHaveBeenCalled();
  });

  it("rechaza a quien no tenga el permiso antes de consultar", async () => {
    permiso.mockResolvedValueOnce(null);
    const respuesta = await consultar();

    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(listar).not.toHaveBeenCalled();
  });

  it("rechaza una sesión ausente con 401", async () => {
    sesion.actual = null;
    const respuesta = await consultar();
    expect(respuesta.status).toBe(401);
    expect(listar).not.toHaveBeenCalled();
  });

  it("traduce una cuenta sin ficha vinculada a 403 SIN_PERMISO", async () => {
    listar.mockRejectedValueOnce(new ServiceError("SIN_PERMISO", "Tu cuenta no tiene una ficha de alumno vinculada"));
    const respuesta = await consultar();
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toEqual({ data: null, error: { code: "SIN_PERMISO", message: "Tu cuenta no tiene una ficha de alumno vinculada" } });
  });
});
