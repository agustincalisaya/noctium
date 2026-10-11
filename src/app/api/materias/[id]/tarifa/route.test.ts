import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ cambio: vi.fn(), permitido: true, permiso: "" }));
vi.mock("@/server/shared/with-permission", () => ({ withPermission: (permiso: string, fn: (req: unknown, ctx: unknown) => unknown) => {
  m.permiso = permiso;
  return (req: unknown, ctx: unknown) => m.permitido ? fn(req, ctx) : Response.json({ data: null, error: { code: "SIN_PERMISO" } }, { status: 403 });
} }));
vi.mock("@/server/materias/materia.service", () => ({ cambiarTarifaMateria: m.cambio }));
import { PUT } from "./route";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
const request = (payload: unknown) => ({ json: async () => payload, auth: { user: { id: "g" } } });
const ctx = { params: Promise.resolve({ id: "m" }) };
beforeEach(() => { vi.clearAllMocks(); m.permitido = true; m.cambio.mockResolvedValue({ id: "m", tarifa_hora: 15000, tarifa_anterior: 12000 }); });
describe("PUT tarifa", () => {
  it("exige el permiso correcto y devuelve el envelope", async () => {
    const r = await PUT(request({ tarifa_hora: 15000, tarifa_actual: 12000 }) as never, ctx);
    expect(m.permiso).toBe("materias:cambiar_tarifa"); expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: { id: "m", tarifa_hora: 15000, tarifa_anterior: 12000 }, error: null });
    expect(m.cambio).toHaveBeenCalledWith("m", { tarifa_hora: 15000, tarifa_actual: 12000 }, "g");
  });
  it("permiso rechazado no llama al servicio", async () => {
    m.permitido = false;
    expect((await PUT(request({ tarifa_hora: 15000, tarifa_actual: 12000 }) as never, ctx)).status).toBe(403);
    expect(m.cambio).not.toHaveBeenCalled();
  });
  it.each([null, {}, { tarifa_hora: 0, tarifa_actual: 12000 }, { tarifa_hora: 15000, tarifa_actual: 12000, version: 1 }])("entrada inválida %j → 400", async (payload) => {
    const r = await PUT(request(payload) as never, ctx);
    expect(r.status).toBe(400); expect((await r.json()).error.code).toBe("VALIDACION"); expect(m.cambio).not.toHaveBeenCalled();
  });
  it.each([
    ["errores.materias.noEncontrada", 404], ["errores.materias.inactiva", 422],
    ["errores.materias.tarifaSinCambio", 422], ["errores.materias.tarifaConflicto", 409], ["errores.transaccion.ocupada", 409],
  ] as const)("traduce %s a %s", async (clave, status) => {
    const error = new ErrorDeDominio(clave); m.cambio.mockRejectedValue(error);
    const r = await PUT(request({ tarifa_hora: 15000, tarifa_actual: 12000 }) as never, ctx);
    expect(r.status).toBe(status); expect((await r.json()).error.code).toBe(error.code);
  });
});
