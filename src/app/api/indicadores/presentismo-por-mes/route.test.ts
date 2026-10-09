import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { obtener, permiso, cookie, sesion } = vi.hoisted(() => ({
  obtener: vi.fn(),
  permiso: vi.fn(),
  cookie: vi.fn(),
  sesion: { actual: { user: { id: "gerente-1", rol: "GERENTE" } } as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/indicadores/presentismo.service", () => ({ obtenerPresentismoPorMes: obtener }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: sesion.actual })),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const consultar = (query = "") =>
  GET(new NextRequest(`http://localhost/api/indicadores/presentismo-por-mes${query ? `?${query}` : ""}`), { params: Promise.resolve({}) });
const datos = { meses: [{ mes: "2026-05", inscriptos: 4, presentes: 3, ausentes: 1, indice: 75 }], resumen: { inscriptos: 4, presentes: 3, ausentes: 1, indice: 75 }, clases_sin_control: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  sesion.actual = { user: { id: "gerente-1", rol: "GERENTE" } };
  permiso.mockResolvedValue({});
  obtener.mockResolvedValue(datos);
});

describe("GET /api/indicadores/presentismo-por-mes", () => {
  it("exige indicadores:leer y devuelve el contrato estándar", async () => {
    const respuesta = await consultar();

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: datos, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "indicadores:leer" } } });
    expect(obtener).toHaveBeenCalledExactlyOnceWith({ desde: undefined, hasta: undefined });
  });

  it("pasa el rango solicitado al servicio", async () => {
    await consultar("desde=2026-05&hasta=2026-08");
    expect(obtener).toHaveBeenCalledExactlyOnceWith({ desde: "2026-05", hasta: "2026-08" });
  });

  it.each([
    ["desde=2026-13", "Formato de mes inválido (AAAA-MM)"],
    ["desde=2026-10&hasta=2026-09", "El mes desde no puede ser posterior al mes hasta"],
    ["desde=2024-09&hasta=2026-09", "El rango máximo es de 24 meses"],
  ])("rechaza %s con 400 VALIDATION_ERROR", async (query, mensaje) => {
    const respuesta = await consultar(query);
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos" } });
    expect(Object.values(cuerpo.error.detalles.fieldErrors).flat()).toContain(mensaje);
    expect(obtener).not.toHaveBeenCalled();
  });

  it("responde 401 si no hay sesión y no consulta permisos", async () => {
    sesion.actual = null;

    const respuesta = await consultar();

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SESION_INVALIDA" } });
    expect(permiso).not.toHaveBeenCalled();
    expect(obtener).not.toHaveBeenCalled();
  });

  it.each(["MESA_ENTRADA", "PROFESOR", "ALUMNO"])("responde 403 para %s y no consulta el servicio", async (rol) => {
    sesion.actual = { user: { id: "mesa-1", rol } };
    permiso.mockResolvedValueOnce(null);
    const respuesta = await consultar();
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(obtener).not.toHaveBeenCalled();
  });
});
