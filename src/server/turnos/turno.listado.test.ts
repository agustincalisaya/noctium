import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { turno, usuario, profesor, limite, materiasPublico } = vi.hoisted(() => ({
  turno: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  usuario: { findUnique: vi.fn() },
  profesor: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  limite: vi.fn(),
  materiasPublico: { obtenerMateriasPorIds: vi.fn(), listarMateriasParaFiltroDeClases: vi.fn(), obtenerTarifasPorIds: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { turno, usuario, profesor } }));
vi.mock("@/server/materias/materia.publico", () => materiasPublico);
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: limite }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: vi.fn() }));
vi.mock("@/server/profesores/profesor.service", () => ({ profesorActivoDictaMateria: vi.fn(), estaDentroDeHorarioAtencion: vi.fn(), intervalosSeSuperponen: vi.fn(), listarProfesoresActivosPorMateria: vi.fn() }));
vi.mock("@/server/alumnos/alumno.service", () => ({ verificarAlumnoActivo: vi.fn() }));
vi.mock("./turno.validaciones", () => ({ turnoSigueVigente: vi.fn(), validarConfiguracionTurno: vi.fn() }));

const { listarOpcionesFiltroMateria, listarOpcionesFiltroProfesor, listarTurnos, obtenerTurno } = await import("./turno.service");
const { conReloj } = await import("@/server/shared/reloj");
// Reloj del sistema: 2026-09-24 12:00 en el centro. Sin período, el listado es «hoy».
const HOY = new Date("2026-09-24T00:00:00.000Z");
const PROFESOR_PROPIO = "cmprofesorpropio0000000001";
const PROFESOR_AJENO = "cmprofesorajeno00000000001";
const fichaProfesor = (idProfesor: string) => ({ idProfesor, apellidoProfesor: "Giménez", nombreProfesor: "Laura" });
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
  materiasPublico.obtenerMateriasPorIds.mockImplementation(async (ids: string[]) => ids.map((id) => ({ id, nombre: "Física", codigo: "FIS", activa: true })));
  materiasPublico.listarMateriasParaFiltroDeClases.mockResolvedValue([]);
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

  it("sin período filtra las clases de hoy (HU-C-27), ordena con desempates estables y pagina según el límite", async () => {
    const resultado = await listarTurnos(2, undefined, mesa);
    expect(turno.count).toHaveBeenCalledWith({ where: { fechaTurno: HOY } });
    expect(turno.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { profesorId: { sort: "asc", nulls: "last" } }, { idTurno: "asc" }],
      skip: 2, take: 2,
    }));
    expect(resultado.paginacion).toEqual({ total: 3, pagina_actual: 2, total_paginas: 2, por_pagina: 2 });
  });

  it("el detalle conserva alumnos, estado y usuario creador", async () => {
    const resultado = await obtenerTurno("turno-DISPONIBLE", mesa);
    expect(resultado).toMatchObject({ resultado: "ok", turno: { estado: "DISPONIBLE", alumnos_inscriptos: "3/5", creado_en: "2026-09-24T12:00:00.000Z", creado_por: "mesa@example.com" } });
    expect(resultado.resultado === "ok" && resultado.turno.alumnos).toHaveLength(3);
  });
});

describe("HU-C-02 búsqueda en el listado", () => {
  const base = { fechaTurno: HOY };
  const orderBy = [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { profesorId: { sort: "asc", nulls: "last" } }, { idTurno: "asc" }];

  it.each([["sin filtros", undefined], ["con filtros vacíos", {}], ["con q de un carácter", { q: "a" }], ["con q en blanco", { q: "   " }]])(
    "%s el where es el del período por defecto", async (_caso, filtros) => {
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
    profesor.findUnique.mockResolvedValue(fichaProfesor(PROFESOR_PROPIO));
    await listarTurnos(1, undefined, { id: "usuario-prof", rol: "PROFESOR" }, { q: "fisica" });
    const where = turno.count.mock.calls[0][0].where;
    expect(where.profesorId).toBe(PROFESOR_PROPIO);
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

describe("HU-C-08 filtro por profesor (spec §2.7)", () => {
  const profesorRol = { id: "usuario-prof", rol: "PROFESOR" as const };
  const gerente = { id: "usuario-g", rol: "GERENTE" as const };
  const desdeHoy = HOY;

  it("Gerente y Mesa filtran por un profesor activo, en cualquier estado y con el mismo orden", async () => {
    profesor.findFirst.mockResolvedValue(fichaProfesor(PROFESOR_AJENO));
    for (const usuarioListado of [gerente, mesa]) {
      vi.clearAllMocks();
      turno.count.mockResolvedValue(3);
      turno.findMany.mockResolvedValue([]);
      profesor.findFirst.mockResolvedValue(fichaProfesor(PROFESOR_AJENO));
      await listarTurnos(1, undefined, usuarioListado, { profesor_id: PROFESOR_AJENO });
      expect(profesor.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { idProfesor: PROFESOR_AJENO, activoProfesor: true } }));
      // Sin condición de estado: PENDIENTE, DISPONIBLE, COMPLETO y CANCELADO (AC3).
      expect(turno.count).toHaveBeenCalledWith({ where: { fechaTurno: desdeHoy, profesorId: PROFESOR_AJENO } });
    }
  });

  it("se combina con la búsqueda y con la paginación", async () => {
    profesor.findFirst.mockResolvedValue(fichaProfesor(PROFESOR_AJENO));
    turno.count.mockResolvedValue(5);
    const resultado = await listarTurnos(2, undefined, gerente, { q: "fisica", profesor_id: PROFESOR_AJENO });
    const where = turno.count.mock.calls[0][0].where;
    expect(where.profesorId).toBe(PROFESOR_AJENO);
    expect(where.AND).toHaveLength(1);
    expect(turno.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 2, take: 2 }));
    expect(resultado.paginacion).toEqual({ total: 5, pagina_actual: 2, total_paginas: 3, por_pagina: 2 });
  });

  it("Gerente/Mesa: profesor inexistente o inactivo → PROFESOR_NO_ENCONTRADO, sin consultar turnos", async () => {
    profesor.findFirst.mockResolvedValue(null);
    await expect(listarTurnos(1, undefined, mesa, { profesor_id: PROFESOR_AJENO })).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
    expect(turno.count).not.toHaveBeenCalled();
  });

  it("el Profesor ve solo sus turnos; su propio profesor_id equivale a no enviarlo", async () => {
    profesor.findUnique.mockResolvedValue(fichaProfesor(PROFESOR_PROPIO));
    await listarTurnos(1, undefined, profesorRol);
    await listarTurnos(1, undefined, profesorRol, { profesor_id: PROFESOR_PROPIO });
    expect(turno.count.mock.calls.map(([argumento]) => argumento)).toEqual([
      { where: { fechaTurno: desdeHoy, profesorId: PROFESOR_PROPIO } },
      { where: { fechaTurno: desdeHoy, profesorId: PROFESOR_PROPIO } },
    ]);
    expect(profesor.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { usuarioId: "usuario-prof" } }));
    expect(profesor.findFirst).not.toHaveBeenCalled();
  });

  it("el Profesor con un profesor_id ajeno (o inexistente) recibe SIN_PERMISO, sin revelar si existe", async () => {
    profesor.findUnique.mockResolvedValue(fichaProfesor(PROFESOR_PROPIO));
    await expect(listarTurnos(1, undefined, profesorRol, { profesor_id: PROFESOR_AJENO })).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(profesor.findFirst).not.toHaveBeenCalled();
    expect(turno.count).not.toHaveBeenCalled();
  });

  it("Gerente y Mesa sin profesor_id ven las clases de todos los profesores, sin consultar fichas", async () => {
    for (const usuarioListado of [gerente, mesa]) {
      vi.clearAllMocks();
      turno.count.mockResolvedValue(3);
      turno.findMany.mockResolvedValue([]);
      await listarTurnos(1, undefined, usuarioListado);
      expect(turno.count).toHaveBeenCalledWith({ where: { fechaTurno: desdeHoy } });
      expect(profesor.findUnique).not.toHaveBeenCalled();
    }
  });

  it("el Profesor nunca obtiene clases ajenas: el alcance sale de la sesión y pisa cualquier otro filtro", async () => {
    profesor.findUnique.mockResolvedValue(fichaProfesor(PROFESOR_PROPIO));
    await listarTurnos(1, undefined, profesorRol, { q: "fisica", periodo: "todas", materia_id: "cmmateria0000000000000001" });
    const where = turno.count.mock.calls[0][0].where;
    expect(where.profesorId).toBe(PROFESOR_PROPIO);
    expect(turno.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  it("una cuenta de Profesor sin ficha recibe SIN_PERMISO", async () => {
    profesor.findUnique.mockResolvedValue(null);
    await expect(listarTurnos(1, undefined, profesorRol)).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });

  it("opciones del selector: profesores activos con nombre y apellido, en el orden del Módulo D", async () => {
    profesor.findMany.mockResolvedValue([
      { idProfesor: "p1", apellidoProfesor: "Giménez", nombreProfesor: "Laura" },
      { idProfesor: "p2", apellidoProfesor: "Rossi", nombreProfesor: "Marco" },
    ]);
    await expect(listarOpcionesFiltroProfesor()).resolves.toEqual([
      { id: "p1", nombre: "Laura", apellido: "Giménez" }, { id: "p2", nombre: "Marco", apellido: "Rossi" },
    ]);
    expect(profesor.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { activoProfesor: true } }));
  });
});

describe("HU-C-27 período, rango y materia", () => {
  const orden = (direccion: "asc" | "desc") => [{ fechaTurno: direccion }, { horaInicioTurno: direccion }, { profesorId: { sort: "asc", nulls: "last" } }, { idTurno: "asc" }];
  const MATERIA = "cmmateria00000000000000001";
  // conReloj fija el reloj del dominio en otro día que el del sistema (24/09):
  // así se prueba que el corte sale de ahora() y no de new Date().
  const listarEl = (instante: string, ...args: Parameters<typeof listarTurnos>) => conReloj(new Date(instante), () => listarTurnos(...args));

  it.each([
    ["anteriores", { fechaTurno: { lt: new Date("2026-10-13T00:00:00.000Z") } }, "desc"],
    ["hoy", { fechaTurno: new Date("2026-10-13T00:00:00.000Z") }, "asc"],
    ["proximas", { fechaTurno: { gte: new Date("2026-10-14T00:00:00.000Z") } }, "asc"],
    ["todas", {}, "asc"],
  ] as const)("periodo=%s corta por el día del centro según ahora() y ordena %s", async (periodo, where, direccion) => {
    await listarEl("2026-10-13T15:00:00.000Z", 1, undefined, mesa, { periodo });
    expect(turno.count).toHaveBeenCalledWith({ where });
    expect(turno.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, orderBy: orden(direccion) }));
  });

  it("corta a medianoche del centro (UTC−3), no a la de UTC", async () => {
    await listarEl("2026-10-14T02:59:00.000Z", 1, undefined, mesa, { periodo: "hoy" });
    await listarEl("2026-10-14T03:00:00.000Z", 1, undefined, mesa, { periodo: "hoy" });
    expect(turno.count.mock.calls.map(([argumento]) => argumento.where.fechaTurno)).toEqual([
      new Date("2026-10-13T00:00:00.000Z"), new Date("2026-10-14T00:00:00.000Z"),
    ]);
  });

  it.each([
    ["ambas fechas", { desde: "2026-10-01", hasta: "2026-10-13" }, { gte: new Date("2026-10-01T00:00:00.000Z"), lte: new Date("2026-10-13T00:00:00.000Z") }],
    ["solo desde", { desde: "2026-10-01" }, { gte: new Date("2026-10-01T00:00:00.000Z") }],
    ["solo hasta", { hasta: "2026-10-13" }, { lte: new Date("2026-10-13T00:00:00.000Z") }],
  ])("rango con %s, inclusive y en orden ascendente", async (_caso, filtros, fechaTurno) => {
    await listarTurnos(1, undefined, mesa, filtros);
    expect(turno.count).toHaveBeenCalledWith({ where: { fechaTurno } });
    expect(turno.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: orden("asc") }));
  });

  it.each([
    ["período y rango juntos", { periodo: "hoy" as const, desde: "2026-10-01" }],
    ["Desde posterior a Hasta", { desde: "2026-10-20", hasta: "2026-10-01" }],
  ])("%s → VALIDACION sin consultar (defensa en profundidad)", async (_caso, filtros) => {
    await expect(listarTurnos(1, undefined, mesa, filtros)).rejects.toMatchObject({ code: "VALIDACION" });
    expect(turno.count).not.toHaveBeenCalled();
  });

  it("materia existente se suma al where; inexistente → VALIDACION sin contar", async () => {
    await listarTurnos(1, undefined, mesa, { materia_id: MATERIA });
    expect(materiasPublico.obtenerMateriasPorIds).toHaveBeenCalledWith([MATERIA]);
    expect(turno.count).toHaveBeenCalledWith({ where: { fechaTurno: HOY, materiaId: MATERIA } });
    vi.clearAllMocks();
    materiasPublico.obtenerMateriasPorIds.mockResolvedValue([]);
    await expect(listarTurnos(1, undefined, mesa, { materia_id: MATERIA })).rejects.toMatchObject({ code: "VALIDACION", message: "La materia elegida no existe" });
    expect(turno.count).not.toHaveBeenCalled();
  });

  it("combina período, materia, búsqueda y profesor en un único where para count y findMany", async () => {
    profesor.findFirst.mockResolvedValue(fichaProfesor(PROFESOR_AJENO));
    await listarTurnos(1, undefined, mesa, { periodo: "todas", materia_id: MATERIA, q: "fisica", profesor_id: PROFESOR_AJENO });
    const where = turno.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ profesorId: PROFESOR_AJENO, materiaId: MATERIA, AND: [expect.objectContaining({ AND: expect.any(Array) })] });
    expect(where).not.toHaveProperty("fechaTurno");
    expect(turno.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  it("el Profesor con profesor_id ajeno recibe SIN_PERMISO antes de validar la materia", async () => {
    profesor.findUnique.mockResolvedValue(fichaProfesor(PROFESOR_PROPIO));
    materiasPublico.obtenerMateriasPorIds.mockResolvedValue([]);
    await expect(listarTurnos(1, undefined, { id: "usuario-prof", rol: "PROFESOR" }, { profesor_id: PROFESOR_AJENO, materia_id: MATERIA }))
      .rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(materiasPublico.obtenerMateriasPorIds).not.toHaveBeenCalled();
  });

  it("es_dia_anterior: true solo para las clases de días anteriores a hoy en el centro", async () => {
    const del = (fecha: string) => ({ ...registro("PENDIENTE", 0), idTurno: fecha, fechaTurno: new Date(`${fecha}T00:00:00.000Z`) });
    turno.findMany.mockResolvedValue([del("2026-10-12"), del("2026-10-13"), del("2026-10-14")]);
    const resultado = await listarEl("2026-10-13T15:00:00.000Z", 1, undefined, mesa, { periodo: "todas" });
    expect(resultado.items.map((item) => [item.id, item.es_dia_anterior])).toEqual([["2026-10-12", true], ["2026-10-13", false], ["2026-10-14", false]]);
  });

  describe("opciones del filtro «Materia» (criterio 4)", () => {
    it("Mesa y Gerente: ids de todas las materias con clases, más las activas sin clases", async () => {
      turno.findMany.mockResolvedValue([{ materiaId: "m1" }, { materiaId: "m2" }]);
      const opciones = [{ id: "m1", nombre: "Física", activa: true }, { id: "m2", nombre: "Historia", activa: false }];
      materiasPublico.listarMateriasParaFiltroDeClases.mockResolvedValue(opciones);
      for (const rol of ["MESA_ENTRADA", "GERENTE"] as const) {
        await expect(listarOpcionesFiltroMateria({ id: "u", rol })).resolves.toEqual(opciones);
      }
      expect(turno.findMany).toHaveBeenCalledWith({ where: {}, distinct: ["materiaId"], select: { materiaId: true } });
      expect(materiasPublico.listarMateriasParaFiltroDeClases).toHaveBeenCalledWith(["m1", "m2"], { incluirActivasSinClases: true });
    });

    it("Profesor: solo las materias de sus clases, sin consultar sus materias asociadas", async () => {
      profesor.findUnique.mockResolvedValue(fichaProfesor(PROFESOR_PROPIO));
      turno.findMany.mockResolvedValue([{ materiaId: "m-inactiva" }]);
      await listarOpcionesFiltroMateria({ id: "usuario-prof", rol: "PROFESOR" });
      expect(turno.findMany).toHaveBeenCalledWith({ where: { profesorId: PROFESOR_PROPIO }, distinct: ["materiaId"], select: { materiaId: true } });
      expect(materiasPublico.listarMateriasParaFiltroDeClases).toHaveBeenCalledWith(["m-inactiva"], { incluirActivasSinClases: false });
    });

    it("Profesor sin ficha: sin opciones y sin consultar clases", async () => {
      profesor.findUnique.mockResolvedValue(null);
      await expect(listarOpcionesFiltroMateria({ id: "usuario-prof", rol: "PROFESOR" })).resolves.toEqual([]);
      expect(turno.findMany).not.toHaveBeenCalled();
    });
  });
});
