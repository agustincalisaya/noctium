import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// GET /api/reservas/vencidas (HU-C-26, spec_modulo_C.md §2.20.3). Con el
// withPermission real: la sesión y los permisos salen de mocks de `auth` y de
// `prisma` (solo MESA_ENTRADA tiene `reservas:leer`); la lectura de C está simulada.

const m = vi.hoisted(() => ({
  servicio: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/turnos/inscripcion.publico", () => ({ listarReservasVencidas: m.servicio }));
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
  const r = await (GET as unknown as Ruta)(new NextRequest(`http://localhost/api/reservas/vencidas${query}`), { params: Promise.resolve({}) });
  return { status: r.status, cuerpo: await r.json() };
}

describe("GET /api/reservas/vencidas (criterios 3, 4 y 8)", () => {
  it("con alumno y materia: los pasa a la lectura, sin `vencen`", async () => {
    m.servicio.mockResolvedValue(LISTADO);
    await expect(get(`?alumno=30111&materia_id=${MATERIA}`)).resolves.toEqual({ status: 200, cuerpo: { data: LISTADO, error: null } });
    expect(m.servicio).toHaveBeenCalledExactlyOnceWith({ alumno: "30111", materiaId: MATERIA, pagina: 1 });
  });

  it("400 VALIDATION_ERROR con `vencen` (solo existe en Pendientes)", async () => {
    const r = await get("?vencen=hoy");
    expect(r.status).toBe(400);
    expect(r.cuerpo).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR" } });
    expect(m.servicio).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR con materia_id inválido", async () => {
    expect((await get("?materia_id=x")).status).toBe(400);
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
