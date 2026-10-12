import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";

const { servicio, permiso } = vi.hoisted(() => ({ servicio: vi.fn(), permiso: vi.fn() }));
vi.mock("@/server/turnos/turno.cancelacion-propia.service", () => ({ cancelarInscripcionPropia: servicio }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (accion: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) =>
    async (req: NextRequest, ctx: { params: Promise<unknown> }) => {
      permiso(accion);
      return handler(Object.assign(req, { auth: { user: { id: "alumno-sesion" } } }), ctx);
    },
}));
const { POST } = await import("./route");
const cancelar = () => POST(new NextRequest("http://localhost/api/turnos/t1/inscripcion/cancelacion", { method: "POST" }), { params: Promise.resolve({ id: "t1" }) });

const cancelarConBody = (cuerpo: unknown) => POST(
  new NextRequest("http://localhost/api/turnos/t1/inscripcion/cancelacion?alumno_id=ajeno", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo),
  }),
  { params: Promise.resolve({ id: "t1" }) },
);

beforeEach(() => { vi.clearAllMocks(); });
describe("C-14 contrato del route", () => {
  it("usa permiso granular e identidad de sesión", async () => {
    servicio.mockResolvedValue({ id: "t1", vigencia: "CANCELADA_ALUMNO" });
    const response = await cancelar();
    expect(permiso).toHaveBeenCalledWith("turnos:cancelar_propia");
    expect(servicio).toHaveBeenCalledExactlyOnceWith("t1", "alumno-sesion");
    expect(await response.json()).toEqual({ data: { id: "t1", vigencia: "CANCELADA_ALUMNO" }, error: null });
  });

  it.each([
    ["SIN_PERMISO", 403], ["TURNO_NO_ENCONTRADO", 404], ["INSCRIPCION_NO_ENCONTRADA", 404],
    ["INSCRIPCION_NO_VIGENTE", 409], ["TURNO_CANCELADO", 409], ["TURNO_VENCIDO", 409], ["CANCELACION_FUERA_DE_PLAZO", 409],
  ])("traduce %s a %i", async (code, status) => {
    servicio.mockRejectedValue(new ServiceError(code, "motivo"));
    const response = await cancelar();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ data: null, error: { code, message: "motivo" } });
  });

  it.each([
    ["errores.turno.noEncontrado", "TURNO_NO_ENCONTRADO", 404], ["errores.inscripcion.noEncontrada", "INSCRIPCION_NO_ENCONTRADA", 404],
    ["errores.inscripcion.noVigente", "INSCRIPCION_NO_VIGENTE", 409], ["errores.turno.cancelado", "TURNO_CANCELADO", 409],
    ["errores.turno.vencido", "TURNO_VENCIDO", 409], ["errores.turno.pendiente", "TURNO_PENDIENTE", 409],
    ["errores.inscripcion.cancelacionFueraDePlazo", "CANCELACION_FUERA_DE_PLAZO", 409], ["errores.transaccion.ocupada", "TRANSACCION_OCUPADA", 409],
  ] as const)("traduce el error de dominio %s a %s con status %i", async (clave, code, status) => {
    const error = new ErrorDeDominio(clave);
    servicio.mockRejectedValue(error);
    const response = await cancelar();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ data: null, error: { code, message: error.message } });
  });

  it("la identidad sale de la sesión: ignora un alumno_id del cliente en el body o en la query", async () => {
    servicio.mockResolvedValue({ id: "t1", vigencia: "CANCELADA_ALUMNO" });
    await cancelarConBody({ alumno_id: "alumno-ajeno", usuario_id: "usuario-ajeno" });
    expect(servicio).toHaveBeenCalledExactlyOnceWith("t1", "alumno-sesion");
  });

  it("un error inesperado no se convierte en 409: se propaga", async () => {
    servicio.mockRejectedValue(new Error("fallo inesperado"));
    await expect(cancelar()).rejects.toThrow("fallo inesperado");
  });
});
