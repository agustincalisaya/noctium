import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { cancelar, rol, accion } = vi.hoisted(() => ({
  cancelar: vi.fn(), rol: { valor: "MESA_ENTRADA" }, accion: { valor: "" },
}));
vi.mock("@/server/turnos/turno.cancelacion.service", () => ({ cancelarTurno: cancelar }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (permiso: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
    accion.valor = permiso;
    return (req: NextRequest, ctx: { params: Promise<unknown> }) => rol.valor === "MESA_ENTRADA"
      ? handler(Object.assign(req, { auth: { user: { id: "mesa-1", rol: rol.valor } } }), ctx)
      : NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "Sin permiso" } }, { status: 403 });
  },
}));

const { POST } = await import("./route");
const consultar = (id = "turno-1") => POST(new NextRequest(`http://localhost/api/turnos/${id}/cancelacion`, { method: "POST" }), {
  params: Promise.resolve({ id }),
});

beforeEach(() => {
  vi.clearAllMocks();
  rol.valor = "MESA_ENTRADA";
  cancelar.mockResolvedValue({ id: "turno-1", estado: "CANCELADO" });
});

describe("HU-C-05 POST cancelacion", () => {
  it("exige turnos:cancelar y responde 200 con sobre estándar", async () => {
    expect(accion.valor).toBe("turnos:cancelar");
    const response = await consultar();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { id: "turno-1", estado: "CANCELADO" }, error: null });
    expect(cancelar).toHaveBeenCalledExactlyOnceWith("turno-1", "mesa-1");
  });

  it("acepta ids de seed no CUID", async () => {
    await consultar("seed-turno-01");
    expect(cancelar).toHaveBeenCalledExactlyOnceWith("seed-turno-01", "mesa-1");
  });

  it.each(["GERENTE", "PROFESOR", "ALUMNO"])("responde 403 al rol %s sin invocar el servicio", async (valor) => {
    rol.valor = valor;
    const response = await consultar();
    expect(response.status).toBe(403);
    expect(cancelar).not.toHaveBeenCalled();
  });

  it.each([
    ["TURNO_NO_ENCONTRADO", 404], ["TURNO_CANCELADO", 409], ["TURNO_VENCIDO", 409], ["TURNO_MODIFICADO", 409],
  ] as const)("traduce %s a HTTP %i", async (code, status) => {
    cancelar.mockRejectedValue(new ServiceError(code, "Error del turno"));
    const response = await consultar();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ data: null, error: { code, message: "Error del turno" } });
  });

  it("no oculta un error no tipado (p. ej. el evento posterior al commit)", async () => {
    cancelar.mockRejectedValue(new Error("evento no disponible"));
    await expect(consultar()).rejects.toThrow("evento no disponible");
  });
});
