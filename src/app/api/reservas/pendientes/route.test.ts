import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// GET /api/reservas/pendientes (HU-C-26, spec_modulo_C.md §2.20.2). Con el
// withPermission real: la sesión y los permisos salen de mocks de `auth` y de
// `prisma` (solo MESA_ENTRADA tiene `reservas:leer`); la lectura de C está simulada.

const m = vi.hoisted(() => ({
  servicio: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/turnos/inscripcion.publico", () => ({ listarReservasPendientes: m.servicio }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rolPermiso: { findUnique: m.permiso },
    usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) },
    tokenRevocado: { findUnique: vi.fn() },
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) =>
    handler(Object.assign(req, { auth: m.sesion.actual }), ctx),
  decodificarToken: vi.fn(),
  obtenerIp: () => "10.0.0.1",
}));

const { GET } = await import("./route");

type Ruta = (req: NextRequest, ctx: unknown) => Promise<Response>;
const MATERIA = "clh3am8f00000qzrmn831i7rn";
const LISTADO = { items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 1, por_pagina: 10 } };

beforeEach(() => {
  vi.clearAllMocks();
  m.sesion.actual = { user: { id: "mesa", rol: "MESA_ENTRADA" } };
  m.permiso.mockImplementation(async ({ where }) =>
    (where.rolPermiso_accionPermiso.rolPermiso === "MESA_ENTRADA" && where.rolPermiso_accionPermiso.accionPermiso === "reservas:leer" ? {} : null));
});

async function get(query = "") {
  const r = await (GET as unknown as Ruta)(new NextRequest(`http://localhost/api/reservas/pendientes${query}`), { params: Promise.resolve({}) });
  return { status: r.status, cuerpo: await r.json() };
}

describe("GET /api/reservas/pendientes (criterios 2, 4 y 8)", () => {
  it("sin filtros: página 1 y responde el listado tal cual", async () => {
    m.servicio.mockResolvedValue(LISTADO);
    await expect(get()).resolves.toEqual({ status: 200, cuerpo: { data: LISTADO, error: null } });
    expect(m.servicio).toHaveBeenCalledExactlyOnceWith({ pagina: 1 });
  });

  it("combina los filtros y traduce materia_id → materiaId", async () => {
    m.servicio.mockResolvedValue(LISTADO);
    expect((await get(`?alumno=%20Ruiz%20&materia_id=${MATERIA}&vencen=en_3_horas&pagina=2`)).status).toBe(200);
    expect(m.servicio).toHaveBeenCalledExactlyOnceWith({ alumno: "Ruiz", materiaId: MATERIA, vencen: "en_3_horas", pagina: 2 });
  });

  it.each([
    ["materia_id no CUID", "?materia_id=no-es-cuid"],
    ["vencen fuera del enum", "?vencen=semana"],
    ["pagina no positiva", "?pagina=0"],
    ["por_pagina (fijo en 10)", "?por_pagina=50"],
    ["un parámetro ajeno", "?tab=pendientes"],
  ])("400 VALIDATION_ERROR con %s, sin llamar a la lectura", async (_caso, query) => {
    const r = await get(query);
    expect(r.status).toBe(400);
    expect(r.cuerpo).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR", message: "Los filtros de reservas no son válidos.", detalles: expect.any(Object) } });
    expect(m.servicio).not.toHaveBeenCalled();
  });

  it.each(["GERENTE", "PROFESOR", "ALUMNO"])("403 SIN_PERMISO para %s (criterio 8)", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    const r = await get();
    expect(r.status).toBe(403);
    expect(r.cuerpo).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(m.servicio).not.toHaveBeenCalled();
  });
});
