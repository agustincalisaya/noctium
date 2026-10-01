import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prismaTurno, evento, alumno, activo, vigente, materias, profesores } = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    turno: { findUniqueOrThrow: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    turnoAlumno: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
  prismaTurno: { findMany: vi.fn() },
  evento: vi.fn(), alumno: vi.fn(), activo: vi.fn(), vigente: vi.fn(), materias: vi.fn(), profesores: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: vi.fn((callback) => callback(tx)), turno: prismaTurno, eventoTurno: { create: evento },
} }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnoDeUsuario: alumno }));
vi.mock("@/server/alumnos/alumno.service", () => ({ verificarAlumnoActivo: activo }));
vi.mock("@/server/materias/materia.service", () => ({ listarMateriasActivas: materias, verificarMateriaActiva: vi.fn() }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  listarProfesoresActivosPorMateria: profesores,
  profesorActivoDictaMateria: vi.fn(), estaDentroDeHorarioAtencion: vi.fn(),
  intervalosSeSuperponen: (a: { inicio: number; fin: number }, b: { inicio: number; fin: number }) => a.inicio < b.fin && b.inicio < a.fin,
}));
vi.mock("@/server/turnos/turno.validaciones", () => ({ turnoSigueVigente: vigente }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: vi.fn() }));

const { listarOpcionesInscripcion, solicitarTurnoPropio } = await import("./turno.service");
const { OpcionesInscripcionQuerySchema } = await import("./turno.schema");
const USUARIO = "usuario-alumno";
const ALUMNO = "alumno-de-sesion";
const TURNO = "turno-disponible";
const MATERIA = "materia-matematica";
const PROFESOR = "profesor-gomez";
const horario = { fechaTurno: new Date("2026-10-01T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60 };
const disponible = { idTurno: TURNO, ...horario, materiaId: MATERIA, profesorId: PROFESOR, aula: { nombreAula: "Aula 4" }, cupoMaximoTurno: 3, _count: { alumnos: 1 } };

beforeEach(() => {
  vi.clearAllMocks();
  alumno.mockResolvedValue({ id: ALUMNO, activo: true });
  activo.mockResolvedValue(true);
  vigente.mockReturnValue(true);
  prismaTurno.findMany.mockResolvedValue([disponible]);
  materias.mockResolvedValue([{ idMateria: MATERIA, nombreMateria: "Matemática" }]);
  profesores.mockResolvedValue([{ id: PROFESOR, nombre: "Ana", apellido: "Gómez" }]);
  tx.$queryRaw.mockResolvedValue([{ idTurno: TURNO, estadoTurno: "DISPONIBLE", cupoMaximoTurno: 3 }]);
  tx.turno.findUniqueOrThrow.mockResolvedValue(horario);
  tx.turno.findMany.mockResolvedValue([]);
  tx.turnoAlumno.findUnique.mockResolvedValue(null);
  tx.turnoAlumno.count.mockResolvedValue(1);
  tx.turnoAlumno.create.mockResolvedValue({});
  tx.turnoAlumno.findMany.mockResolvedValue([{ alumnoId: ALUMNO }]);
  tx.turno.updateMany.mockResolvedValue({ count: 1 });
  evento.mockResolvedValue({});
});

describe("HU-C-12 §2.14.2 opciones", () => {
  it("exige materia antes de profesor", () => {
    expect(OpcionesInscripcionQuerySchema.safeParse({ profesor_id: PROFESOR }).success).toBe(false);
    expect(OpcionesInscripcionQuerySchema.safeParse({ materia_id: MATERIA, profesor_id: PROFESOR }).success).toBe(true);
  });

  it("filtra materias y profesores por turnos inscribibles del alumno autenticado", async () => {
    expect(await listarOpcionesInscripcion({}, USUARIO)).toEqual({ items: [{ id: MATERIA, nombre: "Matemática", turnos_con_lugar: 1 }] });
    expect(await listarOpcionesInscripcion({ materia_id: MATERIA }, USUARIO)).toEqual({ items: [{ id: PROFESOR, nombre: "Gómez, Ana", turnos_con_lugar: 1 }] });
    expect(prismaTurno.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ estadoTurno: "DISPONIBLE", alumnos: { none: { alumnoId: ALUMNO } } }),
    }));
  });

  it("devuelve horario, aula informativa y cupo sin datos de otros alumnos", async () => {
    const respuesta = await listarOpcionesInscripcion({ materia_id: MATERIA, profesor_id: PROFESOR }, USUARIO);
    expect(respuesta).toEqual({ items: [{ turno_id: TURNO, fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", aula: "Aula 4", cupos_libres: 2 }] });
    expect(JSON.stringify(respuesta)).not.toMatch(/alumno/);
  });

  it("descarta turnos vencidos y sin cupo y devuelve lista vacía para la combinación", async () => {
    vigente.mockReturnValueOnce(false).mockReturnValue(true);
    prismaTurno.findMany.mockResolvedValueOnce([disponible, { ...disponible, idTurno: "turno-lleno", _count: { alumnos: 3 } }]);
    expect(await listarOpcionesInscripcion({ materia_id: MATERIA, profesor_id: PROFESOR }, USUARIO)).toEqual({ items: [] });
  });

  it("rechaza cuentas sin ficha o con ficha inactiva", async () => {
    alumno.mockResolvedValueOnce(null);
    await expect(listarOpcionesInscripcion({}, USUARIO)).rejects.toMatchObject({ code: "SIN_PERMISO" });
    alumno.mockResolvedValueOnce({ id: ALUMNO, activo: false });
    await expect(listarOpcionesInscripcion({}, USUARIO)).rejects.toMatchObject({ code: "ALUMNO_INACTIVO" });
    expect(prismaTurno.findMany).not.toHaveBeenCalled();
  });
});

describe("HU-C-12 §2.14.2 inscripción", () => {
  it("inscribe a la ficha de la sesión, bloquea turno y emite el origen después de insertar", async () => {
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).resolves.toEqual({ id: TURNO, alumnos_inscriptos: "2/3", estado: "DISPONIBLE" });
    expect(alumno).toHaveBeenCalledWith(USUARIO);
    expect(tx.turnoAlumno.create).toHaveBeenCalledWith({ data: { turnoId: TURNO, alumnoId: ALUMNO } });
    const [sql] = tx.$queryRaw.mock.calls[0]!;
    expect(sql.join("?")).toContain("FOR UPDATE");
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.turnoAlumno.count.mock.invocationCallOrder[0]);
    expect(tx.turnoAlumno.create.mock.invocationCallOrder[0]).toBeLessThan(evento.mock.invocationCallOrder[0]);
    expect(evento.mock.calls[0]![0].data.payloadEvento).toEqual({ turno_id: TURNO, alumno_id: ALUMNO, usuario_id: USUARIO, origen: "AUTOSERVICIO" });
  });

  it("pasa a COMPLETO cuando toma el último lugar", async () => {
    tx.turnoAlumno.count.mockResolvedValueOnce(2);
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).resolves.toMatchObject({ alumnos_inscriptos: "3/3", estado: "COMPLETO" });
    expect(tx.turno.updateMany).toHaveBeenCalledWith({ where: { idTurno: TURNO, estadoTurno: "DISPONIBLE" }, data: { estadoTurno: "COMPLETO", modificadoPorUsuarioId: USUARIO } });
    expect(evento.mock.calls.map(([{ data }]) => data.tipoEvento)).toEqual(["turno:alumno_agregado", "turno:completado"]);
  });

  it.each(["PENDIENTE", "CANCELADO"])("rechaza turno %s", async (estadoTurno) => {
    tx.$queryRaw.mockResolvedValueOnce([{ idTurno: TURNO, estadoTurno, cupoMaximoTurno: 3 }]);
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "TURNO_NO_DISPONIBLE" });
    expect(tx.turnoAlumno.create).not.toHaveBeenCalled();
  });

  it("rechaza turno completo, vencido, inscripción repetida y cupo ocupado al confirmar", async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ idTurno: TURNO, estadoTurno: "COMPLETO", cupoMaximoTurno: 3 }]);
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE" });
    vigente.mockReturnValueOnce(false);
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
    tx.turnoAlumno.findUnique.mockResolvedValueOnce({ turnoId: TURNO, alumnoId: ALUMNO });
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "ALUMNO_YA_ASIGNADO" });
    tx.turnoAlumno.count.mockResolvedValueOnce(3);
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE" });
    expect(tx.turnoAlumno.create).not.toHaveBeenCalled();
    expect(evento).not.toHaveBeenCalled();
  });

  it("rechaza superposición al confirmar con el mensaje del alumno", async () => {
    tx.turno.findMany.mockResolvedValueOnce([{ horaInicioTurno: new Date("1970-01-01T10:30:00.000Z"), duracionMinutosTurno: 60, alumnos: [{ alumnoId: ALUMNO }] }]);
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", message: "Ya tenés otro turno en ese horario" });
    expect(tx.turnoAlumno.create).not.toHaveBeenCalled();
  });
});
