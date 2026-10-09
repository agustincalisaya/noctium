import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

const { servicio, permiso } = vi.hoisted(() => ({ servicio: vi.fn(), permiso: vi.fn() }));
vi.mock("@/server/turnos/turno.service", () => ({ solicitarTurnoPropio: servicio }));
// Prueba del contrato con wrapper simulado; no acredita RBAC real.
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (accion: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
    return async (req: NextRequest, ctx: { params: Promise<unknown> }) => {
      permiso(accion);
      return handler(Object.assign(req, { auth: { user: { id: "alumno-sesion" } } }), ctx);
    };
  },
}));
const { POST } = await import("./route");
const confirmar = () => POST(new NextRequest("http://localhost/api/turnos/t1/inscripcion?alumno_id=ajeno", {
  method: "POST", body: JSON.stringify({ alumno_id: "ajeno" }),
}), { params: Promise.resolve({ id: "t1" }) });
beforeEach(() => { vi.clearAllMocks(); });

describe("C-22 POST reserva (wrapper simulado)", () => {
  it("usa identidad de sesión y conserva campos con reserva añadida", async () => {
    const data = { id: "t1", alumnos_inscriptos: "1/3", estado: "DISPONIBLE", inscripcion: { id: "i1", estado_pago: "RESERVADA", vence_el: "2026-10-10T15:00:00-03:00", precio: 24000 } };
    servicio.mockResolvedValue(data);
    const response = await confirmar();
    expect(permiso).toHaveBeenCalledWith("turnos:solicitar_propio");
    expect(servicio).toHaveBeenCalledExactlyOnceWith("t1", "alumno-sesion");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data, error: null });
  });
  it.each([
    ["SIN_PERMISO", 403], ["TURNO_NO_ENCONTRADO", 404], ["TURNO_NO_DISPONIBLE", 409],
    ["TURNO_VENCIDO", 409], ["CUPO_INSUFICIENTE", 409], ["ALUMNO_INACTIVO", 409],
    ["ALUMNO_YA_ASIGNADO", 409], ["ALUMNO_NO_DISPONIBLE", 409], ["RESERVA_PREVIA_SIN_PAGO", 409],
  ])("traduce %s a %i sin datos de éxito", async (code, status) => {
    servicio.mockRejectedValue(new ServiceError(code, "motivo"));
    const response = await confirmar();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ data: null, error: { code, message: "motivo" } });
  });
  it("tarifa ausente conserva el status 422 del catálogo", async () => {
    servicio.mockRejectedValue(new ErrorDeDominio("errores.inscripcion.materiaSinTarifa"));
    const response = await confirmar();
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("MATERIA_SIN_TARIFA");
  });
  it("propaga errores de infraestructura", async () => {
    servicio.mockRejectedValue(new Error("BD caída"));
    await expect(confirmar()).rejects.toThrow("BD caída");
  });
});
