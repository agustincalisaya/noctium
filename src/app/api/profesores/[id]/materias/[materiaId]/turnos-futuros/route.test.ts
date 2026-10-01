import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

// HU-D-07: GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros (spec §2.7).
const { listar, rol, permisos } = vi.hoisted(() => ({
  listar: vi.fn(), rol: { valor: "MESA_ENTRADA" }, permisos: [] as string[],
}));
vi.mock("@/server/profesores/profesor.service", () => ({ listarTurnosFuturosDeMateria: listar }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (permiso: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
    permisos.push(permiso);
    return (req: NextRequest, ctx: { params: Promise<unknown> }) => rol.valor === "MESA_ENTRADA"
      ? handler(Object.assign(req, { auth: { user: { id: "mesa-1", rol: rol.valor } } }), ctx)
      : NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "Sin permiso" } }, { status: 403 });
  },
}));

const { GET } = await import("./route");
const PROFESOR = "ckprofesor000000000000001";
const MAT = "ckmateria0000000000000001";
const PAGINA = {
  items: [{ turno_id: "t-1", fecha: "2026-10-06", hora_inicio: "10:00", hora_fin: "12:00", aula: "Aula 2", alumnos_inscriptos: "3/5", estado: "DISPONIBLE" }],
  total: 1, pagina: 1, por_pagina: 10,
};

const consultar = (query = "", id = PROFESOR, materiaId = MAT) => GET(
  new NextRequest(`http://localhost/api/profesores/${id}/materias/${materiaId}/turnos-futuros${query}`),
  { params: Promise.resolve({ id, materiaId }) },
);

beforeEach(() => {
  vi.clearAllMocks();
  rol.valor = "MESA_ENTRADA";
  listar.mockResolvedValue(PAGINA);
});

describe("HU-D-07 GET turnos futuros de una materia", () => {
  it("exige profesores:leer y devuelve la página (por defecto 1)", async () => {
    expect(permisos).toContain("profesores:leer");
    const respuesta = await consultar();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: PAGINA, error: null });
    expect(listar).toHaveBeenCalledWith(PROFESOR, MAT, 1);
  });

  it("pasa la página pedida", async () => {
    await consultar("?pagina=2");
    expect(listar).toHaveBeenCalledWith(PROFESOR, MAT, 2);
  });

  it.each([
    ["?pagina=0", PROFESOR, MAT],
    ["?pagina=abc", PROFESOR, MAT],
    ["?por_pagina=50", PROFESOR, MAT],
    ["", "no-es-cuid", MAT],
    ["", PROFESOR, "no-es-cuid"],
  ])("400 VALIDACION (%s, %s, %s)", async (query, id, materiaId) => {
    const respuesta = await consultar(query, id, materiaId);
    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).error.code).toBe("VALIDACION");
    expect(listar).not.toHaveBeenCalled();
  });

  it.each(["PROFESOR_NO_ENCONTRADO", "MATERIA_NO_ENCONTRADA"])("%s → 404", async (codigo) => {
    listar.mockRejectedValue(new ServiceError(codigo, "x"));
    const respuesta = await consultar();
    expect(respuesta.status).toBe(404);
    expect((await respuesta.json()).error.code).toBe(codigo);
  });

  it("403 sin permiso (Gerente)", async () => {
    rol.valor = "GERENTE";
    expect((await consultar()).status).toBe(403);
  });
});
