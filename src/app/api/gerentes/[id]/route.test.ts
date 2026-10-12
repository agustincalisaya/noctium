import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// GET y PATCH /api/gerentes/[id] (spec_modulo_G.md §2.2 y §2.4, HU-G-01). Con
// el withPermission real; el servicio está simulado.

const m = vi.hoisted(() => ({
  modificar: vi.fn(),
  detalle: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/gerentes/gerente.service", () => ({ modificarGerente: m.modificar, obtenerDetalleGerente: m.detalle }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));
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
const { GET, PATCH } = await import("./route");

type Ruta = (req: NextRequest, ctx: unknown) => Promise<Response>;
const ID = "ckficha";
const CTX = () => ({ params: Promise.resolve({ id: ID }) });
const DETALLE = {
  id: ID,
  version: 3,
  activo: true,
  nombre: "Marcos",
  apellido: "Ibarra",
  dni: "27111222",
  fechaNacimiento: "1985-03-20",
  genero: "MASCULINO",
  telefono: null,
  email: "marcos@mail.com",
  creadoEl: "2026-10-01T12:00:00.000Z",
  modificadoEl: null,
  cuenta: { estado: "ACTIVA", email: "marcos@mail.com", rol: "GERENTE", debe_cambiar_password: false },
  esVos: true,
};

async function patch(body: unknown) {
  const r = await (PATCH as unknown as Ruta)(
    new NextRequest(`http://localhost/api/gerentes/${ID}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    CTX(),
  );
  return { status: r.status, cuerpo: await r.json(), cache: r.headers.get("cache-control") };
}

async function get() {
  const r = await (GET as unknown as Ruta)(new NextRequest(`http://localhost/api/gerentes/${ID}`), CTX());
  return { status: r.status, cuerpo: await r.json(), cache: r.headers.get("cache-control") };
}

beforeEach(() => {
  vi.resetAllMocks();
  m.sesion.actual = { user: { id: "gerente", rol: "GERENTE" } };
  m.permiso.mockImplementation(async ({ where }) => (where.rolPermiso_accionPermiso.rolPermiso === "GERENTE" ? {} : null));
  m.modificar.mockResolvedValue({ id: ID, campos_modificados: ["telefono", "email"], version: 4 });
  m.detalle.mockResolvedValue(DETALLE);
});

describe("GET /api/gerentes/[id]", () => {
  it("200 con el detalle (version, fechas, cuenta y esVos) y no-store; el servicio recibe al usuario de la sesión", async () => {
    expect(await get()).toEqual({ status: 200, cuerpo: { data: DETALLE, error: null }, cache: expect.stringContaining("no-store") });
    expect(m.detalle).toHaveBeenCalledWith(ID, "gerente");
    expect(m.permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "gerentes:leer" } } });
  });

  it("404 GERENTE_NO_ENCONTRADO", async () => {
    m.detalle.mockRejectedValue(new ErrorDeDominio("errores.gerente.noEncontrado"));
    expect(await get()).toMatchObject({
      status: 404,
      cuerpo: { data: null, error: { code: "GERENTE_NO_ENCONTRADO", message: "El gerente no existe" } },
    });
  });

  it("401 sin sesión y 403 para los otros roles", async () => {
    m.sesion.actual = null;
    expect((await get()).status).toBe(401);
    for (const rol of ["MESA_ENTRADA", "PROFESOR", "ALUMNO"]) {
      m.sesion.actual = { user: { id: "otro", rol } };
      expect((await get()).cuerpo.error.code).toBe("SIN_PERMISO");
    }
    expect(m.detalle).not.toHaveBeenCalled();
  });

  it("500 sin detalle técnico ante un error inesperado", async () => {
    m.detalle.mockRejectedValue(new Error("connection refused"));
    const r = await get();
    expect(r).toMatchObject({ status: 500, cuerpo: { data: null, error: { code: "ERROR_INTERNO" } } });
    expect(JSON.stringify(r.cuerpo)).not.toContain("connection");
  });
});

describe("PATCH /api/gerentes/[id]", () => {
  it("200 con campos_modificados; el servicio recibe el id, el payload validado y al Gerente", async () => {
    const r = await patch({ telefono: null, email: "Nuevo@Mail.com", version: 3 });
    expect(r).toEqual({
      status: 200,
      cuerpo: { data: { id: ID, campos_modificados: ["telefono", "email"], version: 4 }, error: null },
      cache: expect.stringContaining("no-store"),
    });
    expect(m.modificar).toHaveBeenCalledWith(ID, { telefono: null, email: "nuevo@mail.com", version: 3 }, "gerente");
    expect(m.permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "gerentes:editar" } } });
  });

  it("200 sin cambios: campos_modificados vacío", async () => {
    m.modificar.mockResolvedValue({ id: ID, campos_modificados: [], version: 3 });
    expect((await patch({ nombre: "Marcos", version: 3 })).cuerpo).toEqual({ data: { id: ID, campos_modificados: [], version: 3 }, error: null });
  });

  it("401 sin sesión", async () => {
    m.sesion.actual = null;
    expect((await patch({ version: 3 })).status).toBe(401);
  });

  it.each(["MESA_ENTRADA", "PROFESOR", "ALUMNO"])("403 SIN_PERMISO para %s, también con un cuerpo inválido (permiso antes de Zod)", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    expect(await patch({ version: 3 })).toMatchObject({ status: 403, cuerpo: { error: { code: "SIN_PERMISO" } } });
    expect((await patch({ email: "" })).status).toBe(403);
    expect(m.modificar).not.toHaveBeenCalled();
  });

  it.each([
    [{ telefono: null }, "version"],
    [{ email: "", version: 3 }, "email"],
    [{ telefono: "", version: 3 }, "telefono"],
  ])("400 VALIDATION_ERROR: %j (campo %s)", async (body, campo) => {
    const r = await patch(body);
    expect(r.status).toBe(400);
    expect(r.cuerpo.error).toMatchObject({ code: "VALIDATION_ERROR", message: "Los datos del gerente no son válidos." });
    expect(r.cuerpo.error.detalles[campo]).toBeDefined();
    expect(m.modificar).not.toHaveBeenCalled();
  });

  it("400 si trae campos ajenos (.strict())", async () => {
    expect((await patch({ activo: false, version: 3 })).status).toBe(400);
  });

  it.each([
    ["errores.gerente.noEncontrado", 404, "GERENTE_NO_ENCONTRADO"],
    ["errores.gerente.dniDuplicado", 409, "DNI_DUPLICADO"],
    ["errores.cuenta.emailYaAsociado", 409, "EMAIL_YA_ASOCIADO"],
    ["errores.gerente.conflictoEdicion", 409, "CONFLICTO_EDICION_CONCURRENTE"],
  ] as const)("%s → %i %s", async (clave, status, code) => {
    m.modificar.mockRejectedValue(new ErrorDeDominio(clave));
    expect(await patch({ dni: "40111222", version: 3 })).toMatchObject({ status, cuerpo: { data: null, error: { code } } });
  });
});
