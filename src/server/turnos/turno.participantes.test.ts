import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/server/shared/service-error";

const { tx, evento, vigente, activo, profesores, horario } = vi.hoisted(() => ({
  tx: {
    turno: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    turnoAlumno: { deleteMany: vi.fn(), create: vi.fn() },
  },
  evento: vi.fn(), vigente: vi.fn(), activo: vi.fn(), profesores: vi.fn(), horario: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn((callback) => callback(tx)), eventoTurno: { create: evento } } }));
vi.mock("@/server/alumnos/alumno.service", () => ({ verificarAlumnoActivo: activo }));
vi.mock("@/server/profesores/profesor.service", () => ({
  profesorActivoDictaMateria: vi.fn(), listarProfesoresActivosPorMateria: profesores,
  estaDentroDeHorarioAtencion: horario,
  intervalosSeSuperponen: (a: { inicio: number; fin: number }, b: { inicio: number; fin: number }) => a.inicio < b.fin && b.inicio < a.fin,
}));
vi.mock("@/server/turnos/turno.validaciones", () => ({ turnoSigueVigente: vigente }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: vi.fn() }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: vi.fn() }));

const { asignarParticipantesTurno } = await import("./turno.service");
const { AsignarParticipantesTurnoSchema } = await import("./turno.schema");
const A = "ckalumno00000000000000001";
const P = "ckprofesor000000000000001";
const TURNO = "ckturno00000000000000001";
const USUARIO = "ckusuario0000000000000001";
const turno = {
  idTurno: TURNO, estadoTurno: "PENDIENTE", fechaTurno: new Date("2026-10-01T00:00:00.000Z"),
  horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60,
  materiaId: "ckmateria0000000000000001", updatedAtTurno: new Date("2026-09-23T00:00:00.000Z"),
};
const agendado = (inicio: string, duracionMinutosTurno: number, profesorId: string | null, alumno: boolean) => ({
  profesorId, horaInicioTurno: new Date(`1970-01-01T${inicio}:00.000Z`), duracionMinutosTurno,
  alumnos: alumno ? [{ alumnoId: A }] : [],
});
const ejecutar = () => asignarParticipantesTurno(TURNO, { alumno_id: A, profesor_id: P }, USUARIO);

beforeEach(() => {
  vi.clearAllMocks();
  tx.turno.findUnique.mockResolvedValue(turno);
  tx.turno.findMany.mockResolvedValue([]);
  tx.turno.updateMany.mockResolvedValue({ count: 1 });
  tx.turnoAlumno.deleteMany.mockResolvedValue({ count: 1 });
  tx.turnoAlumno.create.mockResolvedValue({});
  evento.mockResolvedValue({}); vigente.mockReturnValue(true); activo.mockResolvedValue(true);
  profesores.mockResolvedValue([{ id: P, nombre: "Ana", apellido: "Pérez" }]); horario.mockResolvedValue(true);
});

describe("HU-C-04 asignar participantes", () => {
  it("valida CUID y usa las claves snake_case del contrato", () => {
    expect(AsignarParticipantesTurnoSchema.safeParse({ alumno_id: A, profesor_id: P }).success).toBe(true);
    expect(AsignarParticipantesTurnoSchema.safeParse({ alumno_id: "1", profesor_id: P }).success).toBe(false);
    expect(AsignarParticipantesTurnoSchema.safeParse({ alumnoId: A, profesorId: P }).success).toBe(false);
  });
  it("asigna exactamente un alumno, profesor y conserva PENDIENTE", async () => {
    await expect(ejecutar()).resolves.toEqual({ id: TURNO, alumno_id: A, profesor_id: P, estado: "PENDIENTE" });
    expect(tx.turno.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ estadoTurno: "PENDIENTE", updatedAtTurno: turno.updatedAtTurno }), data: { profesorId: P, modificadoPorUsuarioId: USUARIO } }));
    expect(tx.turnoAlumno.deleteMany).toHaveBeenCalledWith({ where: { turnoId: TURNO } });
    expect(tx.turnoAlumno.create).toHaveBeenCalledTimes(1);
    expect(tx.turnoAlumno.create).toHaveBeenCalledWith({ data: { turnoId: TURNO, alumnoId: A } });
    expect(evento).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipoEvento: "turno:participantes_asignados" }) }));
  });
  it("reemplaza alumno y profesor sin acumular vínculos", async () => {
    await ejecutar();
    expect(tx.turnoAlumno.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(tx.turnoAlumno.create.mock.invocationCallOrder[0]);
    expect(tx.turnoAlumno.create).toHaveBeenCalledTimes(1);
  });
  it("permite reemplazar solo alumno, solo profesor o ambos", async () => {
    const otroAlumno = "ckalumno00000000000000002";
    const otroProfesor = "ckprofesor000000000000002";
    profesores.mockResolvedValue([{ id: P }, { id: otroProfesor }]);
    for (const [alumno_id, profesor_id] of [[otroAlumno, P], [A, otroProfesor], [otroAlumno, otroProfesor]]) {
      vi.clearAllMocks();
      tx.turno.findUnique.mockResolvedValue(turno); tx.turno.findMany.mockResolvedValue([]);
      tx.turno.updateMany.mockResolvedValue({ count: 1 }); tx.turnoAlumno.deleteMany.mockResolvedValue({ count: 1 });
      tx.turnoAlumno.create.mockResolvedValue({}); evento.mockResolvedValue({}); vigente.mockReturnValue(true);
      activo.mockResolvedValue(true); horario.mockResolvedValue(true);
      profesores.mockResolvedValue([{ id: P }, { id: otroProfesor }]);
      await expect(asignarParticipantesTurno(TURNO, { alumno_id, profesor_id }, USUARIO)).resolves.toMatchObject({ alumno_id, profesor_id });
      expect(tx.turnoAlumno.deleteMany).toHaveBeenCalledTimes(1);
      expect(tx.turnoAlumno.create).toHaveBeenCalledWith({ data: { turnoId: TURNO, alumnoId: alumno_id } });
    }
  });
  it("rechaza turno agendado, vencido y modificación concurrente", async () => {
    tx.turno.findUnique.mockResolvedValueOnce({ ...turno, estadoTurno: "AGENDADO" });
    await expect(ejecutar()).rejects.toMatchObject({ code: "TURNO_YA_AGENDADO" });
    vigente.mockReturnValueOnce(false);
    await expect(ejecutar()).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
    tx.turno.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(ejecutar()).rejects.toMatchObject({ code: "TURNO_MODIFICADO" });
    expect(tx.turnoAlumno.deleteMany).not.toHaveBeenCalled();
    expect(evento).not.toHaveBeenCalled();
  });
  it("rechaza alumno inactivo, profesor sin materia y ausencia de profesores", async () => {
    activo.mockResolvedValueOnce(false);
    await expect(ejecutar()).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE" });
    profesores.mockResolvedValueOnce([]);
    await expect(ejecutar()).rejects.toMatchObject({ code: "SIN_PROFESORES_PARA_MATERIA", message: "No hay profesores activos asociados a esta materia" });
    profesores.mockResolvedValueOnce([{ id: "otro" }]);
    await expect(ejecutar()).rejects.toMatchObject({ code: "PROFESOR_NO_APTO" });
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
  });
  it("rechaza profesor fuera del horario de atención", async () => {
    horario.mockResolvedValueOnce(false);
    await expect(ejecutar()).rejects.toMatchObject({ code: "PROFESOR_FUERA_DE_HORARIO", message: "El turno está fuera del horario de atención del profesor" });
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
  });
  it("rechaza un turno AGENDADO superpuesto del profesor con horario concreto", async () => {
    tx.turno.findMany.mockResolvedValueOnce([agendado("10:00", 60, P, false)]);
    await expect(ejecutar()).rejects.toMatchObject({ code: "PROFESOR_NO_DISPONIBLE", message: "El profesor ya tiene un turno agendado de 10:00 a 11:00" });
    expect(tx.turnoAlumno.deleteMany).not.toHaveBeenCalled();
  });
  it("permite un turno contiguo y consulta exclusivamente AGENDADO, excluyendo el propio", async () => {
    tx.turno.findMany.mockResolvedValueOnce([agendado("11:00", 60, P, true)]);
    await expect(ejecutar()).resolves.toMatchObject({ estado: "PENDIENTE" });
    expect(tx.turno.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ idTurno: { not: TURNO }, estadoTurno: "AGENDADO" }) }));
  });
  it("rechaza un turno AGENDADO superpuesto del alumno", async () => {
    tx.turno.findMany.mockResolvedValueOnce([agendado("10:30", 60, null, true)]);
    await expect(ejecutar()).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", message: "El alumno ya tiene un turno agendado en ese horario" });
    expect(tx.turnoAlumno.deleteMany).not.toHaveBeenCalled();
  });
  it("no emite evento si falla el reemplazo dentro de la transacción", async () => {
    tx.turnoAlumno.create.mockRejectedValueOnce(new Error("inserción fallida"));
    await expect(ejecutar()).rejects.toThrow("inserción fallida");
    expect(evento).not.toHaveBeenCalled();
  });
  it("dos confirmaciones concurrentes del mismo turno dejan una sola asignación", async () => {
    tx.turno.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const resultados = await Promise.allSettled([ejecutar(), ejecutar()]);
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((resultado) => resultado.status === "rejected" && resultado.reason instanceof ServiceError && resultado.reason.code === "TURNO_MODIFICADO")).toHaveLength(1);
    expect(tx.turnoAlumno.create).toHaveBeenCalledTimes(1);
  });
});
