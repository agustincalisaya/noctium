import { beforeEach, describe, expect, it, vi } from "vitest";

const { materiaActiva, profesorActivo, dictaMateria, horarios } = vi.hoisted(() => ({
  materiaActiva: vi.fn(), profesorActivo: vi.fn(), dictaMateria: vi.fn(), horarios: vi.fn(),
}));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: materiaActiva }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  obtenerOpcionProfesorActivo: profesorActivo,
  profesorActivoDictaMateria: dictaMateria,
  obtenerHorariosDeAtencion: horarios,
}));

const { listarFranjasProfesor } = await import("./turno.franjas.service");
const profesorId = "ckprofesor000000000000001";
const materiaId = "materia-1";
const franjas = [{ horario_id: "ckhorario000000000000001", dia_semana: "JUEVES", hora_inicio: "15:00", hora_fin: "19:00" }];

beforeEach(() => {
  vi.clearAllMocks();
  materiaActiva.mockResolvedValue({ idMateria: materiaId });
  profesorActivo.mockResolvedValue({ id: profesorId });
  dictaMateria.mockResolvedValue(true);
  horarios.mockResolvedValue(franjas);
});

describe("listarFranjasProfesor", () => {
  it("devuelve solo las franjas del profesor desde el contrato público", async () => {
    await expect(listarFranjasProfesor(profesorId, materiaId)).resolves.toEqual(franjas);
    expect(horarios).toHaveBeenCalledExactlyOnceWith(profesorId);
    expect(dictaMateria).toHaveBeenCalledExactlyOnceWith(profesorId, materiaId);
  });

  it("devuelve lista vacía si el profesor no tiene horarios", async () => {
    horarios.mockResolvedValueOnce([]);
    await expect(listarFranjasProfesor(profesorId, materiaId)).resolves.toEqual([]);
  });

  it("rechaza materia inactiva antes de consultar profesor", async () => {
    materiaActiva.mockResolvedValueOnce(null);
    await expect(listarFranjasProfesor(profesorId, materiaId)).rejects.toMatchObject({ code: "MATERIA_NO_DISPONIBLE" });
    expect(profesorActivo).not.toHaveBeenCalled();
  });

  it("rechaza profesor inexistente o inactivo", async () => {
    profesorActivo.mockResolvedValueOnce(null);
    await expect(listarFranjasProfesor(profesorId, materiaId)).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
    expect(horarios).not.toHaveBeenCalled();
  });

  it("rechaza profesor que no dicta la materia", async () => {
    dictaMateria.mockResolvedValueOnce(false);
    await expect(listarFranjasProfesor(profesorId, materiaId)).rejects.toMatchObject({ code: "PROFESOR_NO_DICTA_MATERIA" });
    expect(horarios).not.toHaveBeenCalled();
  });
});
