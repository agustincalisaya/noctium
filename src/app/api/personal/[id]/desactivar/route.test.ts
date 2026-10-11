import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// POST /api/personal/[id]/desactivar (spec_modulo_F.md §2.5, HU-F-05). Con el
// withPermission real; el servicio está simulado.

const m = vi.hoisted(() => ({
  desactivar: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/personal/personal.service", () => ({ desactivarIntegrante: m.desactivar }));
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
    new NextRequest(`http://localhost/api/personal/${ID}/desactivar`, {
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
  m.desactivar.mockResolvedValue({ id: ID, activo: false, version: 4 });
});

describe("POST /api/personal/[id]/desactivar", () => {
  it("200 { data: { id, activo, version } }; el servicio recibe el id, el payload validado y al Gerente como actor", async () => {
    expect(await post({ version: 3, motivo: "  Renuncia " })).toEqual({
      status: 200,
      cuerpo: { data: { id: ID, activo: false, version: 4 }, error: null },
      cache: expect.stringContaining("no-store"),
    });
    expect(m.desactivar).toHaveBeenCalledWith(ID, { version: 3, motivo: "Renuncia" }, { tipo: "USUARIO", usuarioId: "gerente" });
    expect(m.permiso).toHaveBeenCalledWith({
      where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "personal:cambiar_estado" } },
    });
  });

  it("sin motivo también llega al servicio (decide si es obligatorio)", async () => {
    expect((await post({ version: 3 })).status).toBe(200);
    expect(m.desactivar).toHaveBeenCalledWith(ID, { version: 3 }, expect.anything());
  });

  it.each([
    ["cuerpo ausente", undefined],
    ["version faltante", { motivo: "Renuncia" }],
    ["campo ajeno", { version: 3, activo: false }],
    ["motivo de 301 caracteres", { version: 3, motivo: "a".repeat(301) }],
  ])("400 VALIDATION_ERROR: %s; no llama al servicio", async (_caso, body) => {
    const r = await post(body);
    expect(r).toMatchObject({ status: 400, cuerpo: { data: null, error: { code: "VALIDATION_ERROR", message: "Los datos del integrante no son válidos." } } });
    expect(m.desactivar).not.toHaveBeenCalled();
  });

  it("400 por motivo largo con el mensaje en detalles", async () => {
    expect((await post({ version: 3, motivo: "a".repeat(301) })).cuerpo.error.detalles).toEqual({ motivo: ["El motivo admite hasta 300 caracteres."] });
  });

  it("401 sin sesión y 403 SIN_PERMISO para Mesa de entrada, Profesor y Alumno", async () => {
    m.sesion.actual = null;
    expect((await post({ version: 3 })).status).toBe(401);
    for (const rol of ["MESA_ENTRADA", "PROFESOR", "ALUMNO"]) {
      m.sesion.actual = { user: { id: "otro", rol } };
      expect(await post({ version: 3 })).toMatchObject({ status: 403, cuerpo: { error: { code: "SIN_PERMISO" } } });
    }
    expect(m.desactivar).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.personal.noEncontrado", 404, "INTEGRANTE_NO_ENCONTRADO"],
    ["errores.personal.yaInactivo", 409, "INTEGRANTE_YA_INACTIVO"],
    ["errores.personal.cajaAbierta", 409, "CAJA_ABIERTA"],
    ["errores.personal.conflictoEdicion", 409, "CONFLICTO_EDICION_CONCURRENTE"],
    ["errores.personal.motivoRequerido", 400, "MOTIVO_REQUERIDO"],
  ] as const)("%s → %i %s con el texto central", async (clave, status, code) => {
    const error = new ErrorDeDominio(clave);
    m.desactivar.mockRejectedValue(error);
    expect(await post({ version: 3 })).toMatchObject({ status, cuerpo: { data: null, error: { code, message: error.message } } });
  });

  it("CAJA_ABIERTA con el literal del backlog", async () => {
    m.desactivar.mockRejectedValue(new ErrorDeDominio("errores.personal.cajaAbierta"));
    expect((await post({ version: 3 })).cuerpo.error.message).toBe(
      "El integrante tiene la caja abierta. Tiene que cerrarla (o hacé un cierre por ausencia) antes de desactivarlo.",
    );
  });

  it("500 sin filtrar el detalle de un error inesperado", async () => {
    m.desactivar.mockRejectedValue(new Error("connection refused"));
    expect(await post({ version: 3 })).toMatchObject({
      status: 500,
      cuerpo: { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
    });
  });
});
