import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { opciones, rol, accion } = vi.hoisted(() => ({ opciones: vi.fn(), rol: { valor: "MESA_ENTRADA" }, accion: { valor: "" } }));
vi.mock("@/server/turnos/turno.reprogramacion.service", () => ({ opcionesReprogramacion: opciones }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (permiso: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
    accion.valor = permiso;
    return (req: NextRequest, ctx: { params: Promise<unknown> }) => rol.valor === "MESA_ENTRADA"
      ? handler(Object.assign(req, { auth: { user: { id: "mesa-1", rol: rol.valor } } }), ctx)
      : NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "Sin permiso" } }, { status: 403 });
  },
}));

const { GET } = await import("./route");
const consultar = (query: string, id = "turno-1") => GET(new NextRequest(`http://localhost/api/turnos/${id}/reprogramacion/opciones${query}`), { params: Promise.resolve({ id }) });
const DATA = { fecha: "2026-10-07", duracion_min: 60, tope_fecha: "2026-10-31", inicios: [{ hora_inicio: "17:00", hora_fin: "18:00", actual: false }] };

beforeEach(() => { vi.clearAllMocks(); rol.valor = "MESA_ENTRADA"; opciones.mockResolvedValue(DATA); });

describe("HU-C-06 GET reprogramacion/opciones", () => {
  it("exige turnos:reprogramar y responde 200", async () => {
    expect(accion.valor).toBe("turnos:reprogramar");
    const response = await consultar("?fecha=2026-10-07");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: DATA, error: null });
    expect(opciones).toHaveBeenCalledExactlyOnceWith("turno-1", new Date("2026-10-07T00:00:00.000Z"));
  });

  it.each(["", "?fecha=2026-02-30", "?fecha=2026-10-07&hora=10:00"])("400 VALIDATION_ERROR para la query «%s»", async (query) => {
    const response = await consultar(query);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(opciones).not.toHaveBeenCalled();
  });

  it.each(["FECHA_PASADA", "ANTICIPACION_EXCEDIDA", "DIA_NO_OPERATIVO"])("%s → 400 con detalles.motivo", async (motivo) => {
    opciones.mockRejectedValue(new ServiceError(motivo, "Mensaje"));
    const response = await consultar("?fecha=2026-10-07");
    expect(response.status).toBe(400);
    expect((await response.json()).error).toEqual({ code: "VALIDATION_ERROR", message: "Mensaje", detalles: { motivo } });
  });

  it.each([["TURNO_NO_ENCONTRADO", 404], ["TURNO_PENDIENTE", 409], ["TURNO_CANCELADO", 409], ["TURNO_VENCIDO", 409]] as const)("%s → %i", async (code, status) => {
    opciones.mockRejectedValue(new ServiceError(code, "Error"));
    expect((await consultar("?fecha=2026-10-07")).status).toBe(status);
  });

  it.each(["GERENTE", "PROFESOR"])("403 para %s", async (valor) => {
    rol.valor = valor;
    expect((await consultar("?fecha=2026-10-07")).status).toBe(403);
    expect(opciones).not.toHaveBeenCalled();
  });
});
