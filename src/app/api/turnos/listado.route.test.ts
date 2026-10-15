import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { listar, opcionesProfesor, permiso, sesion } = vi.hoisted(() => ({
  listar: vi.fn(), opcionesProfesor: vi.fn(), permiso: vi.fn(),
  sesion: { actual: { user: { id: "usuario-g", rol: "GERENTE" } } as { user: { id: string; rol: string } } },
}));
vi.mock("@/server/turnos/turno.service", () => ({ configurarTurno: vi.fn(), listarTurnos: listar, listarOpcionesFiltroProfesor: opcionesProfesor }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso }, usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) } } }));
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
    expect(listar).toHaveBeenCalledWith(2, undefined, sesion.actual.user, { q: "fisica", profesor_id: PROFESOR, periodo: undefined, desde: undefined, hasta: undefined, materia_id: undefined });
    expect(permiso.mock.calls[0][0].where.rolPermiso_accionPermiso.accionPermiso).toBe("turnos:leer");
  });

  it.each([
    ["profesor_id mal formado", "?profesor_id=no-es-cuid"],
    ["estados", "?estados=CANCELADO"],
    ["solo_futuros", "?solo_futuros=true"],
  ])("400 con %s, sin llamar al servicio", async (_caso, query) => {
    const respuesta = await consultar(query);
    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).error.code).toBe("VALIDACION");
    expect(listar).not.toHaveBeenCalled();
  });

  it("el Profesor consulta con su sesión: el servicio recibe al usuario, nunca un profesor elegido por la ruta", async () => {
    sesion.actual = { user: { id: "usuario-prof", rol: "PROFESOR" } };
    const respuesta = await consultar("?periodo=todas");
    expect(respuesta.status).toBe(200);
    expect(listar).toHaveBeenCalledWith(1, undefined, { id: "usuario-prof", rol: "PROFESOR" }, expect.objectContaining({ profesor_id: undefined, periodo: "todas" }));
  });

  it("el Profesor con un profesor_id ajeno recibe 403 sin datos", async () => {
    sesion.actual = { user: { id: "usuario-prof", rol: "PROFESOR" } };
    listar.mockRejectedValue(new ServiceError("SIN_PERMISO", "mensaje"));
    const respuesta = await consultar(`?profesor_id=${PROFESOR}`);
    expect(respuesta.status).toBe(403);
    expect((await respuesta.json()).data).toBeNull();
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

describe("HU-C-27 GET /api/turnos con período, rango y materia", () => {
  const MATERIA = "ckmateria0000000000000001";

  it("pasa período, materia, búsqueda y profesor al servicio", async () => {
    const respuesta = await consultar(`?periodo=anteriores&materia_id=${MATERIA}&q=fisica&profesor_id=${PROFESOR}`);
    expect(respuesta.status).toBe(200);
    expect(listar).toHaveBeenCalledWith(1, undefined, sesion.actual.user, { q: "fisica", profesor_id: PROFESOR, periodo: "anteriores", desde: undefined, hasta: undefined, materia_id: MATERIA });
  });

  it("pasa el rango (una o dos fechas) sin período", async () => {
    await consultar("?desde=2026-10-01&hasta=2026-10-13");
    await consultar("?hasta=2026-10-13");
    expect(listar.mock.calls.map((llamada) => llamada[3])).toEqual([
      expect.objectContaining({ periodo: undefined, desde: "2026-10-01", hasta: "2026-10-13" }),
      expect.objectContaining({ periodo: undefined, desde: undefined, hasta: "2026-10-13" }),
    ]);
  });

  it("Desde posterior a Hasta → 400 con el error en `desde`, sin llamar al servicio", async () => {
    const respuesta = await consultar("?desde=2026-10-20&hasta=2026-10-01");
    expect(respuesta.status).toBe(400);
    const cuerpo = await respuesta.json();
    expect(cuerpo.error.code).toBe("VALIDACION");
    expect(cuerpo.error.detalles.fieldErrors.desde).toEqual(["La fecha Desde no puede ser posterior a Hasta"]);
    expect(listar).not.toHaveBeenCalled();
  });

  it.each([
    ["período inválido", "?periodo=ayer"],
    ["fecha inválida", "?desde=2026-02-30"],
    ["período junto con rango", "?periodo=hoy&hasta=2026-10-13"],
    ["materia_id mal formado", "?materia_id=no-es-cuid"],
    ["orden (ya no existe)", "?orden=fecha_hora_asc"],
  ])("400 con %s, sin llamar al servicio", async (_caso, query) => {
    const respuesta = await consultar(query);
    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).error.code).toBe("VALIDACION");
    expect(listar).not.toHaveBeenCalled();
  });

  it("materia inexistente (VALIDACION del servicio) → 400", async () => {
    listar.mockRejectedValue(new ServiceError("VALIDACION", "La materia elegida no existe"));
    const respuesta = await consultar(`?materia_id=${MATERIA}`);
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({ data: null, error: { code: "VALIDACION", message: "La materia elegida no existe" } });
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
