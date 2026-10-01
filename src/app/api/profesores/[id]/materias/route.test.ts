import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

// HU-D-07: PUT /api/profesores/[id]/materias (spec_modulo_D.md §2.7).
const { actualizar, rol, permisos } = vi.hoisted(() => ({
  actualizar: vi.fn(), rol: { valor: "MESA_ENTRADA" }, permisos: [] as string[],
}));
vi.mock("@/server/profesores/profesor.service", () => ({
  actualizarMateriasDeProfesor: actualizar,
  asociarMateriasAProfesor: vi.fn(),
}));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (permiso: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
    permisos.push(permiso);
    return (req: NextRequest, ctx: { params: Promise<unknown> }) => rol.valor === "MESA_ENTRADA"
      ? handler(Object.assign(req, { auth: { user: { id: "mesa-1", rol: rol.valor } } }), ctx)
      : NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "Sin permiso" } }, { status: 403 });
  },
}));

const { PUT } = await import("./route");
const PROFESOR = "ckprofesor000000000000001";
const MAT = "ckmateria0000000000000001";
const FIS = "ckmateria0000000000000002";

const enviar = (body: unknown, id = PROFESOR) => PUT(new NextRequest(`http://localhost/api/profesores/${id}/materias`, {
  method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "Content-Type": "application/json" },
}), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  rol.valor = "MESA_ENTRADA";
  actualizar.mockResolvedValue({ agregadas: [MAT], quitadas: [], pendientes_afectados: 0, sin_cambios: false });
});

describe("HU-D-07 PUT materias del profesor", () => {
  it("exige profesores:editar y responde 200 con el sobre estándar", async () => {
    expect(permisos).toContain("profesores:editar");
    const respuesta = await enviar({ materia_ids: [MAT] });
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({
      data: { agregadas: [MAT], quitadas: [], pendientes_afectados: 0, sin_cambios: false }, error: null,
    });
    expect(actualizar).toHaveBeenCalledExactlyOnceWith(PROFESOR, [MAT], "mesa-1");
  });

  it.each([
    { materia_ids: [MAT, MAT] },
    { materia_ids: ["123"] },
    { materiaIds: [MAT] },
    { materia_ids: [], version: 2 },
  ])("400 VALIDACION sin llamar al servicio: %j", async (body) => {
    const respuesta = await enviar(body);
    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).error.code).toBe("VALIDACION");
    expect(actualizar).not.toHaveBeenCalled();
  });

  it("400 con id de profesor inválido y con body no JSON", async () => {
    expect((await enviar({ materia_ids: [] }, "no-es-cuid")).status).toBe(400);
    const respuesta = await enviar("{no json");
    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).error.code).toBe("BODY_INVALIDO");
  });

  it("409 MATERIA_CON_TURNOS_FUTUROS con el literal de la HU y el detalle por materia", async () => {
    actualizar.mockRejectedValue(new ServiceError("MATERIA_CON_TURNOS_FUTUROS", "x", { detalle: [{ materia_id: MAT, cantidad: 3 }] }));
    const respuesta = await enviar({ materia_ids: [] });
    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toEqual({
      data: null,
      error: {
        code: "MATERIA_CON_TURNOS_FUTUROS",
        message: "No se puede quitar: el profesor tiene 3 turnos futuros de esta materia",
        detalle: [{ materia_id: MAT, cantidad: 3 }],
      },
    });
  });

  it("con varias bloqueadas el mensaje es general y el detalle trae cada N", async () => {
    const detalle = [{ materia_id: MAT, cantidad: 3 }, { materia_id: FIS, cantidad: 4 }];
    actualizar.mockRejectedValue(new ServiceError("MATERIA_CON_TURNOS_FUTUROS", "x", { detalle }));
    const { error } = await (await enviar({ materia_ids: [] })).json();
    expect(error.detalle).toEqual(detalle);
    expect(error.message).toBe("No se pueden quitar algunas materias: el profesor tiene turnos futuros de ellas");
  });

  it("409 MATERIA_INACTIVA con materia_ids_invalidas (snake_case)", async () => {
    actualizar.mockRejectedValue(new ServiceError("MATERIA_INACTIVA", "x", { materias: [{ id: MAT, nombre: "Historia de la Ciencia" }] }));
    const respuesta = await enviar({ materia_ids: [MAT] });
    expect(respuesta.status).toBe(409);
    expect((await respuesta.json()).error).toEqual({
      code: "MATERIA_INACTIVA",
      message: "La materia 'Historia de la Ciencia' ya no está activa",
      materia_ids_invalidas: [MAT],
    });
  });

  it.each([
    ["PROFESOR_NO_ENCONTRADO", 404], ["MATERIA_NO_ENCONTRADA", 404],
    ["PROFESOR_INACTIVO", 409], ["MATERIA_YA_ASOCIADA", 409],
  ])("%s → %i", async (codigo, status) => {
    actualizar.mockRejectedValue(new ServiceError(codigo, "x"));
    const respuesta = await enviar({ materia_ids: [MAT] });
    expect(respuesta.status).toBe(status);
    expect((await respuesta.json()).error.code).toBe(codigo);
  });

  it("error inesperado → 500 sin detalle técnico", async () => {
    actualizar.mockRejectedValue(new Error("SQL roto"));
    const respuesta = await enviar({ materia_ids: [MAT] });
    expect(respuesta.status).toBe(500);
    expect(JSON.stringify(await respuesta.json())).not.toContain("SQL");
  });

  it("403 sin permiso", async () => {
    rol.valor = "GERENTE";
    expect((await enviar({ materia_ids: [MAT] })).status).toBe(403);
    expect(actualizar).not.toHaveBeenCalled();
  });
});
