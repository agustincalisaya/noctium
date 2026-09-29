import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { crear, listar, permiso, cookie, sesion } = vi.hoisted(() => ({
  crear: vi.fn(),
  listar: vi.fn(),
  permiso: vi.fn(),
  cookie: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/forma-pago.service", () => ({ crearFormaPago: crear, listarFormasPago: listar }));
vi.mock("@/lib/prisma", () => ({
  prisma: { rolPermiso: { findUnique: permiso }, tokenRevocado: { findUnique: vi.fn() } },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: sesion.actual })),
  decodificarToken: vi.fn(),
}));

const { GET, POST } = await import("./route");

const contexto = { params: Promise.resolve({}) };
const publicar = (cuerpo: unknown) =>
  POST(
    new NextRequest("http://localhost/api/formas-pago", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    }),
    contexto,
  );
const consultar = (query = "") => GET(new NextRequest(`http://localhost/api/formas-pago${query}`), contexto);

const LISTADO = {
  items: [{ id: "fp1", nombre: "Efectivo", is_active: true }],
  paginacion: { total: 1, pagina_actual: 1, total_paginas: 1, por_pagina: 20 },
};

beforeEach(() => {
  vi.clearAllMocks();
  sesion.actual = { user: { id: "usuario-1", rol: "GERENTE" } };
  permiso.mockResolvedValue({});
  crear.mockResolvedValue({ idFormaPago: "fp1", nombreFormaPago: "Efectivo", activaFormaPago: true });
  listar.mockResolvedValue(LISTADO);
});

describe("HU-I-03 POST /api/formas-pago", () => {
  it("exige formas_pago:crear y responde 201 con el sobre { data, error }", async () => {
    const respuesta = await publicar({ nombre: "  Efectivo " });

    expect(respuesta.status).toBe(201);
    expect(await respuesta.json()).toEqual({
      data: { id: "fp1", nombre: "Efectivo", is_active: true },
      error: null,
    });
    expect(permiso).toHaveBeenCalledWith({
      where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "formas_pago:crear" } },
    });
    expect(crear).toHaveBeenCalledExactlyOnceWith({ nombre: "Efectivo" }, "usuario-1");
  });

  it.each([
    ["nombre vacío", { nombre: "" }],
    ["campo extra", { nombre: "Efectivo", numero_tarjeta: "4111" }],
    ["cuerpo que no es JSON", "no es json"],
  ])("responde 400 VALIDACION con detalles (%s) sin llamar al service", async (_caso, cuerpo) => {
    const respuesta = await publicar(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({
      data: null,
      error: { code: "VALIDACION", detalles: expect.any(Object) },
    });
    expect(crear).not.toHaveBeenCalled();
  });

  it("sin sesión responde 401", async () => {
    sesion.actual = null;

    const respuesta = await publicar({ nombre: "Efectivo" });

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SESION_INVALIDA" } });
    expect(crear).not.toHaveBeenCalled();
  });

  it("sin permiso responde 403 sin llamar al service", async () => {
    permiso.mockResolvedValueOnce(null);

    const respuesta = await publicar({ nombre: "Efectivo" });

    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(crear).not.toHaveBeenCalled();
  });

  it("traduce NOMBRE_DUPLICADO a 409", async () => {
    crear.mockRejectedValueOnce(new ServiceError("NOMBRE_DUPLICADO", "Ya existe una forma de pago con ese nombre."));

    const respuesta = await publicar({ nombre: "Efectivo" });

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toEqual({
      data: null,
      error: { code: "NOMBRE_DUPLICADO", message: "Ya existe una forma de pago con ese nombre." },
    });
  });

  it("relanza los errores inesperados", async () => {
    crear.mockRejectedValueOnce(new Error("base caída"));

    await expect(publicar({ nombre: "Efectivo" })).rejects.toThrow("base caída");
  });
});

describe("HU-I-03 GET /api/formas-pago", () => {
  it("exige formas_pago:leer y devuelve el listado paginado con los valores por defecto", async () => {
    const respuesta = await consultar();

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: LISTADO, error: null });
    expect(permiso).toHaveBeenCalledWith({
      where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "formas_pago:leer" } },
    });
    expect(listar).toHaveBeenCalledExactlyOnceWith({ pagina: 1, por_pagina: 20 });
  });

  it("pasa pagina y por_pagina al service", async () => {
    await consultar("?pagina=2&por_pagina=10");

    expect(listar).toHaveBeenCalledExactlyOnceWith({ pagina: 2, por_pagina: 10 });
  });

  it.each([["?pagina=0"], ["?por_pagina=21"], ["?pagina=abc"]])(
    "responde 400 VALIDACION con %s",
    async (query) => {
      const respuesta = await consultar(query);

      expect(respuesta.status).toBe(400);
      expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "VALIDACION" } });
      expect(listar).not.toHaveBeenCalled();
    },
  );

  it("sin sesión responde 401", async () => {
    sesion.actual = null;

    expect((await consultar()).status).toBe(401);
    expect(listar).not.toHaveBeenCalled();
  });

  it("sin permiso responde 403", async () => {
    permiso.mockResolvedValueOnce(null);

    const respuesta = await consultar();

    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(listar).not.toHaveBeenCalled();
  });
});
