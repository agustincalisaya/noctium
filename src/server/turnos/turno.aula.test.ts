import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, turnoLectura, evento, vigente, materiaActiva, aulaActiva, hayAulas, existe, listarAulas } = vi.hoisted(() => ({
  tx: { turno: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() } },
  turnoLectura: vi.fn(), evento: vi.fn(), vigente: vi.fn(), materiaActiva: vi.fn(),
  aulaActiva: vi.fn(), hayAulas: vi.fn(), existe: vi.fn(), listarAulas: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn((callback) => callback(tx)), turno: { findUnique: turnoLectura }, eventoTurno: { create: evento } } }));
vi.mock("@/server/aulas/aula.service", () => ({ verificarAulaActiva: aulaActiva, hayAulasActivas: hayAulas, existeAula: existe, listarAulasActivasParaTurno: listarAulas }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: materiaActiva }));
vi.mock("@/server/turnos/turno.validaciones", () => ({ turnoSigueVigente: vigente }));
vi.mock("@/server/profesores/profesor.service", () => ({
  intervalosSeSuperponen: (a: { inicio: number; fin: number }, b: { inicio: number; fin: number }) => a.inicio < b.fin && b.inicio < a.fin,
}));
vi.mock("@/server/alumnos/alumno.service", () => ({}));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: vi.fn() }));

const { asignarAulaTurno, listarOpcionesAulaTurno } = await import("./turno.aula.service");
const TURNO = "ckturno00000000000000001";
const AULA = "ckaula0000000000000000001";
const USUARIO = "ckusuario0000000000000001";
const turno = {
  idTurno: TURNO, fechaTurno: new Date("2026-10-01T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"),
  duracionMinutosTurno: 60, materiaId: "ckmateria0000000000000001", _count: { alumnos: 0 },
};
const ejecutar = () => asignarAulaTurno(TURNO, { aula_id: AULA }, USUARIO);

beforeEach(() => {
  vi.clearAllMocks();
  tx.turno.findUnique.mockReset()
    .mockImplementation(async ({ select }) => select.updatedAtTurno ? { estadoTurno: "PENDIENTE", updatedAtTurno: new Date("2026-09-24T00:00:00.000Z") } : turno);
  tx.turno.findMany.mockResolvedValue([]);
  tx.turno.updateMany.mockResolvedValue({ count: 1 });
  vigente.mockReturnValue(true); materiaActiva.mockResolvedValue({ idMateria: turno.materiaId });
  aulaActiva.mockResolvedValue({ idAula: AULA, capacidadAula: 30 }); hayAulas.mockResolvedValue(true); existe.mockResolvedValue(true);
  evento.mockResolvedValue({});
});

describe("HU-C-15 §2.3 asignarAulaTurno (Revisión 3)", () => {
  it("fija cupoMaximoTurno con la capacidad del aula y deja el turno PENDIENTE", async () => {
    await expect(ejecutar()).resolves.toEqual({ id: TURNO, aula_id: AULA, cupo_maximo: 30, estado: "PENDIENTE" });
    expect(tx.turno.updateMany).toHaveBeenLastCalledWith({
      where: { idTurno: TURNO, estadoTurno: "PENDIENTE" },
      data: { aulaId: AULA, cupoMaximoTurno: 30, modificadoPorUsuarioId: USUARIO },
    });
    for (const [{ data }] of tx.turno.updateMany.mock.calls) expect(data).not.toHaveProperty("estadoTurno");
  });
  it("emite solo turno:aula_asignada, con cupo_maximo", async () => {
    await ejecutar();
    expect(evento).toHaveBeenCalledTimes(1);
    expect(evento.mock.calls[0]![0].data).toMatchObject({ tipoEvento: "turno:aula_asignada", payloadEvento: { turno_id: TURNO, aula_id: AULA, cupo_maximo: 30, usuario_id: USUARIO } });
  });
  it("defensivo: rechaza reasignar un aula con menos capacidad que los alumnos ya cargados", async () => {
    tx.turno.findUnique.mockImplementation(async ({ select }) => select.updatedAtTurno ? { estadoTurno: "PENDIENTE", updatedAtTurno: new Date() } : { ...turno, _count: { alumnos: 4 } });
    aulaActiva.mockResolvedValueOnce({ idAula: AULA, capacidadAula: 3 });
    await expect(ejecutar()).rejects.toMatchObject({ code: "AULA_CAPACIDAD_INSUFICIENTE", message: "El aula elegida tiene menos capacidad que los alumnos ya inscriptos en este turno" });
    expect(tx.turno.updateMany).toHaveBeenCalledTimes(1); // solo el bloqueo optimista, sin guardar el aula
    aulaActiva.mockResolvedValueOnce({ idAula: AULA, capacidadAula: 4 });
    await expect(ejecutar()).resolves.toMatchObject({ cupo_maximo: 4 });
  });
  it("separa sin aulas activas, aula inexistente e inactiva", async () => {
    aulaActiva.mockResolvedValue(null);
    hayAulas.mockResolvedValueOnce(false);
    await expect(ejecutar()).rejects.toMatchObject({ code: "SIN_AULAS_ACTIVAS" });
    existe.mockResolvedValueOnce(false);
    await expect(ejecutar()).rejects.toMatchObject({ code: "AULA_NO_ENCONTRADA" });
    await expect(ejecutar()).rejects.toMatchObject({ code: "AULA_INACTIVA" });
    expect(evento).not.toHaveBeenCalled();
  });
  it("rechaza un aula ocupada por un turno confirmado superpuesto; los contiguos no chocan", async () => {
    tx.turno.findMany.mockResolvedValueOnce([{ horaInicioTurno: new Date("1970-01-01T10:30:00.000Z"), duracionMinutosTurno: 60 }]);
    await expect(ejecutar()).rejects.toMatchObject({ code: "AULA_NO_DISPONIBLE" });
    expect(tx.turno.findMany.mock.calls[0]![0].where).toMatchObject({ idTurno: { not: TURNO }, aulaId: AULA, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] } });
    tx.turno.findMany.mockResolvedValueOnce([{ horaInicioTurno: new Date("1970-01-01T11:00:00.000Z"), duracionMinutosTurno: 60 }]);
    await expect(ejecutar()).resolves.toMatchObject({ estado: "PENDIENTE" });
  });
  it("rechaza turno confirmado, vencido o modificado en paralelo", async () => {
    tx.turno.findUnique.mockResolvedValueOnce({ estadoTurno: "DISPONIBLE", updatedAtTurno: new Date() });
    await expect(ejecutar()).rejects.toMatchObject({ code: "TURNO_YA_DISPONIBLE" });
    vigente.mockReturnValueOnce(false);
    await expect(ejecutar()).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
    tx.turno.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(ejecutar()).rejects.toMatchObject({ code: "TURNO_MODIFICADO" });
    expect(evento).not.toHaveBeenCalled();
  });
});

describe("HU-C-15 §2.3 listarOpcionesAulaTurno", () => {
  beforeEach(() => { hayAulas.mockResolvedValue(true); listarAulas.mockResolvedValue([{ id: AULA, nombre: "Aula 1", capacidad: 10 }]); });
  it("sin turno (alta) lista todas las aulas activas", async () => {
    await expect(listarOpcionesAulaTurno()).resolves.toEqual([{ id: AULA, nombre: "Aula 1", capacidad: 10 }]);
    expect(turnoLectura).not.toHaveBeenCalled();
    expect(listarAulas).toHaveBeenCalledWith(1);
  });
  it("con turno exige PENDIENTE y usa los alumnos ya cargados como capacidad mínima", async () => {
    turnoLectura.mockResolvedValueOnce({ estadoTurno: "PENDIENTE", _count: { alumnos: 4 } });
    await listarOpcionesAulaTurno(TURNO);
    expect(listarAulas).toHaveBeenCalledWith(4);
    turnoLectura.mockResolvedValueOnce({ estadoTurno: "COMPLETO", _count: { alumnos: 1 } });
    await expect(listarOpcionesAulaTurno(TURNO)).rejects.toMatchObject({ code: "TURNO_YA_DISPONIBLE" });
    turnoLectura.mockResolvedValueOnce(null);
    await expect(listarOpcionesAulaTurno(TURNO)).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
  });
  it("informa SIN_AULAS_ACTIVAS", async () => {
    hayAulas.mockResolvedValueOnce(false);
    await expect(listarOpcionesAulaTurno()).rejects.toMatchObject({ code: "SIN_AULAS_ACTIVAS" });
  });
});
