import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { crear, permiso, cookie } = vi.hoisted(() => ({ crear: vi.fn(), permiso: vi.fn(), cookie: vi.fn() }));
vi.mock("@/server/turnos/turno.service", () => ({ configurarTurno: crear, listarTurnos: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: { user: { id: "usuario", rol: "MESA_ENTRADAS" } } })),
  decodificarToken: vi.fn(),
}));

const { POST } = await import("./route");
const PROFESOR = "ckprofesor000000000000001";
const body = { fecha: "2026-10-01", hora_inicio: "10:00", materia_id: "ckmateria0000000000000001", profesor_id: PROFESOR, duracion_min: 60 };
const crearRequest = (datos: unknown) => POST(new NextRequest("http://localhost/api/turnos", { method: "POST", body: JSON.stringify(datos), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({});
  crear.mockResolvedValue({ id: "turno-1", fecha: body.fecha, hora_inicio: body.hora_inicio, hora_fin: "11:00", duracion_min: 60, profesor_id: PROFESOR, cupo_maximo: null, estado: "PENDIENTE" });
});

describe("HU-C-18 etapa 1 POST /api/turnos", () => {
  it("conserva turnos:crear y devuelve 201 con profesor_id", async () => {
    const respuesta = await crearRequest(body);
    expect(respuesta.status).toBe(201);
    expect(await respuesta.json()).toEqual({ data: { id: "turno-1", fecha: body.fecha, hora_inicio: body.hora_inicio, hora_fin: "11:00", duracion_min: 60, profesor_id: PROFESOR, cupo_maximo: null, estado: "PENDIENTE" }, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADAS", accionPermiso: "turnos:crear" } } });
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ profesor_id: PROFESOR }), "usuario");
  });

  it("rechaza profesor_id omitido antes de llamar al servicio", async () => {
    const { profesor_id: _omitido, ...sinProfesor } = body;
    void _omitido;
    const respuesta = await crearRequest(sinProfesor);
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR" } });
    expect(crear).not.toHaveBeenCalled();
  });

  it.each([["PROFESOR_NO_ENCONTRADO", 404], ["PROFESOR_NO_DICTA_MATERIA", 409], ["PROFESOR_FUERA_DE_HORARIO", 409], ["PROFESOR_NO_DISPONIBLE", 409]])("traduce %s a HTTP %i", async (code, status) => {
    crear.mockRejectedValueOnce(new ServiceError(code, "Error del profesor"));
    const respuesta = await crearRequest(body);
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toEqual({ data: null, error: { code, message: "Error del profesor" } });
  });
});
