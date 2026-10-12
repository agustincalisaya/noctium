import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { permiso, cookie, buscarTurnos, listarAulas } = vi.hoisted(() => ({ permiso: vi.fn(), cookie: vi.fn(), buscarTurnos: vi.fn(), listarAulas: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  rolPermiso: { findUnique: permiso },
  usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) },
  turno: { findMany: buscarTurnos },
} }));
vi.mock("@/server/aulas/aula.publico", () => ({ listarAulasActivasParaTurno: listarAulas }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) =>
    handler(Object.assign(req, { auth: { user: { id: "usuario", rol: "MESA_ENTRADAS" } } }), ctx),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const consultar = (query = "fecha=2026-10-08&hora_inicio=15:00&duracion_min=60") =>
  GET(new NextRequest(`http://localhost/api/turnos/generacion/aulas-libres?${query}`), { params: Promise.resolve({}) });
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);
const aulas = [
  { id: "c-aula-3", nombre: "Aula 3", capacidad: 6 },
  { id: "c-aula-10", nombre: "Aula 10", capacidad: 20 },
  { id: "c-aula-2", nombre: "Aula 2", capacidad: 20 },
  { id: "c-lab", nombre: "Laboratorio", capacidad: 8 },
];

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({});
  listarAulas.mockResolvedValue(aulas);
  buscarTurnos.mockResolvedValue([]);
});

describe("HU-C-21 GET aulas libres de la generación", () => {
  it("exige turnos:crear y devuelve las aulas activas libres por capacidad, nombre e id", async () => {
    buscarTurnos.mockResolvedValueOnce([
      { fechaTurno: new Date("2026-10-08T00:00:00.000Z"), aulaId: "c-aula-3", horaInicioTurno: hora("15:30"), duracionMinutosTurno: 60 },
      { fechaTurno: new Date("2026-10-08T00:00:00.000Z"), aulaId: "c-lab", horaInicioTurno: hora("16:00"), duracionMinutosTurno: 60 },
    ]);
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: [
      { id: "c-lab", nombre: "Laboratorio", capacidad: 8 },
      { id: "c-aula-2", nombre: "Aula 2", capacidad: 20 },
      { id: "c-aula-10", nombre: "Aula 10", capacidad: 20 },
    ], error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADAS", accionPermiso: "turnos:crear" } } });
    expect(listarAulas).toHaveBeenCalledExactlyOnceWith(1);
    expect(buscarTurnos).toHaveBeenCalledExactlyOnceWith({
      where: { fechaTurno: { in: [new Date("2026-10-08T00:00:00.000Z")] }, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }, aulaId: { in: aulas.map(({ id }) => id) } },
      select: { fechaTurno: true, aulaId: true, horaInicioTurno: true, duracionMinutosTurno: true },
    });
  });

  it("sin aulas libres o sin aulas activas responde 200 con lista vacía", async () => {
    buscarTurnos.mockResolvedValueOnce(aulas.map(({ id }) => ({ fechaTurno: new Date("2026-10-08T00:00:00.000Z"), aulaId: id, horaInicioTurno: hora("15:00"), duracionMinutosTurno: 60 })));
    expect(await (await consultar()).json()).toEqual({ data: [], error: null });
    listarAulas.mockResolvedValueOnce([]);
    expect(await (await consultar()).json()).toEqual({ data: [], error: null });
    expect(buscarTurnos).toHaveBeenCalledOnce();
  });

  it.each([
    "hora_inicio=15:00&duracion_min=60",
    "fecha=2026-02-30&hora_inicio=15:00&duracion_min=60",
    "fecha=2026-10-08&hora_inicio=25:00&duracion_min=60",
    "fecha=2026-10-08&hora_inicio=15:00&duracion_min=90",
    "fecha=2026-10-08&hora_inicio=15:00&duracion_min=abc",
    "fecha=2026-10-08&hora_inicio=15:00&duracion_min=60&aula_id=x",
  ])("query inválida %s → 400 VALIDATION_ERROR con detalles", async (query) => {
    const respuesta = await consultar(query);
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos", detalles: expect.any(Object) } });
    expect(listarAulas).not.toHaveBeenCalled();
  });

  it("sin permiso responde 403 sin consultar", async () => {
    permiso.mockResolvedValueOnce(null);
    const respuesta = await consultar();
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(listarAulas).not.toHaveBeenCalled();
    expect(buscarTurnos).not.toHaveBeenCalled();
  });
});
