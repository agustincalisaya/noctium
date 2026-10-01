import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { listar, opcionesProfesor, permiso, sesion } = vi.hoisted(() => ({
  listar: vi.fn(), opcionesProfesor: vi.fn(), permiso: vi.fn(),
  sesion: { actual: { user: { id: "usuario-g", rol: "GERENTE" } } as { user: { id: string; rol: string } } },
}));
vi.mock("@/server/turnos/turno.service", () => ({ configurarTurno: vi.fn(), listarTurnos: listar, listarOpcionesFiltroProfesor: opcionesProfesor }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: sesion.actual })),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const { GET: GET_PROFESORES } = await import("./filtros/profesores/route");
const contexto = { params: Promise.resolve({}) };
const PROFESOR = "ckprofesor000000000000001";
const consultar = (query = "") => GET(new NextRequest(`http://localhost/api/turnos${query}`), contexto);
const VACIO = { items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 } };

beforeEach(() => {
  vi.clearAllMocks();
  sesion.actual = { user: { id: "usuario-g", rol: "GERENTE" } };
  permiso.mockResolvedValue({});
  listar.mockResolvedValue(VACIO);
});

describe("HU-C-08 GET /api/turnos?profesor_id=", () => {
  it("pasa profesor_id y q al servicio con la sesión, bajo turnos:leer", async () => {
    const respuesta = await consultar(`?pagina=2&q=fisica&profesor_id=${PROFESOR}`);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: VACIO, error: null });
    expect(listar).toHaveBeenCalledWith(2, undefined, sesion.actual.user, { q: "fisica", profesor_id: PROFESOR });
    expect(permiso.mock.calls[0][0].where.rolPermiso_accionPermiso.accionPermiso).toBe("turnos:leer");
  });

  it.each([
    ["profesor_id mal formado", "?profesor_id=no-es-cuid"],
    ["materia_id (excluido por HU-C-02 AC6)", "?materia_id=ckmateria0000000000000001"],
    ["estados", "?estados=CANCELADO"],
    ["solo_futuros", "?solo_futuros=true"],
  ])("400 con %s, sin llamar al servicio", async (_caso, query) => {
    const respuesta = await consultar(query);
    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).error.code).toBe("VALIDACION");
    expect(listar).not.toHaveBeenCalled();
  });

  it.each([
    ["SIN_PERMISO", 403],
    ["PROFESOR_NO_ENCONTRADO", 404],
  ])("traduce %s a %i", async (code, status) => {
    listar.mockRejectedValue(new ServiceError(code, "mensaje"));
    const respuesta = await consultar(`?profesor_id=${PROFESOR}`);
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toEqual({ data: null, error: { code, message: "mensaje" } });
  });
});

describe("HU-C-08 GET /api/turnos/filtros/profesores", () => {
  it.each(["GERENTE", "MESA_ENTRADA"])("%s recibe los profesores activos", async (rol) => {
    sesion.actual = { user: { id: "u", rol } };
    opcionesProfesor.mockResolvedValue([{ id: PROFESOR, nombre: "Laura", apellido: "Giménez" }]);
    const respuesta = await GET_PROFESORES(new NextRequest("http://localhost/api/turnos/filtros/profesores"), contexto);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: [{ id: PROFESOR, nombre: "Laura", apellido: "Giménez" }], error: null });
  });

  it("el Profesor (que también tiene turnos:leer) recibe 403 SIN_PERMISO", async () => {
    sesion.actual = { user: { id: "u", rol: "PROFESOR" } };
    const respuesta = await GET_PROFESORES(new NextRequest("http://localhost/api/turnos/filtros/profesores"), contexto);
    expect(respuesta.status).toBe(403);
    expect((await respuesta.json()).error.code).toBe("SIN_PERMISO");
    expect(opcionesProfesor).not.toHaveBeenCalled();
  });
});
