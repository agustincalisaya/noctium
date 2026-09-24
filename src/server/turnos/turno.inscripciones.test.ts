import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, evento, vigente, activo } = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    turno: { findUniqueOrThrow: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    turnoAlumno: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  },
  evento: vi.fn(), vigente: vi.fn(), activo: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn((callback) => callback(tx)), eventoTurno: { create: evento } } }));
vi.mock("@/server/alumnos/alumno.service", () => ({ verificarAlumnoActivo: activo }));
vi.mock("@/server/profesores/profesor.service", () => ({
  profesorActivoDictaMateria: vi.fn(), listarProfesoresActivosPorMateria: vi.fn(), estaDentroDeHorarioAtencion: vi.fn(),
  intervalosSeSuperponen: (a: { inicio: number; fin: number }, b: { inicio: number; fin: number }) => a.inicio < b.fin && b.inicio < a.fin,
}));
vi.mock("@/server/turnos/turno.validaciones", () => ({ turnoSigueVigente: vigente }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: vi.fn() }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: vi.fn() }));

const { agregarAlumnoTurno, quitarAlumnoTurno } = await import("./turno.service");
const { AgregarAlumnoTurnoSchema } = await import("./turno.schema");
const A = "ckalumno00000000000000001";
const TURNO = "ckturno00000000000000001";
const USUARIO = "ckusuario0000000000000001";
const horario = { fechaTurno: new Date("2026-10-01T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60 };
const bloqueado = (estadoTurno: string, cupoMaximoTurno = 3) => tx.$queryRaw.mockResolvedValueOnce([{ idTurno: TURNO, cupoMaximoTurno, estadoTurno }]);
const tipos = () => evento.mock.calls.map(([{ data }]) => data.tipoEvento);
const agregar = () => agregarAlumnoTurno(TURNO, { alumno_id: A }, USUARIO);
const quitar = () => quitarAlumnoTurno(TURNO, A, USUARIO);

beforeEach(() => {
  vi.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([{ idTurno: TURNO, cupoMaximoTurno: 3, estadoTurno: "DISPONIBLE" }]);
  tx.turno.findUniqueOrThrow.mockResolvedValue(horario);
  tx.turno.findMany.mockResolvedValue([]);
  tx.turno.updateMany.mockResolvedValue({ count: 1 });
  tx.turnoAlumno.findUnique.mockResolvedValue(null);
  tx.turnoAlumno.findMany.mockResolvedValue([{ alumnoId: "b" }, { alumnoId: "c" }, { alumnoId: A }]);
  tx.turnoAlumno.count.mockResolvedValue(1);
  tx.turnoAlumno.create.mockResolvedValue({});
  tx.turnoAlumno.deleteMany.mockResolvedValue({ count: 1 });
  evento.mockResolvedValue({}); vigente.mockReturnValue(true); activo.mockResolvedValue(true);
});

describe("HU-C-04 §2.5 agregar alumno", () => {
  it("valida alumno_id como CUID", () => {
    expect(AgregarAlumnoTurnoSchema.safeParse({ alumno_id: A }).success).toBe(true);
    expect(AgregarAlumnoTurnoSchema.safeParse({ alumno_id: "1" }).success).toBe(false);
  });
  it("bloquea la fila con FOR UPDATE antes de contar e insertar", async () => {
    await expect(agregar()).resolves.toEqual({ id: TURNO, alumno_id: A, alumnos_inscriptos: "2/3", estado: "DISPONIBLE" });
    const [sql, id] = tx.$queryRaw.mock.calls[0]!;
    expect(sql.join("?")).toMatch(/SELECT "idTurno", "cupoMaximoTurno", "estadoTurno" FROM turnos WHERE "idTurno" = \? FOR UPDATE/);
    expect(id).toBe(TURNO);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.turnoAlumno.count.mock.invocationCallOrder[0]);
    expect(tx.turnoAlumno.count.mock.invocationCallOrder[0]).toBeLessThan(tx.turnoAlumno.create.mock.invocationCallOrder[0]);
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
    expect(tipos()).toEqual(["turno:alumno_agregado"]);
  });
  it("al alcanzar el cupo transiciona a COMPLETO y emite turno:completado", async () => {
    tx.turnoAlumno.count.mockResolvedValueOnce(2);
    await expect(agregar()).resolves.toMatchObject({ alumnos_inscriptos: "3/3", estado: "COMPLETO" });
    expect(tx.turno.updateMany).toHaveBeenCalledWith({ where: { idTurno: TURNO, estadoTurno: "DISPONIBLE" }, data: { estadoTurno: "COMPLETO", modificadoPorUsuarioId: USUARIO } });
    expect(tipos()).toEqual(["turno:alumno_agregado", "turno:completado"]);
    expect(evento.mock.calls[1]![0].data.payloadEvento).toEqual({ turno_id: TURNO, alumno_ids: ["b", "c", A], cupo_maximo: 3, usuario_id: USUARIO });
  });
  it("rechaza un turno COMPLETO sin insertar", async () => {
    bloqueado("COMPLETO");
    await expect(agregar()).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE", message: "El turno alcanzó su cupo máximo" });
    expect(tx.turnoAlumno.create).not.toHaveBeenCalled();
  });
  it("rechaza si el conteo con la fila bloqueada ya alcanzó el cupo", async () => {
    tx.turnoAlumno.count.mockResolvedValueOnce(3);
    await expect(agregar()).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE" });
    expect(tx.turnoAlumno.create).not.toHaveBeenCalled();
    expect(evento).not.toHaveBeenCalled();
  });
  it("rechaza turno PENDIENTE, inexistente y vencido", async () => {
    bloqueado("PENDIENTE");
    await expect(agregar()).rejects.toMatchObject({ code: "TURNO_PENDIENTE" });
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(agregar()).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
    vigente.mockReturnValueOnce(false);
    await expect(agregar()).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
    expect(tx.turnoAlumno.create).not.toHaveBeenCalled();
  });
  it("rechaza alumno inactivo, repetido o con turno superpuesto, identificándolo", async () => {
    activo.mockResolvedValueOnce(false);
    await expect(agregar()).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", detalles: { alumno_id: A } });
    tx.turnoAlumno.findUnique.mockResolvedValueOnce({ turnoId: TURNO, alumnoId: A });
    await expect(agregar()).rejects.toMatchObject({ code: "ALUMNO_YA_ASIGNADO", message: "El mismo alumno no puede agregarse dos veces al mismo turno", detalles: { alumno_id: A } });
    tx.turno.findMany.mockResolvedValueOnce([{ horaInicioTurno: new Date("1970-01-01T10:30:00.000Z"), duracionMinutosTurno: 60, alumnos: [{ alumnoId: A }] }]);
    await expect(agregar()).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", message: "El alumno ya tiene un turno agendado en ese horario", detalles: { alumno_id: A } });
    expect(tx.turnoAlumno.create).not.toHaveBeenCalled();
  });
  it("un turno contiguo del alumno no es conflicto", async () => {
    tx.turno.findMany.mockResolvedValueOnce([{ horaInicioTurno: new Date("1970-01-01T11:00:00.000Z"), duracionMinutosTurno: 60, alumnos: [{ alumnoId: A }] }]);
    await expect(agregar()).resolves.toMatchObject({ estado: "DISPONIBLE" });
  });
});

describe("HU-C-04 §2.5 quitar alumno", () => {
  it("en un turno COMPLETO vuelve a DISPONIBLE y emite turno:disponible_nuevamente", async () => {
    bloqueado("COMPLETO");
    tx.turnoAlumno.count.mockResolvedValueOnce(2);
    await expect(quitar()).resolves.toEqual({ id: TURNO, alumno_id: A, alumnos_inscriptos: "2/3", estado: "DISPONIBLE" });
    expect(tx.turnoAlumno.deleteMany).toHaveBeenCalledWith({ where: { turnoId: TURNO, alumnoId: A } });
    expect(tx.turno.updateMany).toHaveBeenCalledWith({ where: { idTurno: TURNO, estadoTurno: "COMPLETO" }, data: { estadoTurno: "DISPONIBLE", modificadoPorUsuarioId: USUARIO } });
    expect(tipos()).toEqual(["turno:alumno_quitado", "turno:disponible_nuevamente"]);
    expect(evento.mock.calls[1]![0].data.payloadEvento).toEqual({ turno_id: TURNO, alumno_id_liberado: A, usuario_id: USUARIO });
  });
  it("en un turno DISPONIBLE no transiciona ni emite turno:disponible_nuevamente, aunque quede en 0", async () => {
    tx.turnoAlumno.count.mockResolvedValueOnce(0);
    await expect(quitar()).resolves.toMatchObject({ alumnos_inscriptos: "0/3", estado: "DISPONIBLE" });
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
    expect(tipos()).toEqual(["turno:alumno_quitado"]);
  });
  it("rechaza alumno no inscripto, turno PENDIENTE y vencido", async () => {
    tx.turnoAlumno.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(quitar()).rejects.toMatchObject({ code: "ALUMNO_NO_ASIGNADO", detalles: { alumno_id: A } });
    bloqueado("PENDIENTE");
    await expect(quitar()).rejects.toMatchObject({ code: "TURNO_PENDIENTE" });
    vigente.mockReturnValueOnce(false);
    await expect(quitar()).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
    expect(evento).not.toHaveBeenCalled();
  });
});
