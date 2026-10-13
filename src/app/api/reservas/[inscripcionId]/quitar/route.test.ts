import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// POST /api/reservas/[inscripcionId]/quitar (HU-C-26, spec_modulo_C.md
// §2.20.4). Con el withPermission real: la sesión y los permisos salen de
// mocks de `auth` y de `prisma` (solo MESA_ENTRADA tiene
// `turnos:asignar_participantes`); el servicio está simulado.

const m = vi.hoisted(() => ({
  servicio: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/turnos/reserva.pendiente.service", () => ({ quitarReservaPendiente: m.servicio }));
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

import { ErrorDeDominio } from "@/server/shared/error-dominio";
const { POST } = await import("./route");

type Ruta = (req: NextRequest, ctx: unknown) => Promise<Response>;

beforeEach(() => {
  vi.clearAllMocks();
  m.sesion.actual = { user: { id: "mesa", rol: "MESA_ENTRADA" } };
  m.permiso.mockImplementation(async ({ where }) =>
    (where.rolPermiso_accionPermiso.rolPermiso === "MESA_ENTRADA" && where.rolPermiso_accionPermiso.accionPermiso === "turnos:asignar_participantes" ? {} : null));
});

async function post(inscripcionId = "ins-1") {
  const r = await (POST as unknown as Ruta)(
    new NextRequest(`http://localhost/api/reservas/${inscripcionId}/quitar`, { method: "POST" }),
    { params: Promise.resolve({ inscripcionId }) },
  );
  return { status: r.status, cuerpo: await r.json() };
}

describe("POST /api/reservas/[inscripcionId]/quitar (criterios 6 y 8)", () => {
  it("200 con el contrato de §2.20.4, quitando como el usuario de la sesión", async () => {
    const data = { inscripcion_id: "ins-1", vigencia: "QUITADA_CENTRO", alumnos_inscriptos: "3/5", estado: "DISPONIBLE" };
    m.servicio.mockResolvedValue(data);
    await expect(post()).resolves.toEqual({ status: 200, cuerpo: { data, error: null } });
    expect(m.servicio).toHaveBeenCalledExactlyOnceWith("ins-1", "mesa");
  });

  it("409 RESERVA_NO_PENDIENTE con el texto literal del criterio 6", async () => {
    m.servicio.mockRejectedValue(new ErrorDeDominio("errores.reserva.noPendiente"));
    await expect(post()).resolves.toEqual({
      status: 409,
      cuerpo: { data: null, error: { code: "RESERVA_NO_PENDIENTE", message: "Esta reserva ya no está pendiente: se pagó o venció." } },
    });
  });

  it("404 INSCRIPCION_NO_ENCONTRADA", async () => {
    m.servicio.mockRejectedValue(new ErrorDeDominio("errores.inscripcion.noEncontrada"));
    const r = await post("no-existe");
    expect(r.status).toBe(404);
    expect(r.cuerpo).toMatchObject({ data: null, error: { code: "INSCRIPCION_NO_ENCONTRADA" } });
  });

  it.each(["GERENTE", "PROFESOR", "ALUMNO"])("403 SIN_PERMISO para %s, sin llamar al servicio", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    const r = await post();
    expect(r.status).toBe(403);
    expect(r.cuerpo).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(m.servicio).not.toHaveBeenCalled();
  });
});
