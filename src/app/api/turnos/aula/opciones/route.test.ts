import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { listar, permiso, cookie } = vi.hoisted(() => ({ listar: vi.fn(), permiso: vi.fn(), cookie: vi.fn() }));
vi.mock("@/server/turnos/turno.aula.service", () => ({ listarOpcionesAulaTurno: listar }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: { user: { id: "usuario", rol: "MESA_ENTRADAS" } } })),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const TURNO = "ckturno00000000000000001";
const consultar = (query = `turno_id=${TURNO}`) => GET(new NextRequest(`http://localhost/api/turnos/aula/opciones?${query}`), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({});
  listar.mockResolvedValue([{ id: "aula-1", nombre: "Aula 1", capacidad: 30 }]);
});

describe("HU-C-16 GET /api/turnos/aula/opciones", () => {
  it("exige turnos:asignar_aula y devuelve el array de opciones", async () => {
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: [{ id: "aula-1", nombre: "Aula 1", capacidad: 30 }], error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADAS", accionPermiso: "turnos:asignar_aula" } } });
    expect(listar).toHaveBeenCalledExactlyOnceWith(TURNO);
  });

  it("conserva el modo contractual sin turno_id", async () => {
    const respuesta = await consultar("");
    expect(respuesta.status).toBe(200);
    expect(listar).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("una lista sin aulas elegibles responde 200 con data: []", async () => {
    listar.mockResolvedValueOnce([]);
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: [], error: null });
  });

  it("sin permiso responde 403 sin consultar opciones", async () => {
    permiso.mockResolvedValueOnce(null);
    const respuesta = await consultar();
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(listar).not.toHaveBeenCalled();
  });

  it.each([
    ["TURNO_NO_ENCONTRADO", 404],
    ["SIN_AULAS_ACTIVAS", 404],
    ["TURNO_YA_DISPONIBLE", 409],
  ])("traduce %s a HTTP %i", async (code, status) => {
    listar.mockRejectedValueOnce(new ServiceError(code, "Mensaje del servicio"));
    const respuesta = await consultar();
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toEqual({ data: null, error: { code, message: "Mensaje del servicio" } });
  });
});
