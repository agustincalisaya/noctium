import { beforeEach, describe, expect, it, vi } from "vitest";

const { turno, profesores, horario } = vi.hoisted(() => ({
  turno: { findUnique: vi.fn(), findMany: vi.fn() }, profesores: vi.fn(), horario: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { turno } }));
vi.mock("@/server/profesores/profesor.service", () => ({
  listarProfesoresActivosPorMateria: profesores, estaDentroDeHorarioAtencion: horario,
  intervalosSeSuperponen: (a: { inicio: number; fin: number }, b: { inicio: number; fin: number }) => a.inicio < b.fin && b.inicio < a.fin,
}));

const { listarOpcionesProfesorTurno } = await import("./turno.profesor.service");
const TURNO = "ckturno00000000000000001";
const [ANA, BETO, CARLA] = ["ckprofesor000000000000001", "ckprofesor000000000000002", "ckprofesor000000000000003"];
const actual = {
  idTurno: TURNO, estadoTurno: "PENDIENTE", fechaTurno: new Date("2026-10-01T00:00:00.000Z"),
  horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60, materiaId: "ckmateria0000000000000001",
};
const otro = (profesorId: string, inicio: string) => ({ profesorId, horaInicioTurno: new Date(`1970-01-01T${inicio}:00.000Z`), duracionMinutosTurno: 60 });

beforeEach(() => {
  vi.clearAllMocks();
  turno.findUnique.mockResolvedValue(actual);
  turno.findMany.mockResolvedValue([]);
  profesores.mockResolvedValue([{ id: ANA, nombre: "Ana", apellido: "Gómez" }, { id: BETO, nombre: "Beto", apellido: "López" }, { id: CARLA, nombre: "Carla", apellido: "Ruiz" }]);
  horario.mockResolvedValue(true);
});

describe("HU-C-04 §2.6 listarOpcionesProfesorTurno", () => {
  it("devuelve los profesores de la materia libres y dentro de su horario, en el formato { id, nombre, apellido }", async () => {
    await expect(listarOpcionesProfesorTurno(TURNO)).resolves.toEqual([
      { id: ANA, nombre: "Ana", apellido: "Gómez" }, { id: BETO, nombre: "Beto", apellido: "López" }, { id: CARLA, nombre: "Carla", apellido: "Ruiz" },
    ]);
    expect(profesores).toHaveBeenCalledWith(actual.materiaId);
    expect(horario).toHaveBeenCalledWith(ANA, actual.fechaTurno, "10:00", "11:00");
  });
  it("excluye a quien tiene un turno DISPONIBLE/COMPLETO superpuesto y a quien no atiende en ese horario", async () => {
    turno.findMany.mockResolvedValueOnce([otro(ANA, "10:30"), otro(BETO, "11:00")]);
    horario.mockImplementation(async (profesorId: string) => profesorId !== CARLA);
    await expect(listarOpcionesProfesorTurno(TURNO)).resolves.toEqual([{ id: BETO, nombre: "Beto", apellido: "López" }]);
    expect(turno.findMany.mock.calls[0]![0].where).toMatchObject({
      idTurno: { not: TURNO }, fechaTurno: actual.fechaTurno, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }, profesorId: { in: [ANA, BETO, CARLA] },
    });
    expect(turno.findMany).toHaveBeenCalledTimes(1);
  });
  it("devuelve lista vacía si ninguno está disponible en ese horario", async () => {
    horario.mockResolvedValue(false);
    await expect(listarOpcionesProfesorTurno(TURNO)).resolves.toEqual([]);
  });
  it("distingue una materia sin profesores activos", async () => {
    profesores.mockResolvedValueOnce([]);
    await expect(listarOpcionesProfesorTurno(TURNO)).rejects.toMatchObject({ code: "SIN_PROFESORES_PARA_MATERIA", message: "No hay profesores activos asociados a esta materia" });
  });
  it("rechaza turno inexistente o ya confirmado", async () => {
    turno.findUnique.mockResolvedValueOnce(null);
    await expect(listarOpcionesProfesorTurno(TURNO)).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
    turno.findUnique.mockResolvedValueOnce({ ...actual, estadoTurno: "DISPONIBLE" });
    await expect(listarOpcionesProfesorTurno(TURNO)).rejects.toMatchObject({ code: "TURNO_YA_DISPONIBLE" });
  });
});
