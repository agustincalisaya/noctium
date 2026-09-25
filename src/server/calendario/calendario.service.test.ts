import { beforeEach, describe, expect, it, vi } from "vitest";

// HU-J-01 / HU-J-02: servicio del módulo J, con `prisma`, los módulos D y L
// y los parámetros mockeados.

vi.mock("@/lib/prisma", () => ({
  prisma: { turno: { findMany: vi.fn() } },
}));

vi.mock("@/server/profesores/profesor.service", () => ({
  obtenerOpcionProfesorActivo: vi.fn(),
  obtenerOpcionProfesorDeUsuario: vi.fn(),
  obtenerMateriasDelProfesor: vi.fn(),
}));

vi.mock("@/server/materias/materia.service", () => ({
  listarMateriasActivas: vi.fn(),
  obtenerOpcionMateriaActiva: vi.fn(),
}));

vi.mock("@/server/shared/parametros", () => ({
  obtenerParametrosHorarioOperativo: vi.fn(),
}));

const { prisma } = await import("@/lib/prisma");
const { obtenerMateriasDelProfesor, obtenerOpcionProfesorActivo, obtenerOpcionProfesorDeUsuario } = await import(
  "@/server/profesores/profesor.service"
);
const { listarMateriasActivas, obtenerOpcionMateriaActiva } = await import("@/server/materias/materia.service");
const { obtenerParametrosHorarioOperativo } = await import("@/server/shared/parametros");
const {
  listarMateriasDelCalendario,
  listarTurnosAgendadosDeMateria,
  listarTurnosAgendadosDeProfesor,
  obtenerCalendarioMateria,
  obtenerCalendarioProfesor,
  resolverFiltroProfesorDeMateria,
  resolverProfesorDeLaAgenda,
} = await import("@/server/calendario/calendario.service");

const PROPIO = { id: "ckprofesorpropio", nombreParaMostrar: "Giménez, Laura" };
const OTRO = { id: "ckprofesorotro", nombreParaMostrar: "Acuña, Martín" };

function filaTurno({
  id = "ckturno1",
  fecha = "2026-09-22",
  hora = "10:00",
  duracion = 60,
  alumnos = [["Pérez", "Ana"]],
  aula = "Aula 2" as string | null,
  estado = "DISPONIBLE",
} = {}) {
  return {
    idTurno: id,
    estadoTurno: estado,
    fechaTurno: new Date(`${fecha}T00:00:00.000Z`),
    horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`),
    duracionMinutosTurno: duracion,
    materia: { nombreMateria: "Matemática" },
    aula: aula ? { nombreAula: aula } : null,
    alumnos: alumnos.map(([apellidoAlumno, nombreAlumno]) => ({ alumno: { apellidoAlumno, nombreAlumno } })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.turno.findMany).mockResolvedValue([]);
  vi.mocked(obtenerParametrosHorarioOperativo).mockResolvedValue({
    diasOperativos: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"],
    apertura: "08:00",
    cierre: "20:00",
    granularidadMinutos: 30,
  });
});

describe("listarTurnosAgendadosDeProfesor (criterios 3 y 4)", () => {
  it("filtra DISPONIBLE y COMPLETO en la query, por profesor y rango [desde, hasta)", async () => {
    const desde = new Date("2026-09-21T00:00:00.000Z");
    const hasta = new Date("2026-09-26T00:00:00.000Z");

    await listarTurnosAgendadosDeProfesor("ckprofesor", desde, hasta);

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({
      profesorId: "ckprofesor",
      estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] },
      fechaTurno: { gte: desde, lt: hasta },
    });
  });

  it("arma el evento con la forma de la spec y la hora de fin por duración", async () => {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([filaTurno({ hora: "14:00", duracion: 180 })] as never);

    const [evento] = await listarTurnosAgendadosDeProfesor("ckprofesor", new Date(), new Date());

    expect(evento).toEqual({
      turno_id: "ckturno1",
      fecha: "2026-09-22",
      hora_inicio: "14:00",
      hora_fin: "17:00",
      alumno: "Pérez, Ana",
      materia: "Matemática",
      aula: "Aula 2",
      estado: "DISPONIBLE",
    });
  });

  it("expone COMPLETO cuando el turno alcanzó su cupo", async () => {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([filaTurno({ estado: "COMPLETO" })] as never);

    const [evento] = await listarTurnosAgendadosDeProfesor("ckprofesor", new Date(), new Date());

    expect(evento!.estado).toBe("COMPLETO");
  });

  it("no incluye un PENDIENTE aunque ya tenga profesor, alumnos y aula asignados", async () => {
    // Flujo HU-C-04/HU-C-15: el profesor se asigna con el turno todavía
    // PENDIENTE. El mock aplica el `where` recibido, como lo haría la base.
    const filas = [
      { ...filaTurno({ id: "ckpendiente", estado: "PENDIENTE" }), profesorId: "ckprofesor" },
      { ...filaTurno({ id: "ckconfirmado", estado: "DISPONIBLE" }), profesorId: "ckprofesor" },
    ];
    vi.mocked(prisma.turno.findMany).mockImplementation((async (args: {
      where: { profesorId: string; estadoTurno: { in: string[] } };
    }) =>
      filas.filter(
        (fila) => fila.profesorId === args.where.profesorId && args.where.estadoTurno.in.includes(fila.estadoTurno),
      )) as never);

    const eventos = await listarTurnosAgendadosDeProfesor("ckprofesor", new Date(), new Date());

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where?.estadoTurno).toEqual({ in: ["DISPONIBLE", "COMPLETO"] });
    expect(eventos.map(({ turno_id }) => turno_id)).toEqual(["ckconfirmado"]);
  });

  it("muestra un DISPONIBLE sin alumnos (se quitaron todos) con '—' en Alumno", async () => {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([filaTurno({ alumnos: [], estado: "DISPONIBLE" })] as never);

    const [evento] = await listarTurnosAgendadosDeProfesor("ckprofesor", new Date(), new Date());

    expect(evento).toMatchObject({ alumno: "—", aula: "Aula 2", estado: "DISPONIBLE" });
  });

  it("une los alumnos de un turno grupal con '; ' y usa '—' si falta alumno o aula", async () => {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([
      filaTurno({ alumnos: [["Pérez", "Ana"], ["Ruiz", "Marcos"]] }),
      filaTurno({ id: "ckturno2", alumnos: [], aula: null }),
    ] as never);

    const [grupal, incompleto] = await listarTurnosAgendadosDeProfesor("ckprofesor", new Date(), new Date());

    expect(grupal!.alumno).toBe("Pérez, Ana; Ruiz, Marcos");
    expect(incompleto!.alumno).toBe("—");
    expect(incompleto!.aula).toBe("—");
  });
});

describe("resolverProfesorDeLaAgenda (criterio 2)", () => {
  it("PROFESOR sin profesorId: usa la ficha vinculada a su cuenta", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);

    const profesor = await resolverProfesorDeLaAgenda({ id: "ckusuario", rol: "PROFESOR" }, undefined, {
      rechazarAjeno: true,
    });

    expect(profesor).toEqual(PROPIO);
    expect(obtenerOpcionProfesorDeUsuario).toHaveBeenCalledWith("ckusuario");
  });

  it("PROFESOR con profesorId ajeno en la página: se ignora y ve la propia", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);

    const profesor = await resolverProfesorDeLaAgenda({ id: "ckusuario", rol: "PROFESOR" }, OTRO.id, {
      rechazarAjeno: false,
    });

    expect(profesor).toEqual(PROPIO);
    expect(obtenerOpcionProfesorActivo).not.toHaveBeenCalled();
  });

  it("PROFESOR con profesorId ajeno en la API: SIN_PERMISO sin consultar turnos", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);

    await expect(
      obtenerCalendarioProfesor({
        usuario: { id: "ckusuario", rol: "PROFESOR" },
        profesorIdSolicitado: OTRO.id,
        lunes: "2026-09-21",
        rechazarAjeno: true,
      }),
    ).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(prisma.turno.findMany).not.toHaveBeenCalled();
    expect(obtenerOpcionProfesorActivo).not.toHaveBeenCalled();
  });

  it("PROFESOR sin ficha vinculada: PROFESOR_SIN_FICHA", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(null);

    await expect(
      resolverProfesorDeLaAgenda({ id: "ckusuario", rol: "PROFESOR" }, undefined, { rechazarAjeno: false }),
    ).rejects.toMatchObject({ code: "PROFESOR_SIN_FICHA" });
  });

  it("Mesa/Gerente: el profesor debe estar activo", async () => {
    vi.mocked(obtenerOpcionProfesorActivo).mockResolvedValueOnce(OTRO).mockResolvedValueOnce(null);

    await expect(
      resolverProfesorDeLaAgenda({ id: "ckmesa", rol: "MESA_ENTRADA" }, OTRO.id, { rechazarAjeno: true }),
    ).resolves.toEqual(OTRO);
    await expect(
      resolverProfesorDeLaAgenda({ id: "ckgerente", rol: "GERENTE" }, "ckinactivo", { rechazarAjeno: true }),
    ).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
    await expect(
      resolverProfesorDeLaAgenda({ id: "ckgerente", rol: "GERENTE" }, undefined, { rechazarAjeno: true }),
    ).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
  });

  it("Alumno: SIN_PERMISO", async () => {
    await expect(
      resolverProfesorDeLaAgenda({ id: "ckalumno", rol: "ALUMNO" }, OTRO.id, { rechazarAjeno: true }),
    ).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });
});

describe("obtenerCalendarioProfesor (criterios 1 y 7)", () => {
  it("consulta del primer al último día operativo y devuelve días, horario y rango", async () => {
    vi.mocked(obtenerOpcionProfesorActivo).mockResolvedValue(OTRO);

    const calendario = await obtenerCalendarioProfesor({
      usuario: { id: "ckgerente", rol: "GERENTE" },
      profesorIdSolicitado: OTRO.id,
      lunes: "2026-09-21",
      rechazarAjeno: true,
    });

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toMatchObject({
      profesorId: OTRO.id,
      fechaTurno: {
        gte: new Date("2026-09-21T00:00:00.000Z"),
        lt: new Date("2026-09-26T00:00:00.000Z"),
      },
    });
    expect(calendario.profesor).toEqual({ id: OTRO.id, nombre_completo: "Acuña, Martín" });
    expect(calendario.rango).toEqual({ desde: "2026-09-21", hasta: "2026-09-25" });
    expect(calendario.dias.map(({ dia }) => dia)).toEqual(["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]);
    expect(calendario.horario).toEqual({ apertura: "08:00", cierre: "20:00", granularidadMinutos: 30 });
    expect(calendario.eventos).toEqual([]);
  });
});

// ------------------------------------------------------------
// HU-J-02 — calendario por materia
// ------------------------------------------------------------

const MATEMATICA = { id: "ckmatematica", nombre: "Matemática", codigo: "MAT101" };

function filaTurnoMateria({
  id = "ckturno1",
  hora = "10:00",
  duracion = 60,
  profesor = ["Giménez", "Laura"] as [string, string] | null,
  inscriptos = 3,
  cupo = 5 as number | null,
  aula = "Aula 2" as string | null,
  estado = "DISPONIBLE",
} = {}) {
  return {
    idTurno: id,
    estadoTurno: estado,
    fechaTurno: new Date("2026-09-22T00:00:00.000Z"),
    horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`),
    duracionMinutosTurno: duracion,
    cupoMaximoTurno: cupo,
    aula: aula ? { nombreAula: aula } : null,
    profesor: profesor ? { apellidoProfesor: profesor[0], nombreProfesor: profesor[1] } : null,
    _count: { alumnos: inscriptos },
  };
}

describe("listarTurnosAgendadosDeMateria (HU-J-02 criterios 2 y 3)", () => {
  const desde = new Date("2026-09-21T00:00:00.000Z");
  const hasta = new Date("2026-09-26T00:00:00.000Z");

  it("filtra por materia, DISPONIBLE/COMPLETO y rango, sin profesor si no se pide", async () => {
    await listarTurnosAgendadosDeMateria("ckmatematica", desde, hasta);

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({
      materiaId: "ckmatematica",
      estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] },
      fechaTurno: { gte: desde, lt: hasta },
    });
    expect(args.where).not.toHaveProperty("profesorId");
  });

  it("con profesorId, lo agrega al where", async () => {
    await listarTurnosAgendadosDeMateria("ckmatematica", desde, hasta, PROPIO.id);

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toMatchObject({ materiaId: "ckmatematica", profesorId: PROPIO.id });
  });

  it("no incluye un PENDIENTE aunque ya tenga profesor, alumnos y aula", async () => {
    const filas = [
      { ...filaTurnoMateria({ id: "ckpendiente", estado: "PENDIENTE" }), materiaId: "ckmatematica" },
      { ...filaTurnoMateria({ id: "ckcompleto", estado: "COMPLETO", inscriptos: 5 }), materiaId: "ckmatematica" },
    ];
    vi.mocked(prisma.turno.findMany).mockImplementation((async (args: {
      where: { materiaId: string; estadoTurno: { in: string[] } };
    }) =>
      filas.filter(
        (fila) => fila.materiaId === args.where.materiaId && args.where.estadoTurno.in.includes(fila.estadoTurno),
      )) as never);

    const eventos = await listarTurnosAgendadosDeMateria("ckmatematica", desde, hasta);

    expect(eventos.map(({ turno_id }) => turno_id)).toEqual(["ckcompleto"]);
  });

  it("arma el evento con profesor y ocupación inscriptos/cupo, sin nombres de alumnos", async () => {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([filaTurnoMateria({ hora: "14:00", duracion: 120 })] as never);

    const [evento] = await listarTurnosAgendadosDeMateria("ckmatematica", desde, hasta);

    expect(evento).toEqual({
      turno_id: "ckturno1",
      fecha: "2026-09-22",
      hora_inicio: "14:00",
      hora_fin: "16:00",
      profesor: "Giménez, Laura",
      alumnos_inscriptos: "3/5",
      inscriptos: 3,
      cupo: 5,
      aula: "Aula 2",
      estado: "DISPONIBLE",
    });
    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.select).not.toHaveProperty("alumnos");
    expect(args.select).toMatchObject({ cupoMaximoTurno: true, _count: { select: { alumnos: true } } });
  });

  it("DISPONIBLE sin alumnos es 0/cupo; COMPLETO es cupo/cupo; '—' sin aula ni profesor", async () => {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([
      filaTurnoMateria({ inscriptos: 0, cupo: 2 }),
      filaTurnoMateria({ id: "ckturno2", inscriptos: 2, cupo: 2, estado: "COMPLETO", aula: null, profesor: null }),
    ] as never);

    const [vacio, completo] = await listarTurnosAgendadosDeMateria("ckmatematica", desde, hasta);

    expect(vacio).toMatchObject({ alumnos_inscriptos: "0/2", estado: "DISPONIBLE" });
    expect(completo).toMatchObject({ alumnos_inscriptos: "2/2", estado: "COMPLETO", aula: "—", profesor: "—" });
  });

  it("falla de forma visible si un turno confirmado llega sin cupo (invariante de spec_modulo_C.md §2.2)", async () => {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([filaTurnoMateria({ id: "cksincupo", cupo: null })] as never);

    await expect(listarTurnosAgendadosDeMateria("ckmatematica", desde, hasta))
      .rejects.toThrow("Turno cksincupo en DISPONIBLE sin cupo: viola spec_modulo_C.md §2.2");
  });

  it("devuelve todos los turnos del mismo horario, ordenados por profesor para carriles estables", async () => {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([
      filaTurnoMateria({ id: "cka", profesor: ["Castro", "Julián"] }),
      filaTurnoMateria({ id: "ckb", profesor: ["Giménez", "Laura"] }),
    ] as never);

    const eventos = await listarTurnosAgendadosDeMateria("ckmatematica", desde, hasta);

    expect(eventos.map(({ profesor }) => profesor)).toEqual(["Castro, Julián", "Giménez, Laura"]);
    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.orderBy).toEqual([
      { fechaTurno: "asc" },
      { horaInicioTurno: "asc" },
      { profesor: { apellidoNormalizadoProfesor: "asc" } },
      { profesor: { nombreNormalizadoProfesor: "asc" } },
      { idTurno: "asc" },
    ]);
  });
});

describe("resolverFiltroProfesorDeMateria (HU-J-02 criterio 1)", () => {
  it("PROFESOR que dicta la materia: filtra por su propia ficha", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);
    vi.mocked(obtenerMateriasDelProfesor).mockResolvedValue([{ ...MATEMATICA, activa: true }]);

    await expect(
      resolverFiltroProfesorDeMateria({ id: "ckusuario", rol: "PROFESOR" }, MATEMATICA.id),
    ).resolves.toBe(PROPIO.id);
    expect(obtenerOpcionProfesorDeUsuario).toHaveBeenCalledWith("ckusuario");
    expect(obtenerMateriasDelProfesor).toHaveBeenCalledWith(PROPIO.id);
  });

  it("PROFESOR que no dicta la materia: SIN_PERMISO", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);
    vi.mocked(obtenerMateriasDelProfesor).mockResolvedValue([]);

    await expect(
      resolverFiltroProfesorDeMateria({ id: "ckusuario", rol: "PROFESOR" }, MATEMATICA.id),
    ).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });

  it("PROFESOR sin ficha: PROFESOR_SIN_FICHA", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(null);

    await expect(
      resolverFiltroProfesorDeMateria({ id: "ckusuario", rol: "PROFESOR" }, MATEMATICA.id),
    ).rejects.toMatchObject({ code: "PROFESOR_SIN_FICHA" });
  });

  it("Mesa y Gerente: sin filtro de profesor", async () => {
    await expect(
      resolverFiltroProfesorDeMateria({ id: "ckmesa", rol: "MESA_ENTRADA" }, MATEMATICA.id),
    ).resolves.toBeUndefined();
    await expect(
      resolverFiltroProfesorDeMateria({ id: "ckgerente", rol: "GERENTE" }, MATEMATICA.id),
    ).resolves.toBeUndefined();
    expect(obtenerOpcionProfesorDeUsuario).not.toHaveBeenCalled();
  });

  it("Alumno: SIN_PERMISO", async () => {
    await expect(
      resolverFiltroProfesorDeMateria({ id: "ckalumno", rol: "ALUMNO" }, MATEMATICA.id),
    ).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });
});

describe("listarMateriasDelCalendario (HU-J-02 criterio 1)", () => {
  it("Mesa/Gerente: todas las materias activas del módulo L", async () => {
    vi.mocked(listarMateriasActivas).mockResolvedValue([
      { idMateria: "ckmatematica", nombreMateria: "Matemática", codigoMateria: "MAT101" },
      { idMateria: "ckquimica", nombreMateria: "Química", codigoMateria: null },
    ]);

    await expect(listarMateriasDelCalendario({ id: "ckgerente", rol: "GERENTE" })).resolves.toEqual([
      MATEMATICA,
      { id: "ckquimica", nombre: "Química", codigo: null },
    ]);
  });

  it("Profesor: solo las activas que tiene asociadas", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);
    vi.mocked(obtenerMateriasDelProfesor).mockResolvedValue([
      { ...MATEMATICA, activa: true },
      { id: "ckhistoria", nombre: "Historia de la Ciencia", codigo: "HIS101", activa: false },
    ]);

    await expect(listarMateriasDelCalendario({ id: "ckusuario", rol: "PROFESOR" })).resolves.toEqual([MATEMATICA]);
    expect(listarMateriasActivas).not.toHaveBeenCalled();
  });

  it("Alumno: SIN_PERMISO", async () => {
    await expect(listarMateriasDelCalendario({ id: "ckalumno", rol: "ALUMNO" })).rejects.toMatchObject({
      code: "SIN_PERMISO",
    });
  });
});

describe("obtenerCalendarioMateria (HU-J-02 criterios 1 y 5)", () => {
  it("Mesa: consulta la semana operativa sin filtrar profesor", async () => {
    vi.mocked(obtenerOpcionMateriaActiva).mockResolvedValue(MATEMATICA);

    const calendario = await obtenerCalendarioMateria({
      usuario: { id: "ckmesa", rol: "MESA_ENTRADA" },
      materiaId: MATEMATICA.id,
      lunes: "2026-09-21",
    });

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({
      materiaId: MATEMATICA.id,
      estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] },
      fechaTurno: { gte: new Date("2026-09-21T00:00:00.000Z"), lt: new Date("2026-09-26T00:00:00.000Z") },
    });
    expect(calendario.materia).toEqual(MATEMATICA);
    expect(calendario.rango).toEqual({ desde: "2026-09-21", hasta: "2026-09-25" });
    expect(calendario.eventos).toEqual([]);
  });

  it("Profesor: la consulta lleva su propio profesorId", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);
    vi.mocked(obtenerMateriasDelProfesor).mockResolvedValue([{ ...MATEMATICA, activa: true }]);
    vi.mocked(obtenerOpcionMateriaActiva).mockResolvedValue(MATEMATICA);

    await obtenerCalendarioMateria({
      usuario: { id: "ckusuario", rol: "PROFESOR" },
      materiaId: MATEMATICA.id,
      lunes: "2026-09-21",
    });

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toMatchObject({ materiaId: MATEMATICA.id, profesorId: PROPIO.id });
  });

  it("Profesor sin ficha o que no dicta la materia: se rechaza sin consultar materia ni turnos", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValueOnce(null).mockResolvedValueOnce(PROPIO);
    vi.mocked(obtenerMateriasDelProfesor).mockResolvedValue([]);
    const consulta = {
      usuario: { id: "ckusuario", rol: "PROFESOR" as const },
      materiaId: MATEMATICA.id,
      lunes: "2026-09-21",
    };

    await expect(obtenerCalendarioMateria(consulta)).rejects.toMatchObject({ code: "PROFESOR_SIN_FICHA" });
    await expect(obtenerCalendarioMateria(consulta)).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(obtenerOpcionMateriaActiva).not.toHaveBeenCalled();
    expect(prisma.turno.findMany).not.toHaveBeenCalled();
  });

  it("materia inexistente o inactiva: MATERIA_NO_ENCONTRADA sin consultar turnos", async () => {
    vi.mocked(obtenerOpcionMateriaActiva).mockResolvedValue(null);

    await expect(
      obtenerCalendarioMateria({
        usuario: { id: "ckgerente", rol: "GERENTE" },
        materiaId: "ckinactiva",
        lunes: "2026-09-21",
      }),
    ).rejects.toMatchObject({ code: "MATERIA_NO_ENCONTRADA" });
    expect(prisma.turno.findMany).not.toHaveBeenCalled();
  });
});
