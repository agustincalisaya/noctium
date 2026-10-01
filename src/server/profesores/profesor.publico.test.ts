import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, tx } = vi.hoisted(() => {
  const crear = () => ({
    $queryRaw: vi.fn(),
    profesor: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    horarioProfesor: { findMany: vi.fn(), findFirst: vi.fn() },
    profesorMateria: { findMany: vi.fn() },
  });
  return { db: crear(), tx: crear() };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const publico = await import("./profesor.publico");
const servicio = await import("./profesor.service");
const {
  listarOpcionesProfesoresActivos,
  obtenerHorariosDeAtencion,
  obtenerHorarioDeProfesor,
  obtenerNombresProfesores,
  obtenerOpcionProfesorDeUsuario,
  obtenerOpcionProfesorActivo,
  obtenerMateriasDelProfesor,
  profesorActivoDictaMateria,
} = publico;

const conTx = tx as never;
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);
const profesor = (id: string, nombre = "Ana", apellido = "Pérez") => ({
  idProfesor: id, nombreProfesor: nombre, apellidoProfesor: apellido,
});
const horario = (id: string, dia: string, desde: string, hasta: string) => ({
  idHorario: id, diaSemanaHorario: dia, horaDesdeHorario: hora(desde), horaHastaHorario: hora(hasta),
});

beforeEach(() => vi.clearAllMocks());

describe("reexportadas", () => {
  it("son las mismas funciones que las del service", () => {
    expect(publico.listarProfesoresActivosPorMateria).toBe(servicio.listarProfesoresActivosPorMateria);
    expect(publico.estaDentroDeHorarioAtencion).toBe(servicio.estaDentroDeHorarioAtencion);
  });
});

describe("listarOpcionesProfesoresActivos", () => {
  it("filtra activos, ordena como el service y arma nombreParaMostrar", async () => {
    db.profesor.findMany.mockResolvedValue([profesor("p1"), profesor("p2", "Luis", "Álvarez")]);
    await expect(listarOpcionesProfesoresActivos()).resolves.toEqual([
      { id: "p1", nombre: "Ana", apellido: "Pérez", nombreParaMostrar: "Pérez, Ana" },
      { id: "p2", nombre: "Luis", apellido: "Álvarez", nombreParaMostrar: "Álvarez, Luis" },
    ]);
    expect(db.profesor.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { activoProfesor: true },
      orderBy: [{ apellidoNormalizadoProfesor: "asc" }, { nombreNormalizadoProfesor: "asc" }, { dniProfesor: "asc" }],
    }));
  });

  it("sin profesores devuelve []", async () => {
    db.profesor.findMany.mockResolvedValue([]);
    await expect(listarOpcionesProfesoresActivos()).resolves.toEqual([]);
  });

  it("usa el db recibido", async () => {
    tx.profesor.findMany.mockResolvedValue([]);
    await listarOpcionesProfesoresActivos(conTx);
    expect(tx.profesor.findMany).toHaveBeenCalledOnce();
    expect(db.profesor.findMany).not.toHaveBeenCalled();
  });
});

describe("obtenerHorariosDeAtencion", () => {
  it("devuelve dia_semana del enum y horas HH:mm, ordenado por día y hora", async () => {
    db.horarioProfesor.findMany.mockResolvedValue([
      horario("h1", "LUNES", "09:00", "12:30"), horario("h2", "MIERCOLES", "14:05", "18:00"),
    ]);
    await expect(obtenerHorariosDeAtencion("p1")).resolves.toEqual([
      { horario_id: "h1", dia_semana: "LUNES", hora_inicio: "09:00", hora_fin: "12:30" },
      { horario_id: "h2", dia_semana: "MIERCOLES", hora_inicio: "14:05", hora_fin: "18:00" },
    ]);
    expect(db.horarioProfesor.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { profesorId: "p1" },
      orderBy: [{ diaSemanaHorario: "asc" }, { horaDesdeHorario: "asc" }],
    }));
  });

  it("sin horarios devuelve []", async () => {
    db.horarioProfesor.findMany.mockResolvedValue([]);
    await expect(obtenerHorariosDeAtencion("p1")).resolves.toEqual([]);
  });

  it("usa el db recibido", async () => {
    tx.horarioProfesor.findMany.mockResolvedValue([]);
    await obtenerHorariosDeAtencion("p1", conTx);
    expect(tx.horarioProfesor.findMany).toHaveBeenCalledOnce();
    expect(db.horarioProfesor.findMany).not.toHaveBeenCalled();
  });

  it("devuelve el mismo formato que obtenerHorariosDelProfesor del service", async () => {
    const filas = [horario("h1", "VIERNES", "08:00", "10:45")];
    db.horarioProfesor.findMany.mockResolvedValue(filas);
    const [delServicio] = await servicio.obtenerHorariosDelProfesor("p1");
    const [publicoFila] = await obtenerHorariosDeAtencion("p1");
    expect(publicoFila).toEqual({
      horario_id: delServicio!.id, dia_semana: delServicio!.diaSemana,
      hora_inicio: delServicio!.horaInicio, hora_fin: delServicio!.horaFin,
    });
  });
});

describe("obtenerHorarioDeProfesor", () => {
  it("consulta por horario y profesor en una sola consulta", async () => {
    db.horarioProfesor.findFirst.mockResolvedValue(horario("h1", "MARTES", "10:00", "11:00"));
    await expect(obtenerHorarioDeProfesor("p1", "h1")).resolves.toEqual({
      horario_id: "h1", dia_semana: "MARTES", hora_inicio: "10:00", hora_fin: "11:00",
    });
    expect(db.horarioProfesor.findFirst).toHaveBeenCalledOnce();
    expect(db.horarioProfesor.findFirst.mock.calls[0]![0]).toMatchObject({ where: { idHorario: "h1", profesorId: "p1" } });
  });

  it("devuelve null si el horario no es de ese profesor o no existe", async () => {
    db.horarioProfesor.findFirst.mockResolvedValue(null);
    await expect(obtenerHorarioDeProfesor("p2", "h1")).resolves.toBeNull();
  });

  it("usa el db recibido", async () => {
    tx.horarioProfesor.findFirst.mockResolvedValue(null);
    await obtenerHorarioDeProfesor("p1", "h1", conTx);
    expect(tx.horarioProfesor.findFirst).toHaveBeenCalledOnce();
    expect(db.horarioProfesor.findFirst).not.toHaveBeenCalled();
  });
});

describe("obtenerNombresProfesores", () => {
  it("devuelve Apellido, Nombre por id sin filtrar activos y sin inexistentes", async () => {
    db.profesor.findMany.mockResolvedValue([profesor("p1"), profesor("p2", "Luis", "Gómez")]);
    await expect(obtenerNombresProfesores(["p1", "p2", "x", "p1"])).resolves.toEqual({
      p1: "Pérez, Ana", p2: "Gómez, Luis",
    });
    expect(db.profesor.findMany).toHaveBeenCalledOnce();
    const [{ where }] = db.profesor.findMany.mock.calls[0]!;
    expect(where).toEqual({ idProfesor: { in: ["p1", "p2", "x"] } });
  });

  it("con lista vacía no consulta", async () => {
    await expect(obtenerNombresProfesores([])).resolves.toEqual({});
    expect(db.profesor.findMany).not.toHaveBeenCalled();
  });

  it("con ids inexistentes devuelve {}", async () => {
    db.profesor.findMany.mockResolvedValue([]);
    await expect(obtenerNombresProfesores(["x"])).resolves.toEqual({});
  });

  it("usa el db recibido", async () => {
    tx.profesor.findMany.mockResolvedValue([]);
    await obtenerNombresProfesores(["p1"], conTx);
    expect(tx.profesor.findMany).toHaveBeenCalledOnce();
    expect(db.profesor.findMany).not.toHaveBeenCalled();
  });
});

describe("obtenerOpcionProfesorDeUsuario", () => {
  it("busca por usuarioId sin filtrar activo", async () => {
    db.profesor.findUnique.mockResolvedValueOnce(profesor("p1")).mockResolvedValueOnce(null);
    await expect(obtenerOpcionProfesorDeUsuario("u1")).resolves.toEqual({ id: "p1", nombreParaMostrar: "Pérez, Ana" });
    await expect(obtenerOpcionProfesorDeUsuario("u2")).resolves.toBeNull();
    expect(db.profesor.findUnique.mock.calls[0]![0]).toMatchObject({ where: { usuarioId: "u1" } });
    expect(db.profesor.findUnique.mock.calls[0]![0].where).not.toHaveProperty("activoProfesor");
  });

  it("usa el db recibido", async () => {
    tx.profesor.findUnique.mockResolvedValue(null);
    await obtenerOpcionProfesorDeUsuario("u1", conTx);
    expect(tx.profesor.findUnique).toHaveBeenCalledOnce();
    expect(db.profesor.findUnique).not.toHaveBeenCalled();
  });
});

describe("obtenerOpcionProfesorActivo", () => {
  it("filtra por id y activo", async () => {
    db.profesor.findFirst.mockResolvedValueOnce(profesor("p1")).mockResolvedValueOnce(null);
    await expect(obtenerOpcionProfesorActivo("p1")).resolves.toEqual({ id: "p1", nombreParaMostrar: "Pérez, Ana" });
    await expect(obtenerOpcionProfesorActivo("inactivo")).resolves.toBeNull();
    expect(db.profesor.findFirst.mock.calls[0]![0]).toMatchObject({ where: { idProfesor: "p1", activoProfesor: true } });
  });

  it("usa el db recibido", async () => {
    tx.profesor.findFirst.mockResolvedValue(null);
    await obtenerOpcionProfesorActivo("p1", conTx);
    expect(tx.profesor.findFirst).toHaveBeenCalledOnce();
    expect(db.profesor.findFirst).not.toHaveBeenCalled();
  });
});

describe("obtenerMateriasDelProfesor", () => {
  const asociacion = (id: string, activa: boolean, codigo: string | null) => ({
    materia: { idMateria: id, nombreMateria: `Materia ${id}`, codigoMateria: codigo, activaMateria: activa },
  });

  it("devuelve activas e inactivas con su estado, ordenadas por nombre normalizado", async () => {
    db.profesorMateria.findMany.mockResolvedValue([asociacion("m1", true, "MAT"), asociacion("m2", false, null)]);
    await expect(obtenerMateriasDelProfesor("p1")).resolves.toEqual([
      { id: "m1", nombre: "Materia m1", codigo: "MAT", activa: true },
      { id: "m2", nombre: "Materia m2", codigo: null, activa: false },
    ]);
    expect(db.profesorMateria.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { profesorId: "p1" }, orderBy: { materia: { nombreNormalizadaMateria: "asc" } },
    }));
  });

  it("sin materias devuelve []", async () => {
    db.profesorMateria.findMany.mockResolvedValue([]);
    await expect(obtenerMateriasDelProfesor("p1")).resolves.toEqual([]);
  });

  it("usa el db recibido", async () => {
    tx.profesorMateria.findMany.mockResolvedValue([]);
    await obtenerMateriasDelProfesor("p1", conTx);
    expect(tx.profesorMateria.findMany).toHaveBeenCalledOnce();
    expect(db.profesorMateria.findMany).not.toHaveBeenCalled();
  });
});

describe("profesorActivoDictaMateria", () => {
  it("sin db delega en el service (findFirst sobre prisma) y no usa $queryRaw", async () => {
    db.profesor.findFirst.mockResolvedValueOnce({ idProfesor: "p1" }).mockResolvedValueOnce(null);
    await expect(profesorActivoDictaMateria("p1", "m1")).resolves.toBe(true);
    await expect(profesorActivoDictaMateria("p1", "m2")).resolves.toBe(false);
    expect(db.profesor.findFirst).toHaveBeenCalledWith({
      where: { idProfesor: "p1", activoProfesor: true, materias: { some: { materiaId: "m1" } } },
      select: { idProfesor: true },
    });
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(profesorActivoDictaMateria).not.toBe(servicio.profesorActivoDictaMateria);
  });

  it("con db usa $queryRaw con FOR SHARE OF pm y no llama al service", async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ profesorId: "p1" }]).mockResolvedValueOnce([]);
    await expect(profesorActivoDictaMateria("p1", "m1", conTx)).resolves.toBe(true);
    await expect(profesorActivoDictaMateria("p1", "m2", conTx)).resolves.toBe(false);
    const consulta = (tx.$queryRaw.mock.calls[0]![0] as TemplateStringsArray).join("?");
    expect(consulta).toContain(`FROM "profesores" p`);
    expect(consulta).toContain(`JOIN "profesor_materia" pm ON pm."profesorId" = p."idProfesor"`);
    expect(consulta).toContain(`p."activoProfesor" = true`);
    expect(consulta).toMatch(/FOR SHARE OF pm\s*$/);
    expect(tx.$queryRaw.mock.calls[0]!.slice(1)).toEqual(["p1", "m1"]);
    expect(db.profesor.findFirst).not.toHaveBeenCalled();
    expect(tx.profesor.findFirst).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});
