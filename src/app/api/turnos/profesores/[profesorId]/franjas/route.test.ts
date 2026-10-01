import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { listar, permiso, cookie } = vi.hoisted(() => ({ listar: vi.fn(), permiso: vi.fn(), cookie: vi.fn() }));
vi.mock("@/server/turnos/turno.franjas.service", () => ({ listarFranjasProfesor: listar }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) =>
    handler(Object.assign(req, { auth: { user: { id: "usuario", rol: "MESA_ENTRADAS" } } }), ctx),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const profesorId = "ckprofesor000000000000001";
const materiaId = "materia-1";
const franjas = [{ horario_id: "ckhorario000000000000001", dia_semana: "JUEVES", hora_inicio: "15:00", hora_fin: "19:00" }];
const consultar = (profesor = profesorId, query = `materia_id=${materiaId}`) =>
  GET(new NextRequest(`http://localhost/api/turnos/profesores/${profesor}/franjas?${query}`), { params: Promise.resolve({ profesorId: profesor }) });

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({});
  listar.mockResolvedValue(franjas);
});

describe("GET franjas recurrentes", () => {
  it("exige turnos:crear y devuelve el array contractual", async () => {
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: franjas, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADAS", accionPermiso: "turnos:crear" } } });
    expect(listar).toHaveBeenCalledExactlyOnceWith(profesorId, materiaId);
  });

  it("sin horarios devuelve 200 y lista vacía", async () => {
    listar.mockResolvedValueOnce([]);
    expect(await (await consultar()).json()).toEqual({ data: [], error: null });
  });

  it.each([
    ["ckprofesor000000000000001", ""],
    ["ckprofesor000000000000001", "materia_id="],
    ["", `materia_id=${materiaId}`],
  ])("rechaza parámetros inválidos", async (profesor, query) => {
    const respuesta = await consultar(profesor, query);
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({ data: null, error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos" } });
    expect(listar).not.toHaveBeenCalled();
  });

  it("rechaza falta de permiso antes de consultar", async () => {
    permiso.mockResolvedValueOnce(null);
    const respuesta = await consultar();
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(listar).not.toHaveBeenCalled();
  });

  it.each([
    ["MATERIA_NO_DISPONIBLE", 409],
    ["PROFESOR_NO_ENCONTRADO", 404],
    ["PROFESOR_NO_DICTA_MATERIA", 409],
  ] as const)("traduce %s a HTTP %i", async (codigo, status) => {
    listar.mockRejectedValueOnce(new ServiceError(codigo, "Sin disponibilidad"));
    const respuesta = await consultar();
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toEqual({ data: null, error: { code: codigo, message: "Sin disponibilidad" } });
  });
});
