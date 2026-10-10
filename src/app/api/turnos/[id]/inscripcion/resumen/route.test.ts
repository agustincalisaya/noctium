import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

const { servicio, permiso } = vi.hoisted(() => ({ servicio: vi.fn(), permiso: vi.fn() }));
vi.mock("@/server/turnos/turno.resumen-inscripcion.service", () => ({ obtenerResumenInscripcion: servicio }));
// Nivel 1: wrapper simulado. No acredita autenticación ni RBAC reales (nivel 2).
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (accion: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
    return async (req: NextRequest, ctx: { params: Promise<unknown> }) => {
      permiso(accion);
      const response = await handler(Object.assign(req, { auth: { user: { id: "alumno-sesion" } } }), ctx);
      response.headers.set("Cache-Control", "no-store, must-revalidate");
      return response;
    };
  },
}));
const { GET } = await import("./route");
const consultar = () => GET(new NextRequest("http://localhost/api/turnos/t1/inscripcion/resumen?alumno_id=ajeno"), { params: Promise.resolve({ id: "t1" }) });
beforeEach(() => { servicio.mockReset(); });
describe("C-20 contrato del route (wrapper simulado)", () => {
  it("permiso granular, identidad de sesión, envelope y caché privada sin almacenamiento", async () => {
    servicio.mockResolvedValue({ turno_id: "t1", precio: 12000 });
    const response = await consultar();
    expect(permiso).toHaveBeenCalledWith("turnos:solicitar_propio");
    expect(servicio).toHaveBeenCalledExactlyOnceWith("t1", "alumno-sesion");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { turno_id: "t1", precio: 12000 }, error: null });
    expect(response.headers.get("Cache-Control")).toBe("no-store, must-revalidate");
  });
  it.each([
    ["SIN_PERMISO", 403], ["TURNO_NO_ENCONTRADO", 404], ["TURNO_NO_DISPONIBLE", 409],
    ["TURNO_VENCIDO", 409], ["CUPO_INSUFICIENTE", 409], ["ALUMNO_INACTIVO", 409], ["ALUMNO_YA_ASIGNADO", 409],
  ])("traduce %s a %i", async (code, status) => {
    servicio.mockRejectedValue(new ServiceError(code as string, "motivo"));
    const response = await consultar();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ data: null, error: { code, message: "motivo" } });
  });
  it("tarifa ausente usa 422 del catálogo", async () => {
    servicio.mockRejectedValue(new ErrorDeDominio("errores.inscripcion.materiaSinTarifa"));
    const response = await consultar();
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("MATERIA_SIN_TARIFA");
  });
  it("no oculta fallos de infraestructura", async () => {
    servicio.mockRejectedValue(new Error("BD caída"));
    await expect(consultar()).rejects.toThrow("BD caída");
  });
});
