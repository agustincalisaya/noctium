import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { calcular, permiso, cookie } = vi.hoisted(() => ({ calcular: vi.fn(), permiso: vi.fn(), cookie: vi.fn() }));
vi.mock("@/server/turnos/turno.profesor.service", () => ({ calcularAgendaProfesorWizard: calcular }));
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
  GET(new NextRequest(`http://localhost/api/turnos/profesores/${id}/agenda-wizard?${query}`), { params: Promise.resolve({ profesorId: id }) });
const data = { profesor: { id: profesorId, nombre_completo: "Gómez, Ana" }, duracion_min: 120, granularidad_min: 30,
  rango: { desde: "2026-10-01", hasta: "2026-10-01" },
  franjas_recurrentes: [{ horario_id: "h1", dia_semana: "JUEVES", hora_inicio: "09:00", hora_fin: "12:00" }],
  meses: [{ anio: 2026, mes: 10, etiqueta: "Octubre 2026", dias: [{ fecha: "2026-10-01", dia_semana: "JUEVES", numero: 1,
    en_rango: true, operativo: true, tiene_horarios_libres: false, seleccionable: false,
    franjas: [{ hora_inicio: "09:00", hora_fin: "12:00", tramos_libres: [], tramos_ocupados: [{ desde: "09:00", hasta: "12:00" }],
      bloques: [{ inicio: "09:00", fin: "11:00", estado: "OCUPADO", seleccionable: false }] }],
  }] }],
};

beforeEach(() => { vi.clearAllMocks(); permiso.mockResolvedValue({}); calcular.mockResolvedValue(data); });

describe("GET agenda-wizard de profesor", () => {
  it("requiere turnos:crear y conserva el shape incluso sin bloques libres", async () => {
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADAS", accionPermiso: "turnos:crear" } } });
    expect(calcular).toHaveBeenCalledExactlyOnceWith(profesorId, { materia_id: materiaId, duracion_min: 120 });
  });

  it("acepta desde/hasta y los pasa como fechas calendario", async () => {
    const respuesta = await consultar(`materia_id=${materiaId}&duracion_min=60&desde=2026-10-01&hasta=2026-10-15`);
    expect(respuesta.status).toBe(200);
    expect(calcular).toHaveBeenCalledWith(profesorId, { materia_id: materiaId, duracion_min: 60,
      desde: new Date("2026-10-01T00:00:00.000Z"), hasta: new Date("2026-10-15T00:00:00.000Z") });
  });

  it.each(["", "duracion_min=60", `materia_id=${materiaId}`, `materia_id=${materiaId}&duracion_min=90`,
    `materia_id=${materiaId}&duracion_min=60&desde=2026-02-30`, `materia_id=${materiaId}&duracion_min=60&hasta=mal`])
  ("rechaza query inválida: %s", async (query) => {
    const respuesta = await consultar(query);
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR" } });
    expect(calcular).not.toHaveBeenCalled();
  });

  it("rechaza profesorId vacío", async () => {
    expect((await consultar(undefined, " ")).status).toBe(400);
    expect(calcular).not.toHaveBeenCalled();
  });

  it("rechaza falta de permiso antes de llamar al servicio", async () => {
    permiso.mockResolvedValueOnce(null);
    const respuesta = await consultar();
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(calcular).not.toHaveBeenCalled();
  });

  it.each([["VALIDATION_ERROR", 400], ["PROFESOR_NO_ENCONTRADO", 404],
    ["MATERIA_NO_DISPONIBLE", 409], ["PROFESOR_NO_DICTA_MATERIA", 409]])
  ("traduce %s a HTTP %i", async (code, status) => {
    calcular.mockRejectedValueOnce(new ServiceError(String(code), "Mensaje del servicio"));
    const respuesta = await consultar();
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toEqual({ data: null, error: { code, message: "Mensaje del servicio" } });
  });
});
