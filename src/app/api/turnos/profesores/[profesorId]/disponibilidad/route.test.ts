import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { calcular, permiso, cookie } = vi.hoisted(() => ({ calcular: vi.fn(), permiso: vi.fn(), cookie: vi.fn() }));
vi.mock("@/server/turnos/turno.profesor.service", () => ({ calcularDisponibilidadProfesor: calcular }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) =>
    handler(Object.assign(req, { auth: { user: { id: "usuario", rol: "MESA_ENTRADAS" } } }), ctx),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const profesorId = "ckprofesor000000000000001";
const materiaId = "ckmateria0000000000000001";
const consultar = (query = `materia_id=${materiaId}&duracion_min=120`, id = profesorId) =>
  GET(new NextRequest(`http://localhost/api/turnos/profesores/${id}/disponibilidad?${query}`), { params: Promise.resolve({ profesorId: id }) });

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({});
  calcular.mockResolvedValue({ profesor: { id: profesorId, nombre_completo: "Gómez, Ana" }, duracion_min: 120, rango: { desde: "2026-09-29", hasta: "2026-10-29" }, fechas: [] });
});

describe("HU-C-07 GET disponibilidad de profesor", () => {
  it("requiere turnos:crear y entrega 200 incluso con fechas vacías", async () => {
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: { profesor: { id: profesorId, nombre_completo: "Gómez, Ana" }, duracion_min: 120, rango: { desde: "2026-09-29", hasta: "2026-10-29" }, fechas: [] }, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADAS", accionPermiso: "turnos:crear" } } });
    expect(calcular).toHaveBeenCalledExactlyOnceWith(profesorId, { materia_id: materiaId, duracion_min: 120 });
  });

  it("devuelve disponibilidad normal sin modificar el shape", async () => {
    const data = { profesor: { id: profesorId, nombre_completo: "Gómez, Ana" }, duracion_min: 60, rango: { desde: "2026-10-01", hasta: "2026-10-01" }, fechas: [{ fecha: "2026-10-01", dia_semana: "JUEVES", franjas: [{ hora_inicio: "10:00", hora_fin: "12:00", tramos_libres: [{ desde: "10:00", hasta: "12:00" }], inicios: ["10:00"] }] }] };
    calcular.mockResolvedValueOnce(data);
    const respuesta = await consultar(`materia_id=${materiaId}&duracion_min=60&desde=2026-10-01&hasta=2026-10-01`);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data, error: null });
    expect(calcular).toHaveBeenCalledWith(profesorId, { materia_id: materiaId, duracion_min: 60, desde: new Date("2026-10-01T00:00:00.000Z"), hasta: new Date("2026-10-01T00:00:00.000Z") });
  });

  it.each(["", "duracion_min=60", `materia_id=${materiaId}`, `materia_id=${materiaId}&duracion_min=90`, `materia_id=${materiaId}&duracion_min=60&desde=2026-02-30`])("rechaza query inválida: %s", async (query) => {
    const respuesta = await consultar(query);
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR" } });
    expect(calcular).not.toHaveBeenCalled();
  });

  it("rechaza profesorId vacío", async () => {
    const respuesta = await consultar(undefined, " ");
    expect(respuesta.status).toBe(400);
    expect(calcular).not.toHaveBeenCalled();
  });

  it("devuelve 403 SIN_PERMISO sin llamar al servicio", async () => {
    permiso.mockResolvedValueOnce(null);
    const respuesta = await consultar();
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(calcular).not.toHaveBeenCalled();
  });

  it.each([
    ["VALIDATION_ERROR", 400], ["PROFESOR_NO_ENCONTRADO", 404],
    ["MATERIA_NO_DISPONIBLE", 409], ["PROFESOR_NO_DICTA_MATERIA", 409],
    ["ERROR_NO_MAPEADO", 422],
  ])("traduce %s a HTTP %i", async (code, status) => {
    calcular.mockRejectedValueOnce(new ServiceError(code, "Mensaje del servicio"));
    const respuesta = await consultar();
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toEqual({ data: null, error: { code, message: "Mensaje del servicio" } });
  });
});
