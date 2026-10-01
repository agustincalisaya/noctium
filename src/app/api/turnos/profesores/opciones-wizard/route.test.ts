import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { listar, permiso, cookie } = vi.hoisted(() => ({
  listar: vi.fn(), permiso: vi.fn(), cookie: vi.fn(),
}));
vi.mock("@/server/turnos/turno.profesor.service", () => ({ listarOpcionesProfesorWizard: listar }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: { user: { id: "usuario", rol: "MESA_ENTRADAS" } } })),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const materiaId = "ckmateria0000000000000001";
const consultar = (query = `materia_id=${materiaId}`) => GET(new NextRequest(`http://localhost/api/turnos/profesores/opciones-wizard?${query}`), { params: Promise.resolve({}) });
const opcion = { id: "profesor1", nombre: "Ana", apellido: "Gómez", horarios: [{ horario_id: "h1", dia_semana: "MARTES", hora_inicio: "16:00", hora_fin: "20:00" }] };

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({});
  listar.mockResolvedValue([opcion]);
});

describe("GET opciones-wizard de profesor", () => {
  it("exige turnos:crear y conserva el shape de horarios", async () => {
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: [opcion], error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADAS", accionPermiso: "turnos:crear" } } });
    expect(listar).toHaveBeenCalledExactlyOnceWith(materiaId);
  });

  it("sin profesores con horarios responde 200 con lista vacía", async () => {
    listar.mockResolvedValueOnce([]);
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: [], error: null });
  });

  it.each(["", "materia_id=", "materia_id=%20%20"])("rechaza materia_id ausente o vacío", async (query) => {
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

  it("traduce materia inactiva a 409", async () => {
    listar.mockRejectedValueOnce(new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible"));
    const respuesta = await consultar();
    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ error: { code: "MATERIA_NO_DISPONIBLE" } });
  });
});
