import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { obtenerDetalleTurno, tienePermiso, sesion } = vi.hoisted(() => ({
  obtenerDetalleTurno: vi.fn(),
  tienePermiso: vi.fn(),
  sesion: { user: { id: "usuario-mesa", rol: "MESA_ENTRADA" as string } },
}));
vi.mock("@/server/turnos/turno.detalle", () => ({ obtenerDetalleTurno }));
// withPermission("turnos:leer") ya tiene su propia prueba: acá solo inyecta la sesión.
vi.mock("@/server/shared/with-permission", () => ({
  tienePermiso,
  withPermission: (_accion: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) =>
    (req: NextRequest, ctx: { params: Promise<unknown> }) => handler(Object.assign(req, { auth: sesion }), ctx),
}));

const { GET } = await import("./route");
const consultar = (id = "turno-1") => GET(new NextRequest(`http://localhost/api/turnos/${id}`), { params: Promise.resolve({ id }) });
const SIN_PERMISO = { data: null, error: { code: "SIN_PERMISO", message: "No tenés permisos para acceder a esta sección" } };

beforeEach(() => {
  vi.clearAllMocks();
  sesion.user = { id: "usuario-mesa", rol: "MESA_ENTRADA" };
  tienePermiso.mockImplementation(async (accion: string) => accion !== "clases:registrar");
  obtenerDetalleTurno.mockResolvedValue({ resultado: "ok", turno: { id: "turno-1", acciones_habilitadas: [] } });
});

describe("HU-C-09 GET /api/turnos/[id]", () => {
  it("200 con el detalle en el sobre { data, error }", async () => {
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: { id: "turno-1", acciones_habilitadas: [] }, error: null });
  });

  it("calcula las capacidades opcionales como booleanos y pasa un único instante al servicio", async () => {
    await consultar();
    expect(tienePermiso.mock.calls.map(([accion]) => accion).sort()).toEqual(
      ["clases:registrar", "pagos:crear", "pagos:leer", "turnos:cancelar", "turnos:priorizar", "turnos:reprogramar"],
    );
    expect(obtenerDetalleTurno).toHaveBeenCalledExactlyOnceWith("turno-1", sesion.user, {
      capacidades: { verPagos: true, cancelar: true, reprogramar: true, priorizar: true, registrarPago: true, registrarClase: false },
      ahora: expect.any(Date),
    });
  });

  it("al Profesor no se le consulta pagos:leer: verPagos es false", async () => {
    sesion.user = { id: "usuario-prof", rol: "PROFESOR" };
    await consultar();
    expect(tienePermiso).not.toHaveBeenCalledWith("pagos:leer");
    expect(obtenerDetalleTurno.mock.calls[0]?.[2].capacidades.verPagos).toBe(false);
  });

  it("sin_permiso responde 403 con el mismo cuerpo neutro (ajeno, inexistente o sin ficha)", async () => {
    sesion.user = { id: "usuario-prof", rol: "PROFESOR" };
    obtenerDetalleTurno.mockResolvedValue({ resultado: "sin_permiso" });
    const ajeno = await consultar("turno-ajeno");
    const inexistente = await consultar("no-existe");
    expect([ajeno.status, inexistente.status]).toEqual([403, 403]);
    expect(await ajeno.json()).toEqual(SIN_PERMISO);
    expect(await inexistente.json()).toEqual(SIN_PERMISO);
  });

  it("no_encontrado responde 404 TURNO_NO_ENCONTRADO", async () => {
    obtenerDetalleTurno.mockResolvedValue({ resultado: "no_encontrado" });
    const respuesta = await consultar("no-existe");
    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toEqual({ data: null, error: { code: "TURNO_NO_ENCONTRADO", message: "No se encontró el turno" } });
  });

  it("un fallo de infraestructura se propaga como error, nunca como 403", async () => {
    obtenerDetalleTurno.mockRejectedValue(new Error("base caída"));
    await expect(consultar()).rejects.toThrow("base caída");
  });
});
