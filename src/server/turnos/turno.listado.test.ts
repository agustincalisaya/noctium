import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { turno, usuario, limite } = vi.hoisted(() => ({
  turno: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  usuario: { findUnique: vi.fn() },
  limite: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { turno, usuario } }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: limite }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: vi.fn() }));
vi.mock("@/server/profesores/profesor.service", () => ({ profesorActivoDictaMateria: vi.fn(), estaDentroDeHorarioAtencion: vi.fn(), intervalosSeSuperponen: vi.fn(), listarProfesoresActivosPorMateria: vi.fn() }));
vi.mock("@/server/alumnos/alumno.service", () => ({ verificarAlumnoActivo: vi.fn() }));
vi.mock("./turno.validaciones", () => ({ turnoSigueVigente: vi.fn(), validarConfiguracionTurno: vi.fn() }));

const { listarTurnos, obtenerTurno } = await import("./turno.service");
const mesa = { id: "usuario-1", rol: "MESA_ENTRADA" as const };
const registro = (estadoTurno: "PENDIENTE" | "DISPONIBLE" | "COMPLETO", cantidad: number) => ({
  idTurno: `turno-${estadoTurno}`, fechaTurno: new Date("2026-10-01T00:00:00.000Z"),
  horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60,
  // Revisión 3: sin aula no hay cupo.
  cupoMaximoTurno: estadoTurno === "PENDIENTE" ? null : 5, estadoTurno, profesorId: estadoTurno === "PENDIENTE" ? null : "profesor-1",
  profesor: estadoTurno === "PENDIENTE" ? null : { apellidoProfesor: "Gómez", nombreProfesor: "Ana", dniProfesor: "123" },
  materiaId: "materia-1", materia: { nombreMateria: "Física", codigoMateria: "FIS" },
  aulaId: estadoTurno === "PENDIENTE" ? null : "aula-1",
  aula: estadoTurno === "PENDIENTE" ? null : { nombreAula: "Aula 1", capacidadAula: 10 },
  alumnos: Array.from({ length: cantidad }, (_, i) => ({ alumno: { idAlumno: `alumno-${i}`, apellidoAlumno: "Pérez", nombreAlumno: `N${i}`, dniAlumno: `${i}` } })),
  createdAtTurno: new Date("2026-09-24T12:00:00.000Z"), updatedAtTurno: new Date("2026-09-24T12:00:00.000Z"),
  creadoPorUsuarioId: "usuario-1", modificadoPorUsuarioId: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-24T15:00:00.000Z"));
  limite.mockResolvedValue(2);
  turno.count.mockResolvedValue(3);
  turno.findMany.mockResolvedValue([registro("PENDIENTE", 0), registro("DISPONIBLE", 3), registro("COMPLETO", 5)]);
  turno.findFirst.mockResolvedValue(registro("DISPONIBLE", 3));
  usuario.findUnique.mockResolvedValue({ emailUsuario: "mesa@example.com" });
});
afterEach(() => vi.useRealTimers());

describe("HU-C-01 listado y detalle", () => {
  it("presenta los tres estados, ocupación y datos faltantes", async () => {
    const resultado = await listarTurnos(1, undefined, mesa);
    expect(resultado.items.map((item) => [item.estado, item.alumnos_inscriptos])).toEqual([
      ["PENDIENTE", "Sin asignar"], ["DISPONIBLE", "3/5"], ["COMPLETO", "5/5"],
    ]);
    expect(resultado.items[0]).toMatchObject({ profesor: "Sin asignar", aula: "Sin asignar", cupo_maximo: null, hora_inicio: "10:00", hora_fin: "11:00" });
    expect(resultado.items[1]).toMatchObject({ profesor: "Gómez, Ana", materia: "Física", aula: "Aula 1" });
  });

  it("filtra desde hoy, ordena con desempates estables y pagina según el límite", async () => {
    const resultado = await listarTurnos(2, undefined, mesa);
    expect(turno.count).toHaveBeenCalledWith({ where: { fechaTurno: { gte: new Date("2026-09-24T00:00:00.000Z") } } });
    expect(turno.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { profesorId: { sort: "asc", nulls: "last" } }, { idTurno: "asc" }],
      skip: 2, take: 2,
    }));
    expect(resultado.paginacion).toEqual({ total: 3, pagina_actual: 2, total_paginas: 2, por_pagina: 2 });
  });

  it("el detalle conserva alumnos, estado y usuario creador", async () => {
    const resultado = await obtenerTurno("turno-DISPONIBLE", mesa);
    expect(resultado).toMatchObject({ estado: "DISPONIBLE", alumnos_inscriptos: "3/5", creado_en: "2026-09-24T12:00:00.000Z", creado_por: "mesa@example.com" });
    expect(resultado?.alumnos).toHaveLength(3);
  });
});

describe("HU-C-02 búsqueda en el listado", () => {
  const base = { fechaTurno: { gte: new Date("2026-09-24T00:00:00.000Z") } };
  const orderBy = [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { profesorId: { sort: "asc", nulls: "last" } }, { idTurno: "asc" }];

  it.each([["sin filtros", undefined], ["con filtros vacíos", {}], ["con q de un carácter", { q: "a" }], ["con q en blanco", { q: "   " }]])(
    "%s el where es el de HU-C-01", async (_caso, filtros) => {
      await listarTurnos(1, undefined, mesa, filtros);
      expect(turno.count).toHaveBeenCalledWith({ where: base });
      expect(turno.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: base, orderBy }));
    });

  it("con q, count y findMany reciben el mismo where con la búsqueda y el orden original", async () => {
    await listarTurnos(1, undefined, mesa, { q: "sofia matematica" });
    const where = turno.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ ...base, AND: [{ AND: [expect.objectContaining({ OR: expect.any(Array) }), expect.objectContaining({ OR: expect.any(Array) })] }] });
    expect(turno.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, orderBy }));
  });

  it("para el rol PROFESOR la búsqueda se suma a su alcance", async () => {
    await listarTurnos(1, undefined, { id: "usuario-prof", rol: "PROFESOR" }, { q: "fisica" });
    const where = turno.count.mock.calls[0][0].where;
    expect(where.profesor).toEqual({ is: { usuarioId: "usuario-prof" } });
    expect(where.fechaTurno).toEqual(base.fechaTurno);
    expect(where.AND).toHaveLength(1);
  });

  it("el total y las páginas salen del conteo filtrado", async () => {
    turno.count.mockResolvedValue(5);
    const resultado = await listarTurnos(9, undefined, mesa, { q: "rossi" });
    expect(resultado.paginacion).toEqual({ total: 5, pagina_actual: 3, total_paginas: 3, por_pagina: 2 });
    expect(turno.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 4, take: 2 }));
  });

  it("sin coincidencias devuelve la página 1 vacía", async () => {
    turno.count.mockResolvedValue(0);
    turno.findMany.mockResolvedValue([]);
    const resultado = await listarTurnos(3, undefined, mesa, { q: "mendez" });
    expect(resultado).toEqual({ items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 2 } });
  });
});
