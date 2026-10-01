import { beforeEach, describe, expect, it, vi } from "vitest";

// HU-J-01 / HU-J-02 / HU-J-03: servicio del módulo J, con `prisma`, los
// módulos D y L y los parámetros mockeados.

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
  eventoDeMateria,
  eventoDeProfesor,
  listarMateriasDelCalendario,
  listarTurnosDelCalendario,
  obtenerCalendarioMateria,
  obtenerCalendarioProfesor,
  resolverFiltroProfesorDeMateria,
  resolverProfesorDeLaAgenda,
  resumirDiasDelMes,
} = await import("@/server/calendario/calendario.service");
const { grillaDelMes } = await import("@/lib/calendario-semana");

const PROPIO = { id: "ckprofesorpropio", nombreParaMostrar: "Giménez, Laura" };
const OTRO = { id: "ckprofesorotro", nombreParaMostrar: "Acuña, Martín" };
const MATEMATICA = { id: "ckmatematica", nombre: "Matemática", codigo: "MAT101" };

const fecha = (valor: string) => new Date(`${valor}T00:00:00.000Z`);

/** Fila de `prisma.turno.findMany` con el `select` de `listarTurnosDelCalendario()`. */
function filaTurno({
  id = "ckturno1",
  dia = "2026-09-22",
  hora = "10:00",
  duracion = 60,
  alumnos = [["Pérez", "Ana"]] as [string, string][],
  aula = "Aula 2" as string | null,
  profesor = ["Giménez", "Laura"] as [string, string] | null,
  cupo = 5 as number | null,
  estado = "DISPONIBLE",
  prioridad = "NORMAL",
} = {}) {
  return {
    idTurno: id,
    estadoTurno: estado,
    prioridadTurno: prioridad,
    fechaTurno: fecha(dia),
    horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`),
    duracionMinutosTurno: duracion,
    cupoMaximoTurno: cupo,
    materia: { idMateria: "ckmatematica", nombreMateria: "Matemática" },
    profesor: profesor ? { idProfesor: "ckprof", apellidoProfesor: profesor[0], nombreProfesor: profesor[1] } : null,
    aula: aula ? { idAula: "ckaula2", nombreAula: aula } : null,
    alumnos: alumnos.map(([apellidoAlumno, nombreAlumno]) => ({ alumno: { apellidoAlumno, nombreAlumno } })),
  };
}

type FilaConFiltros = ReturnType<typeof filaTurno> & { profesorId?: string; materiaId?: string };

/** El mock aplica el `where` recibido (estado, profesor, materia y rango), como lo haría la base. */
function baseConFilas(filas: FilaConFiltros[]) {
  vi.mocked(prisma.turno.findMany).mockImplementation((async (args: {
    where: {
      profesorId?: string;
      materiaId?: string;
      estadoTurno: { in: string[] };
      fechaTurno: { gte: Date; lte: Date };
    };
  }) =>
    filas.filter(
      (fila) =>
        args.where.estadoTurno.in.includes(fila.estadoTurno) &&
        (!args.where.profesorId || fila.profesorId === args.where.profesorId) &&
        (!args.where.materiaId || fila.materiaId === args.where.materiaId) &&
        fila.fechaTurno >= args.where.fechaTurno.gte &&
        fila.fechaTurno <= args.where.fechaTurno.lte,
    )) as never);
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

describe("listarTurnosDelCalendario (contrato de listarTurnosParaCalendario, spec_modulo_C.md §2.15)", () => {
  it("filtra DISPONIBLE y COMPLETO en la query con rango cerrado [desde, hasta], sin sumar un día", async () => {
    await listarTurnosDelCalendario({ desde: "2026-09-21", hasta: "2026-09-25", profesorId: "ckprofesor" });

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({
      profesorId: "ckprofesor",
      estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] },
      fechaTurno: { gte: fecha("2026-09-21"), lte: fecha("2026-09-25") },
    });
  });

  it("la vista día usa desde = hasta; materia y profesor se combinan", async () => {
    await listarTurnosDelCalendario({ desde: "2026-09-30", hasta: "2026-09-30", materiaId: "ckmat", profesorId: "ckprof" });

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({
      profesorId: "ckprof",
      materiaId: "ckmat",
      estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] },
      fechaTurno: { gte: fecha("2026-09-30"), lte: fecha("2026-09-30") },
    });
  });

  it("arma el turno con la forma del contrato de C", async () => {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([
      filaTurno({ hora: "14:00", duracion: 180, alumnos: [["Pérez", "Ana"], ["Ruiz", "Marcos"]], prioridad: "ALTA" }),
    ] as never);

    const [turno] = await listarTurnosDelCalendario({ desde: "2026-09-21", hasta: "2026-09-25" });

    expect(turno).toEqual({
      turno_id: "ckturno1",
      fecha: "2026-09-22",
      hora_inicio: "14:00",
      hora_fin: "17:00",
      estado: "DISPONIBLE",
      prioridad: "ALTA",
      materia: { id: "ckmatematica", nombre: "Matemática" },
      profesor: { id: "ckprof", nombre_para_mostrar: "Giménez, Laura" },
      aula: { id: "ckaula2", nombre: "Aula 2" },
      alumnos: ["Pérez, Ana", "Ruiz, Marcos"],
      inscriptos: 2,
      cupo: 5,
      alumnos_inscriptos: "2/5",
    });
  });

  it("ordena por fecha, hora, profesor e id para carriles estables", async () => {
    await listarTurnosDelCalendario({ desde: "2026-09-21", hasta: "2026-09-25" });

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.orderBy).toEqual([
      { fechaTurno: "asc" },
      { horaInicioTurno: "asc" },
      { profesor: { apellidoNormalizadoProfesor: "asc" } },
      { profesor: { nombreNormalizadoProfesor: "asc" } },
      { idTurno: "asc" },
    ]);
  });

  it("no incluye un PENDIENTE (aunque tenga profesor, alumnos y aula) ni un CANCELADO", async () => {
    baseConFilas([
      { ...filaTurno({ id: "ckpendiente", estado: "PENDIENTE" }), profesorId: "ckprofesor" },
      { ...filaTurno({ id: "ckcancelado", estado: "CANCELADO" }), profesorId: "ckprofesor" },
      { ...filaTurno({ id: "ckconfirmado", estado: "DISPONIBLE" }), profesorId: "ckprofesor" },
    ]);

    const turnos = await listarTurnosDelCalendario({ desde: "2026-09-21", hasta: "2026-09-25", profesorId: "ckprofesor" });

    expect(turnos.map(({ turno_id }) => turno_id)).toEqual(["ckconfirmado"]);
  });
});

describe("eventoDeProfesor (HU-J-01 criterio 3)", () => {
  async function evento(fila: ReturnType<typeof filaTurno>) {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([fila] as never);
    const [turno] = await listarTurnosDelCalendario({ desde: "2026-09-21", hasta: "2026-09-25" });
    return eventoDeProfesor(turno!);
  }

  it("arma el evento con la forma de la spec", async () => {
    expect(await evento(filaTurno({ hora: "14:00", duracion: 180 }))).toEqual({
      turno_id: "ckturno1",
      fecha: "2026-09-22",
      hora_inicio: "14:00",
      hora_fin: "17:00",
      alumno: "Pérez, Ana",
      materia: "Matemática",
      aula: "Aula 2",
      estado: "DISPONIBLE",
      prioridad: "NORMAL",
    });
  });

  it("expone COMPLETO y une los alumnos de un turno grupal con '; '", async () => {
    const grupal = await evento(filaTurno({ estado: "COMPLETO", alumnos: [["Pérez", "Ana"], ["Ruiz", "Marcos"]] }));
    expect(grupal).toMatchObject({ estado: "COMPLETO", alumno: "Pérez, Ana; Ruiz, Marcos" });
  });

  it("usa '—' si no hay alumnos (DISPONIBLE 0/N) o falta el aula", async () => {
    expect(await evento(filaTurno({ alumnos: [], aula: null }))).toMatchObject({ alumno: "—", aula: "—" });
  });
});

describe("eventoDeMateria (HU-J-02 criterios 2 y 3)", () => {
  async function evento(fila: ReturnType<typeof filaTurno>) {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([fila] as never);
    const [turno] = await listarTurnosDelCalendario({ desde: "2026-09-21", hasta: "2026-09-25" });
    return eventoDeMateria(turno!);
  }

  it("arma el evento con profesor y ocupación inscriptos/cupo, sin nombres de alumnos", async () => {
    const tres: [string, string][] = [["A", "a"], ["B", "b"], ["C", "c"]];
    expect(await evento(filaTurno({ hora: "14:00", duracion: 120, alumnos: tres }))).toEqual({
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
      prioridad: "NORMAL",
    });
  });

  it("DISPONIBLE sin alumnos es 0/cupo; '—' sin aula ni profesor", async () => {
    expect(await evento(filaTurno({ alumnos: [], cupo: 2 }))).toMatchObject({ alumnos_inscriptos: "0/2" });
    expect(await evento(filaTurno({ aula: null, profesor: null }))).toMatchObject({ aula: "—", profesor: "—" });
  });

  it("falla de forma visible si un turno confirmado llega sin cupo (invariante de spec_modulo_C.md §2.2)", async () => {
    await expect(evento(filaTurno({ id: "cksincupo", cupo: null }))).rejects.toThrow(
      "Turno cksincupo en DISPONIBLE sin cupo: viola spec_modulo_C.md §2.2",
    );
  });
});

describe("resumirDiasDelMes (HU-J-03 criterio 2, spec_modulo_J.md §2.3 punto 4)", () => {
  const { semanas } = grillaDelMes("2026-09-01");
  type Estado = "DISPONIBLE" | "COMPLETO";
  type Prioridad = "NORMAL" | "ALTA" | "URGENTE";
  const turno = (dia: string, estado: Estado, prioridad: Prioridad = "NORMAL") => ({ fecha: dia, estado, prioridad });
  const resumen = (turnos: ReturnType<typeof turno>[], dia: string) =>
    resumirDiasDelMes(turnos, semanas, "2026-09-01").find((item) => item.fecha === dia)!;

  it("un ítem por día de la grilla, con en_mes falso en el relleno", () => {
    const dias = resumirDiasDelMes([], semanas, "2026-09-01");
    expect(dias).toHaveLength(35);
    expect(dias[0]).toEqual({
      fecha: "2026-08-31",
      en_mes: false,
      cantidad: 0,
      por_estado: { DISPONIBLE: 0, COMPLETO: 0 },
      estado_predominante: null,
      prioridad_maxima: null,
    });
    expect(dias.filter(({ en_mes }) => en_mes)).toHaveLength(30);
    expect(dias.at(-1)).toMatchObject({ fecha: "2026-10-04", en_mes: false });
  });

  it("estado predominante: el de más turnos", () => {
    const dia = "2026-09-15";
    expect(resumen([turno(dia, "DISPONIBLE"), turno(dia, "DISPONIBLE"), turno(dia, "COMPLETO")], dia)).toMatchObject({
      cantidad: 3,
      por_estado: { DISPONIBLE: 2, COMPLETO: 1 },
      estado_predominante: "DISPONIBLE",
    });
    expect(
      resumen([turno(dia, "COMPLETO"), turno(dia, "COMPLETO"), turno(dia, "DISPONIBLE")], dia).estado_predominante,
    ).toBe("COMPLETO");
  });

  it("empate -> COMPLETO", () => {
    const dia = "2026-09-16";
    expect(resumen([turno(dia, "DISPONIBLE"), turno(dia, "COMPLETO")], dia).estado_predominante).toBe("COMPLETO");
  });

  it("prioridad máxima: URGENTE > ALTA > NORMAL", () => {
    const dia = "2026-09-17";
    expect(resumen([turno(dia, "DISPONIBLE", "ALTA"), turno(dia, "DISPONIBLE")], dia).prioridad_maxima).toBe("ALTA");
    expect(
      resumen([turno(dia, "DISPONIBLE", "URGENTE"), turno(dia, "COMPLETO", "ALTA")], dia).prioridad_maxima,
    ).toBe("URGENTE");
  });

  it("los turnos de días de relleno también se resumen", () => {
    expect(resumen([turno("2026-10-02", "DISPONIBLE")], "2026-10-02")).toMatchObject({ en_mes: false, cantidad: 1 });
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

  it("PROFESOR con profesorId ajeno en la API: SIN_PERMISO sin consultar turnos, en cualquier vista", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);

    for (const vista of ["dia", "semana", "mes"] as const) {
      await expect(
        obtenerCalendarioProfesor({
          usuario: { id: "ckusuario", rol: "PROFESOR" },
          profesorIdSolicitado: OTRO.id,
          vista,
          fecha: "2026-09-21",
          rechazarAjeno: true,
        }),
      ).rejects.toMatchObject({ code: "SIN_PERMISO" });
    }
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

describe("obtenerCalendarioProfesor (HU-J-01 criterios 1 y 7, HU-J-03)", () => {
  beforeEach(() => {
    vi.mocked(obtenerOpcionProfesorActivo).mockResolvedValue(OTRO);
  });

  const consultar = (vista: "dia" | "semana" | "mes", dia: string) =>
    obtenerCalendarioProfesor({
      usuario: { id: "ckgerente", rol: "GERENTE" },
      profesorIdSolicitado: OTRO.id,
      vista,
      fecha: dia,
      rechazarAjeno: true,
    });

  it("semana: del primer al último día operativo, con días, horario y rango (sin cambios de HU-J-01)", async () => {
    const calendario = await consultar("semana", "2026-09-23");

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toMatchObject({
      profesorId: OTRO.id,
      fechaTurno: { gte: fecha("2026-09-21"), lte: fecha("2026-09-25") },
    });
    expect(calendario.profesor).toEqual({ id: OTRO.id, nombre_completo: "Acuña, Martín" });
    expect(calendario.rango).toEqual({ desde: "2026-09-21", hasta: "2026-09-25" });
    if (calendario.vista === "mes") throw new Error("vista inesperada");
    expect(calendario.vista).toBe("semana");
    expect(calendario.dias.map(({ dia }) => dia)).toEqual(["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]);
    expect(calendario.horario).toEqual({ apertura: "08:00", cierre: "20:00", granularidadMinutos: 30 });
    expect(calendario.eventos).toEqual([]);
  });

  it("día: consulta [fecha, fecha] y devuelve una sola columna, aunque sea sábado", async () => {
    const calendario = await consultar("dia", "2026-10-03");

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toMatchObject({ fechaTurno: { gte: fecha("2026-10-03"), lte: fecha("2026-10-03") } });
    expect(calendario).toMatchObject({ vista: "dia", rango: { desde: "2026-10-03", hasta: "2026-10-03" } });
    expect(calendario.dias).toEqual([{ fecha: "2026-10-03", dia: "SABADO" }]);
  });

  it("mes: consulta la grilla completa y devuelve un resumen por día, sin eventos", async () => {
    baseConFilas([
      { ...filaTurno({ id: "a", dia: "2026-09-15", estado: "DISPONIBLE" }), profesorId: OTRO.id },
      { ...filaTurno({ id: "b", dia: "2026-09-15", estado: "COMPLETO" }), profesorId: OTRO.id },
      { ...filaTurno({ id: "c", dia: "2026-10-02", estado: "DISPONIBLE" }), profesorId: OTRO.id },
      { ...filaTurno({ id: "d", dia: "2026-09-15", estado: "PENDIENTE" }), profesorId: OTRO.id },
      { ...filaTurno({ id: "e", dia: "2026-09-16", estado: "CANCELADO" }), profesorId: OTRO.id },
    ]);

    const calendario = await consultar("mes", "2026-09-30");

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toMatchObject({ fechaTurno: { gte: fecha("2026-08-31"), lte: fecha("2026-10-04") } });
    expect(calendario).toMatchObject({ vista: "mes", rango: { desde: "2026-09-01", hasta: "2026-09-30" } });
    expect(calendario).not.toHaveProperty("eventos");
    if (calendario.vista !== "mes") throw new Error("vista inesperada");
    expect(calendario.dias).toHaveLength(35);
    expect(calendario.dias.find(({ fecha: dia }) => dia === "2026-09-15")).toMatchObject({
      cantidad: 2,
      estado_predominante: "COMPLETO",
    });
    expect(calendario.dias.find(({ fecha: dia }) => dia === "2026-09-16")).toMatchObject({ cantidad: 0 });
    expect(calendario.dias.find(({ fecha: dia }) => dia === "2026-10-02")).toMatchObject({ en_mes: false, cantidad: 1 });
  });

  it("las tres vistas cuentan los mismos turnos para una misma fecha", async () => {
    baseConFilas([
      { ...filaTurno({ id: "a", dia: "2026-09-22", hora: "08:00" }), profesorId: OTRO.id },
      { ...filaTurno({ id: "b", dia: "2026-09-22", hora: "12:00", estado: "COMPLETO" }), profesorId: OTRO.id },
      { ...filaTurno({ id: "c", dia: "2026-09-23" }), profesorId: OTRO.id },
    ]);

    const dia = await consultar("dia", "2026-09-22");
    const semana = await consultar("semana", "2026-09-22");
    const mes = await consultar("mes", "2026-09-22");

    if (dia.vista === "mes" || semana.vista === "mes" || mes.vista !== "mes") throw new Error("vista inesperada");
    expect(dia.eventos).toHaveLength(2);
    expect(semana.eventos.filter(({ fecha: f }) => f === "2026-09-22")).toHaveLength(2);
    expect(mes.dias.find(({ fecha: f }) => f === "2026-09-22")!.cantidad).toBe(2);
  });
});

// ------------------------------------------------------------
// HU-J-02 — calendario por materia
// ------------------------------------------------------------

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

describe("obtenerCalendarioMateria (HU-J-02 criterios 1 y 5, HU-J-03)", () => {
  it("Mesa: consulta la semana operativa sin filtrar profesor", async () => {
    vi.mocked(obtenerOpcionMateriaActiva).mockResolvedValue(MATEMATICA);

    const calendario = await obtenerCalendarioMateria({
      usuario: { id: "ckmesa", rol: "MESA_ENTRADA" },
      materiaId: MATEMATICA.id,
      vista: "semana",
      fecha: "2026-09-21",
    });

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({
      materiaId: MATEMATICA.id,
      estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] },
      fechaTurno: { gte: fecha("2026-09-21"), lte: fecha("2026-09-25") },
    });
    expect(calendario.materia).toEqual(MATEMATICA);
    expect(calendario.rango).toEqual({ desde: "2026-09-21", hasta: "2026-09-25" });
    expect(calendario).toMatchObject({ vista: "semana", eventos: [] });
  });

  it("vista mes de la materia: resumen por día con la misma consulta", async () => {
    vi.mocked(obtenerOpcionMateriaActiva).mockResolvedValue(MATEMATICA);
    baseConFilas([{ ...filaTurno({ dia: "2026-09-10" }), materiaId: MATEMATICA.id }]);

    const calendario = await obtenerCalendarioMateria({
      usuario: { id: "ckgerente", rol: "GERENTE" },
      materiaId: MATEMATICA.id,
      vista: "mes",
      fecha: "2026-09-10",
    });

    if (calendario.vista !== "mes") throw new Error("vista inesperada");
    expect(calendario.dias.find(({ fecha: dia }) => dia === "2026-09-10")).toMatchObject({
      cantidad: 1,
      estado_predominante: "DISPONIBLE",
    });
  });

  it("Profesor: la consulta lleva su propio profesorId, en cualquier vista", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);
    vi.mocked(obtenerMateriasDelProfesor).mockResolvedValue([{ ...MATEMATICA, activa: true }]);
    vi.mocked(obtenerOpcionMateriaActiva).mockResolvedValue(MATEMATICA);

    await obtenerCalendarioMateria({
      usuario: { id: "ckusuario", rol: "PROFESOR" },
      materiaId: MATEMATICA.id,
      vista: "mes",
      fecha: "2026-09-21",
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
      vista: "semana" as const,
      fecha: "2026-09-21",
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
        vista: "dia",
        fecha: "2026-09-21",
      }),
    ).rejects.toMatchObject({ code: "MATERIA_NO_ENCONTRADA" });
    expect(prisma.turno.findMany).not.toHaveBeenCalled();
  });
});
