import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { reprogramar, rol, accion } = vi.hoisted(() => ({ reprogramar: vi.fn(), rol: { valor: "MESA_ENTRADA" }, accion: { valor: "" } }));
vi.mock("@/server/turnos/turno.reprogramacion.service", () => ({ reprogramarTurno: reprogramar }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (permiso: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
    accion.valor = permiso;
    return (req: NextRequest, ctx: { params: Promise<unknown> }) => rol.valor === "MESA_ENTRADA"
      ? handler(Object.assign(req, { auth: { user: { id: "mesa-1", rol: rol.valor } } }), ctx)
      : NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "Sin permiso" } }, { status: 403 });
  },
}));

const { PATCH } = await import("./route");
const consultar = (body: unknown, id = "turno-1") => PATCH(new NextRequest(`http://localhost/api/turnos/${id}/reprogramacion`, {
  method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
}), { params: Promise.resolve({ id }) });
const OK = { id: "turno-1", fecha: "2026-10-07", hora_inicio: "17:00", hora_fin: "18:00", estado: "DISPONIBLE" };

beforeEach(() => { vi.clearAllMocks(); rol.valor = "MESA_ENTRADA"; reprogramar.mockResolvedValue(OK); });

describe("HU-C-06 PATCH reprogramacion", () => {
  it("exige turnos:reprogramar y responde 200 con sobre estándar", async () => {
    expect(accion.valor).toBe("turnos:reprogramar");
    const response = await consultar({ fecha: "2026-10-07", hora_inicio: "17:00" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: OK, error: null });
    expect(reprogramar).toHaveBeenCalledExactlyOnceWith("turno-1", { fecha: new Date("2026-10-07T00:00:00.000Z"), hora_inicio: "17:00" }, "mesa-1");
  });

  it.each([null, {}, { fecha: "2026-10-07" }, { fecha: "2026-10-07", hora_inicio: "17:00", duracion_min: 120 },
    { fecha: "2026-10-07", hora_inicio: "17:00", profesor_id: "p" }, { fecha: "2026-10-07", hora_inicio: "17:00", materia_id: "m" },
    { fecha: "2026-10-07", hora_inicio: "17:00", aula_id: "a" }])("AC5 / schema: 400 VALIDATION_ERROR sin invocar el servicio (%j)", async (body) => {
    const response = await consultar(body);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(reprogramar).not.toHaveBeenCalled();
  });

  it.each(["FECHA_PASADA", "ANTICIPACION_EXCEDIDA", "DIA_NO_OPERATIVO", "HORA_NO_GRANULAR", "FUERA_DE_HORARIO_OPERATIVO"])(
    "validación de fecha %s → 400 VALIDATION_ERROR con detalles.motivo", async (motivo) => {
      reprogramar.mockRejectedValue(new ServiceError(motivo, "Mensaje del servicio"));
      const response = await consultar({ fecha: "2026-10-07", hora_inicio: "17:00" });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ data: null, error: { code: "VALIDATION_ERROR", message: "Mensaje del servicio", detalles: { motivo } } });
    });

  it.each(["GERENTE", "PROFESOR"])("403 para %s sin invocar el servicio", async (valor) => {
    rol.valor = valor;
    expect((await consultar({ fecha: "2026-10-07", hora_inicio: "17:00" })).status).toBe(403);
    expect(reprogramar).not.toHaveBeenCalled();
  });

  it.each([["TURNO_NO_ENCONTRADO", 404], ["TURNO_PENDIENTE", 409], ["TURNO_CANCELADO", 409], ["TURNO_VENCIDO", 409], ["TURNO_MODIFICADO", 409]] as const)(
    "traduce %s a HTTP %i", async (code, status) => {
      reprogramar.mockRejectedValue(new ServiceError(code, "Error del turno"));
      const response = await consultar({ fecha: "2026-10-07", hora_inicio: "17:00" });
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ data: null, error: { code, message: "Error del turno" } });
    });

  it("AC2: 409 REPROGRAMACION_CONFLICTO con detalles.conflictos { recurso, id }", async () => {
    const conflictos = [{ recurso: "AULA", id: "aula-1" }, { recurso: "ALUMNO", id: "alumno-2" }];
    reprogramar.mockRejectedValue(new ServiceError("REPROGRAMACION_CONFLICTO", "No disponible", { conflictos }));
    const response = await consultar({ fecha: "2026-10-07", hora_inicio: "17:00" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ data: null, error: { code: "REPROGRAMACION_CONFLICTO", message: "No disponible", detalles: { conflictos } } });
  });

  it("no oculta un error no tipado (p. ej. evento posterior al commit)", async () => {
    reprogramar.mockRejectedValue(new Error("evento no disponible"));
    await expect(consultar({ fecha: "2026-10-07", hora_inicio: "17:00" })).rejects.toThrow("evento no disponible");
  });
});
