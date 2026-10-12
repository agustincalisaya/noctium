import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ cambio: vi.fn(), lista: vi.fn(), status: 200, permisos: [] as string[] }));
vi.mock("@/server/shared/with-permission", () => ({ withPermission: (permiso: string, fn: (req: unknown, ctx: unknown) => unknown) => {
  m.permisos.push(permiso);
  return (req: unknown, ctx: unknown) => m.status === 200 ? fn(req, ctx) : Response.json({ data: null, error: { code: m.status === 401 ? "SESION_INVALIDA" : "SIN_PERMISO" } }, { status: m.status });
} }));
vi.mock("@/server/materias/materia.service", () => ({ cambiarTarifasMasivo: m.cambio, listarMateriasConTarifa: m.lista }));
import { GET, POST } from "./route";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
const payload = { tarifa_hora: 15000, materias: [{ id: "cm000000000000000000000001", tarifa_actual: null }] };
const request = (body: unknown) => ({ json: async () => body, auth: { user: { id: "g" } } });
const ctx = { params: Promise.resolve({}) };
beforeEach(() => { vi.clearAllMocks(); m.status = 200; m.cambio.mockResolvedValue({ tarifa_hora: 15000, actualizadas: 1, sin_cambio: 0 }); m.lista.mockResolvedValue([]); });
describe("HU-L-07: GET/POST", () => {
  it("ambas rutas requieren cambiar_tarifa; envelopes y actor", async () => {
    expect(m.permisos).toEqual(["materias:cambiar_tarifa", "materias:cambiar_tarifa"]);
    expect(await (await GET(request(null) as never, ctx)).json()).toEqual({ data: { items: [] }, error: null });
    expect(await (await POST(request(payload) as never, ctx)).json()).toEqual({ data: { tarifa_hora: 15000, actualizadas: 1, sin_cambio: 0 }, error: null });
    expect(m.cambio).toHaveBeenCalledWith(payload, "g");
  });
  it.each([401, 403])("rechazo guard %s en ambas sin invocar servicios", async (status) => {
    m.status = status;
    for (const handler of [GET, POST]) expect((await handler(request(payload) as never, ctx)).status).toBe(status);
    expect(m.lista).not.toHaveBeenCalled(); expect(m.cambio).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...payload, materias: [] }, { ...payload, tarifa_hora: 0 }, { ...payload, version: 1 }])("validación %j da 400", async (body) => {
    const r = await POST(request(body) as never, ctx);
    expect(r.status).toBe(400); expect((await r.json()).error).toMatchObject({ code: "VALIDACION", detalles: expect.any(Object) }); expect(m.cambio).not.toHaveBeenCalled();
  });
  it("JSON malformado da VALIDACION", async () => {
    const r = await POST({ ...request(null), json: async () => { throw new SyntaxError(); } } as never, ctx);
    expect(r.status).toBe(400); expect(m.cambio).not.toHaveBeenCalled();
  });
  it.each([["errores.materias.noEncontrada", 404], ["errores.materias.inactiva", 422], ["errores.materias.tarifaConflicto", 409], ["errores.transaccion.ocupada", 409]] as const)("traduce %s %s", async (clave, status) => {
    const error = new ErrorDeDominio(clave); m.cambio.mockRejectedValue(error);
    const r = await POST(request(payload) as never, ctx);
    expect(r.status).toBe(status); expect((await r.json()).error.code).toBe(error.code);
  });
  it("no-op devuelve 200 y error null; fallo desconocido se propaga", async () => {
    m.cambio.mockResolvedValue({ tarifa_hora: 15000, actualizadas: 0, sin_cambio: 1 });
    const r = await POST(request(payload) as never, ctx);
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ data: { tarifa_hora: 15000, actualizadas: 0, sin_cambio: 1 }, error: null });
    m.cambio.mockRejectedValue(new Error("fallo")); await expect(POST(request(payload) as never, ctx)).rejects.toThrow("fallo");
  });
});
