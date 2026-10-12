import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// POST y GET /api/gerentes (spec_modulo_G.md §2.1 y §2.3, HU-G-01). Con el
// withPermission real: la sesión y los permisos salen de mocks de `auth` y de
// `prisma`; el servicio está simulado.

const m = vi.hoisted(() => ({
  crear: vi.fn(),
  listar: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/gerentes/gerente.service", () => ({ crearGerente: m.crear, listarGerentes: m.listar }));
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
const { GET, POST } = await import("./route");

type Ruta = (req: NextRequest, ctx: unknown) => Promise<Response>;
const CTX = { params: Promise.resolve({}) };
const ALTA = { nombre: "Marcos", apellido: "Ibarra", dni: "27111222", fechaNacimiento: "1985-03-20", email: "marcos@mail.com" };
const CREADO = {
  id: "ckficha",
  nombre: "Marcos",
  apellido: "Ibarra",
  dni: "27111222",
  email: "marcos@mail.com",
  telefono: null,
  activo: true,
  cuenta: { estado: "ACTIVA", email: "marcos@mail.com", rol: "GERENTE", debe_cambiar_password: true },
};

async function post(body: unknown, crudo = false) {
  const r = await (POST as unknown as Ruta)(
    new NextRequest("http://localhost/api/gerentes", {
      method: "POST",
      body: crudo ? (body as string) : JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    CTX,
  );
  return { status: r.status, cuerpo: await r.json(), cache: r.headers.get("cache-control") };
}

async function get(query = "") {
  const r = await (GET as unknown as Ruta)(new NextRequest(`http://localhost/api/gerentes${query}`), CTX);
  return { status: r.status, cuerpo: await r.json(), cache: r.headers.get("cache-control") };
}

beforeEach(() => {
  vi.resetAllMocks();
  m.sesion.actual = { user: { id: "gerente", rol: "GERENTE" } };
  m.permiso.mockImplementation(async ({ where }) => (where.rolPermiso_accionPermiso.rolPermiso === "GERENTE" ? {} : null));
  m.crear.mockResolvedValue(CREADO);
  m.listar.mockResolvedValue({ items: [], total: 0 });
});

describe("POST /api/gerentes", () => {
  it("201 con la ficha y su cuenta, sin contraseña, no-store; el servicio recibe al Gerente y la IP", async () => {
    const r = await post(ALTA);
    expect(r).toEqual({ status: 201, cuerpo: { data: CREADO, error: null }, cache: expect.stringContaining("no-store") });
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/"(password\w*|hash\w*)":/i);
    expect(m.crear).toHaveBeenCalledWith({ ...ALTA, fechaNacimiento: new Date(Date.UTC(1985, 2, 20)) }, "gerente", "10.0.0.1");
    expect(m.permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "gerentes:crear" } } });
  });

  it("401 sin sesión", async () => {
    m.sesion.actual = null;
    expect((await post(ALTA)).status).toBe(401);
    expect(m.crear).not.toHaveBeenCalled();
  });

  it.each(["MESA_ENTRADA", "PROFESOR", "ALUMNO"])("403 SIN_PERMISO para %s, también con un cuerpo inválido (permiso antes de Zod)", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    const r = await post(ALTA);
    expect(r.status).toBe(403);
    expect(r.cuerpo).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect((await post({ nada: true })).status).toBe(403);
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR con los errores por campo (email faltante con el mensaje del backlog)", async () => {
    const r = await post({ ...ALTA, email: undefined });
    expect(r.status).toBe(400);
    expect(r.cuerpo).toEqual({
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Los datos del gerente no son válidos.",
        detalles: { email: ["Ingresá el email: con él se crea la cuenta de acceso"] },
      },
    });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it.each([{ ...ALTA, rol: "MESA_ENTRADA" }, { ...ALTA, activo: false }, { ...ALTA, usuarioId: "ckotra" }])(
    "400 si trae campos ajenos (.strict()): %j",
    async (body) => {
      expect((await post(body)).status).toBe(400);
      expect(m.crear).not.toHaveBeenCalled();
    },
  );

  it("400 con un cuerpo que no es JSON", async () => {
    expect((await post("{no-json", true)).cuerpo.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["errores.gerente.dniDuplicado", 409, "DNI_DUPLICADO", "Ya existe un gerente registrado con ese DNI"],
    ["errores.cuenta.emailYaAsociado", 409, "EMAIL_YA_ASOCIADO", "Ese email ya está asociado a otra cuenta"],
    ["errores.transaccion.ocupada", 409, "TRANSACCION_OCUPADA", "Otra persona está modificando estos datos. Intentá de nuevo."],
  ] as const)("%s → %i %s", async (clave, status, code, message) => {
    m.crear.mockRejectedValue(new ErrorDeDominio(clave));
    expect(await post(ALTA)).toMatchObject({ status, cuerpo: { data: null, error: { code, message } } });
  });

  it("500 sin detalle técnico ante un error inesperado", async () => {
    m.crear.mockRejectedValue(new Error("connection refused"));
    const r = await post(ALTA);
    expect(r).toMatchObject({ status: 500, cuerpo: { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } } });
    expect(JSON.stringify(r.cuerpo)).not.toContain("connection");
  });
});

describe("GET /api/gerentes", () => {
  const LISTADO = {
    items: [{ id: "f1", apellido: "Ibarra", nombre: "Marcos", dni: "27111222", telefono: null, email: "m@x.com", activo: true }],
    total: 1,
  };

  it("200 con el listado mínimo y no-store; el servicio no recibe parámetros", async () => {
    m.listar.mockResolvedValue(LISTADO);
    expect(await get()).toEqual({ status: 200, cuerpo: { data: LISTADO, error: null }, cache: expect.stringContaining("no-store") });
    expect(m.listar).toHaveBeenCalledWith();
    expect(m.permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "gerentes:leer" } } });
  });

  it("401 sin sesión y 403 para los otros roles", async () => {
    m.sesion.actual = null;
    expect((await get()).status).toBe(401);
    for (const rol of ["MESA_ENTRADA", "PROFESOR", "ALUMNO"]) {
      m.sesion.actual = { user: { id: "otro", rol } };
      expect((await get()).status).toBe(403);
    }
    expect(m.listar).not.toHaveBeenCalled();
  });

  it("500 sin detalle técnico ante un error inesperado", async () => {
    m.listar.mockRejectedValue(new Error("connection refused"));
    const r = await get();
    expect(r).toMatchObject({ status: 500, cuerpo: { data: null, error: { code: "ERROR_INTERNO" } } });
  });
});
