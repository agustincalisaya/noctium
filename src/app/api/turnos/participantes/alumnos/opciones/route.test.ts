import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { listar, permiso, cookie } = vi.hoisted(() => ({ listar: vi.fn(), permiso: vi.fn(), cookie: vi.fn() }));
vi.mock("@/server/turnos/turno.service", () => ({ listarOpcionesAlumnoTurno: listar }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: { user: { id: "usuario", rol: "MESA_ENTRADAS" } } })),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const consultar = (query = "turno_id=turno-1") => GET(new NextRequest(`http://localhost/api/turnos/participantes/alumnos/opciones?${query}`), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({});
  listar.mockResolvedValue({ turno_id: "turno-1", alumnos: [{ id: "a", nombre: "Ana", apellido: "Paz", dni: "123" }] });
});

describe("GET opciones de alumnos elegibles", () => {
  it("requiere permiso y devuelve el contrato completo", async () => {
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: { turno_id: "turno-1", alumnos: [{ id: "a", nombre: "Ana", apellido: "Paz", dni: "123" }] }, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADAS", accionPermiso: "turnos:asignar_participantes" } } });
    expect(listar).toHaveBeenCalledExactlyOnceWith("turno-1");
  });
  it("acepta lista vacía", async () => {
    listar.mockResolvedValueOnce({ turno_id: "turno-1", alumnos: [] });
    expect(await (await consultar()).json()).toEqual({ data: { turno_id: "turno-1", alumnos: [] }, error: null });
  });
  it.each(["", "turno_id=", "turno_id=%20"])("exige turno_id", async (query) => {
    const respuesta = await consultar(query);
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(listar).not.toHaveBeenCalled();
  });
  it("rechaza falta de permiso antes de consultar", async () => {
    permiso.mockResolvedValueOnce(null);
    const respuesta = await consultar();
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ error: { code: "SIN_PERMISO" } });
    expect(listar).not.toHaveBeenCalled();
  });
  it.each([["TURNO_NO_ENCONTRADO", 404], ["TURNO_YA_DISPONIBLE", 409], ["TURNO_SIN_AULA", 409]] as const)("traduce %s", async (code, status) => {
    listar.mockRejectedValueOnce(new ServiceError(code, code));
    const respuesta = await consultar();
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toMatchObject({ error: { code } });
  });
});
