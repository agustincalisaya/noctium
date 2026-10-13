import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// GET /api/reservas/resumen (HU-C-26, spec_modulo_C.md §2.20.1). Con el
// withPermission real: la sesión y los permisos salen de mocks de `auth` y de
// `prisma` (permisos del seed: solo MESA_ENTRADA tiene `reservas:leer`); la
// lectura de C está simulada.

const m = vi.hoisted(() => ({
  servicio: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/turnos/inscripcion.publico", () => ({ resumenReservas: m.servicio }));
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
const RESUMEN = { pendientes: { cantidad: 84, importe_total: 1134000 }, vencen_en_3_horas: 6, vencen_hoy: 3, vencieron_hoy: 22 };

beforeEach(() => {
  vi.clearAllMocks();
  m.sesion.actual = { user: { id: "mesa", rol: "MESA_ENTRADA" } };
  m.permiso.mockImplementation(async ({ where }) =>
    (where.rolPermiso_accionPermiso.rolPermiso === "MESA_ENTRADA" && where.rolPermiso_accionPermiso.accionPermiso === "reservas:leer" ? {} : null));
});

async function get() {
  const r = await (GET as unknown as Ruta)(new NextRequest("http://localhost/api/reservas/resumen"), { params: Promise.resolve({}) });
  return { status: r.status, cuerpo: await r.json() };
}

describe("GET /api/reservas/resumen (criterios 1, 7 y 8)", () => {
  it("200 con los cuatro totales de resumenReservas()", async () => {
    m.servicio.mockResolvedValue(RESUMEN);
    await expect(get()).resolves.toEqual({ status: 200, cuerpo: { data: RESUMEN, error: null } });
    expect(m.servicio).toHaveBeenCalledOnce();
  });

  it("401 sin sesión, sin llamar a la lectura", async () => {
    m.sesion.actual = null;
    expect((await get()).status).toBe(401);
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
