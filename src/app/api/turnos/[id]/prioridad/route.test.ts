import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { actualizar, rol, accion } = vi.hoisted(() => ({
  actualizar: vi.fn(), rol: { valor: "MESA_ENTRADA" }, accion: { valor: "" },
}));
vi.mock("@/server/turnos/turno.service", () => ({ actualizarPrioridadTurno: actualizar }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (permiso: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
    accion.valor = permiso;
    return (req: NextRequest, ctx: { params: Promise<unknown> }) => rol.valor === "MESA_ENTRADA"
      ? handler(Object.assign(req, { auth: { user: { id: "mesa-1", rol: rol.valor } } }), ctx)
      : NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "Sin permiso" } }, { status: 403 });
  },
}));

const { PATCH } = await import("./route");
const consultar = (body: unknown, id = "turno-1") => PATCH(new NextRequest(`http://localhost/api/turnos/${id}/prioridad`, {
  method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
}), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  rol.valor = "MESA_ENTRADA";
  actualizar.mockResolvedValue({ id: "turno-1", prioridad: "ALTA" });
});

describe("HU-C-10 PATCH prioridad", () => {
  it("exige turnos:priorizar y responde 200 con sobre estándar", async () => {
    expect(accion.valor).toBe("turnos:priorizar");
    const response = await consultar({ prioridad: "ALTA" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { id: "turno-1", prioridad: "ALTA" }, error: null });
    expect(actualizar).toHaveBeenCalledExactlyOnceWith("turno-1", { prioridad: "ALTA" }, "mesa-1");
  });

  it.each([null, {}, { prioridad: "CRITICA" }, { prioridad: "ALTA", extra: true }])
  ("rechaza cuerpo inválido y no invoca el servicio", async (body) => {
    const response = await consultar(body);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(actualizar).not.toHaveBeenCalled();
  });

  it("responde 403 al rol sin permiso", async () => {
    rol.valor = "GERENTE";
    const response = await consultar({ prioridad: "ALTA" });
    expect(response.status).toBe(403);
    expect(actualizar).not.toHaveBeenCalled();
  });

  it.each([["TURNO_NO_ENCONTRADO", 404], ["TURNO_CANCELADO", 409], ["TURNO_MODIFICADO", 409]] as const)
  ("traduce %s a HTTP %i", async (code, status) => {
    actualizar.mockRejectedValue(new ServiceError(code, "Error del turno"));
    const response = await consultar({ prioridad: "URGENTE" });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ data: null, error: { code, message: "Error del turno" } });
  });
});
