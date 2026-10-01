import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { listar, permiso, cookie } = vi.hoisted(() => ({
  listar: vi.fn(), permiso: vi.fn(), cookie: vi.fn(),
}));
vi.mock("@/server/turnos/turno.profesor.service", () => ({ listarProfesoresPorMateria: listar }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: { user: { id: "usuario", rol: "MESA_ENTRADAS" } } })),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const materiaId = "ckmateria0000000000000001";
const consultar = (query = `materia_id=${materiaId}`) => GET(new NextRequest(`http://localhost/api/turnos/profesores/por-materia?${query}`), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({});
  listar.mockResolvedValue([{ id: "profesor1", nombre: "Ana", apellido: "Gómez" }]);
});

describe("HU-C-07 GET /api/turnos/profesores/por-materia", () => {
  it("exige turnos:crear y devuelve el arreglo contractual", async () => {
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: [{ id: "profesor1", nombre: "Ana", apellido: "Gómez" }], error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADAS", accionPermiso: "turnos:crear" } } });
    expect(listar).toHaveBeenCalledExactlyOnceWith(materiaId);
  });

  it.each(["", "materia_id=", "materia_id=%20%20"])("rechaza materia_id faltante o vacío con VALIDATION_ERROR", async (query) => {
    const respuesta = await consultar(query);
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR" } });
    expect(listar).not.toHaveBeenCalled();
  });

  it("recorta espacios de materia_id antes de llamar al servicio", async () => {
    await consultar(`materia_id=%20${materiaId}%20`);
    expect(listar).toHaveBeenCalledExactlyOnceWith(materiaId);
  });

  it("devuelve 403 SIN_PERMISO sin invocar al servicio", async () => {
    permiso.mockResolvedValueOnce(null);
    const respuesta = await consultar();
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(listar).not.toHaveBeenCalled();
  });

  it.each([
    ["SIN_PROFESORES_PARA_MATERIA", 404],
    ["MATERIA_NO_DISPONIBLE", 409],
  ])("traduce %s a HTTP %i", async (code, status) => {
    listar.mockRejectedValueOnce(new ServiceError(code, "Mensaje del servicio"));
    const respuesta = await consultar();
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toEqual({ data: null, error: { code, message: "Mensaje del servicio" } });
  });
});
