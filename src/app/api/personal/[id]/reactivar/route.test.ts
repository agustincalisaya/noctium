import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// POST /api/personal/[id]/reactivar (spec_modulo_F.md §2.6, HU-F-05). Con el
// withPermission real; el servicio está simulado.

const m = vi.hoisted(() => ({
  reactivar: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/personal/personal.service", () => ({ reactivarIntegrante: m.reactivar }));
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
const ID = "ckficha";

async function post(body?: unknown) {
  const r = await (POST as unknown as Ruta)(
    new NextRequest(`http://localhost/api/personal/${ID}/reactivar`, {
      method: "POST",
      ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    }),
    { params: Promise.resolve({ id: ID }) },
  );
  return { status: r.status, cuerpo: await r.json(), cache: r.headers.get("cache-control") };
}

beforeEach(() => {
  vi.resetAllMocks();
  m.sesion.actual = { user: { id: "gerente", rol: "GERENTE" } };
  m.permiso.mockImplementation(async ({ where }) => (where.rolPermiso_accionPermiso.rolPermiso === "GERENTE" ? {} : null));
  m.reactivar.mockResolvedValue({ id: ID, activo: true, version: 5 });
});

describe("POST /api/personal/[id]/reactivar", () => {
  it("200 { data: { id, activo, version } }; el servicio recibe el id, la version y al Gerente como actor", async () => {
    expect(await post({ version: 4 })).toEqual({
      status: 200,
      cuerpo: { data: { id: ID, activo: true, version: 5 }, error: null },
      cache: expect.stringContaining("no-store"),
    });
    expect(m.reactivar).toHaveBeenCalledWith(ID, { version: 4 }, { tipo: "USUARIO", usuarioId: "gerente" });
    expect(m.permiso).toHaveBeenCalledWith({
      where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "personal:cambiar_estado" } },
    });
  });

  it.each([
    ["cuerpo ausente", undefined],
    ["version faltante", {}],
    ["motivo (no lo pide)", { version: 4, motivo: "Vuelve" }],
    ["campo ajeno", { version: 4, activo: true }],
  ])("400 VALIDATION_ERROR: %s; no llama al servicio", async (_caso, body) => {
    expect(await post(body)).toMatchObject({ status: 400, cuerpo: { data: null, error: { code: "VALIDATION_ERROR" } } });
    expect(m.reactivar).not.toHaveBeenCalled();
  });

  it("401 sin sesión y 403 SIN_PERMISO para Mesa de entrada, Profesor y Alumno", async () => {
    m.sesion.actual = null;
    expect((await post({ version: 4 })).status).toBe(401);
    for (const rol of ["MESA_ENTRADA", "PROFESOR", "ALUMNO"]) {
      m.sesion.actual = { user: { id: "otro", rol } };
      expect(await post({ version: 4 })).toMatchObject({ status: 403, cuerpo: { error: { code: "SIN_PERMISO" } } });
    }
    expect(m.reactivar).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.personal.noEncontrado", 404, "INTEGRANTE_NO_ENCONTRADO"],
    ["errores.personal.yaActivo", 409, "INTEGRANTE_YA_ACTIVO"],
    ["errores.personal.conflictoEdicion", 409, "CONFLICTO_EDICION_CONCURRENTE"],
  ] as const)("%s → %i %s con el texto central", async (clave, status, code) => {
    const error = new ErrorDeDominio(clave);
    m.reactivar.mockRejectedValue(error);
    expect(await post({ version: 4 })).toMatchObject({ status, cuerpo: { data: null, error: { code, message: error.message } } });
  });

  it("500 sin filtrar el detalle de un error inesperado", async () => {
    m.reactivar.mockRejectedValue(new Error("connection refused"));
    expect(await post({ version: 4 })).toMatchObject({ status: 500, cuerpo: { error: { code: "ERROR_INTERNO" } } });
  });
});
