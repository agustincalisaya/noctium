import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, alumnoActivo, materias, profesorUsuario, profesorAtendio, parametro } = vi.hoisted(() => ({
  tx: {
    claseDictadaAlumno: { findMany: vi.fn(), findFirst: vi.fn() },
    resultadoExamen: { create: vi.fn() },
  },
  alumnoActivo: vi.fn(), materias: vi.fn(), profesorUsuario: vi.fn(), profesorAtendio: vi.fn(), parametro: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn((callback: (cliente: typeof tx) => unknown) => callback(tx)) },
}));
vi.mock("@/server/alumnos/alumno.publico", () => ({ verificarAlumnoActivo: alumnoActivo }));
vi.mock("@/server/materias/materia.publico", () => ({ obtenerMateriasPorIds: materias }));
vi.mock("@/server/profesores/profesor.publico", () => ({ obtenerOpcionProfesorDeUsuario: profesorUsuario }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: parametro }));
vi.mock("./historial.publico", () => ({ profesorAtendioAlumno: profesorAtendio }));

const { listarOpcionesExamen, registrarResultadoExamen } = await import("./resultado-examen.service");

const mesa = { id: "mesa-1", rol: "MESA_ENTRADA" as const };
const input = (cambios: Partial<{ materia_id: string; fecha_examen: Date; nota: string; observaciones?: string }> = {}) => ({
  materia_id: "materia-1", fecha_examen: new Date("2026-09-29T00:00:00.000Z"), nota: "8.5", ...cambios,
});

beforeEach(() => {
  vi.clearAllMocks();
  alumnoActivo.mockResolvedValue(undefined);
  tx.claseDictadaAlumno.findMany.mockResolvedValue([{ clase: { materiaId: "materia-1" } }]);
  tx.claseDictadaAlumno.findFirst.mockResolvedValue({ alumnoId: "alumno-1" });
  materias.mockResolvedValue([{ id: "materia-1", nombre: "Programación I" }]);
  profesorUsuario.mockResolvedValue({ id: "profesor-1", nombreParaMostrar: "Acuña, Sergio" });
  profesorAtendio.mockResolvedValue(true);
  parametro.mockImplementation((nombre: string) => Promise.resolve(nombre === "nota_minima" ? 1 : 10));
  tx.resultadoExamen.create.mockResolvedValue({
    idResultadoExamen: "examen-1", alumnoId: "alumno-1", materiaId: "materia-1",
    fechaExamen: new Date("2026-09-29T00:00:00.000Z"), notaExamen: { toFixed: () => "8.5" }, observaciones: null,
  });
});

describe("HU-E-06 listarOpcionesExamen", () => {
  it("deduplica las materias cursadas y devuelve la escala ordenada por nombre", async () => {
    tx.claseDictadaAlumno.findMany.mockResolvedValue([
      { clase: { materiaId: "materia-2" } },
      { clase: { materiaId: "materia-1" } },
      { clase: { materiaId: "materia-2" } },
    ]);
    materias.mockResolvedValue([
      { id: "materia-2", nombre: "Álgebra" },
      { id: "materia-1", nombre: "Física" },
    ]);

    await expect(listarOpcionesExamen("alumno-1", mesa)).resolves.toEqual({
      materias: [{ id: "materia-2", nombre: "Álgebra" }, { id: "materia-1", nombre: "Física" }],
      escala: { min: 1, max: 10 },
    });
    expect(tx.claseDictadaAlumno.findMany).toHaveBeenCalledWith({
      where: { alumnoId: "alumno-1" }, select: { clase: { select: { materiaId: true } } },
    });
    expect(materias).toHaveBeenCalledWith(["materia-2", "materia-1"], tx);
  });
});

describe("HU-E-06 registrarResultadoExamen", () => {
  it("crea un resultado con auditoría y normaliza la respuesta decimal", async () => {
    await expect(registrarResultadoExamen("alumno-1", input(), mesa)).resolves.toEqual({
      id: "examen-1", alumno_id: "alumno-1", materia_id: "materia-1", fecha_examen: "2026-09-29", nota: "8.5", observaciones: null,
    });

    expect(tx.resultadoExamen.create).toHaveBeenCalledWith({
      data: {
        alumnoId: "alumno-1", materiaId: "materia-1", fechaExamen: input().fecha_examen,
        notaExamen: "8.5", observaciones: null, creadoPorUsuarioId: "mesa-1",
      },
      select: { idResultadoExamen: true, alumnoId: true, materiaId: true, fechaExamen: true, notaExamen: true, observaciones: true },
    });
  });

  it("guarda la observación recortada y normaliza un campo vacío a null", async () => {
    await registrarResultadoExamen("alumno-1", input({ observaciones: "  Parcial de funciones  " }), mesa);
    expect(tx.resultadoExamen.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ observaciones: "Parcial de funciones" }),
    }));

    await registrarResultadoExamen("alumno-1", input({ observaciones: "   " }), mesa);
    expect(tx.resultadoExamen.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ observaciones: null }),
    }));
  });

  it("acepta más de un resultado para la misma materia sin reemplazar el anterior", async () => {
    tx.resultadoExamen.create
      .mockResolvedValueOnce({ idResultadoExamen: "examen-1", alumnoId: "alumno-1", materiaId: "materia-1", fechaExamen: new Date("2026-09-29T00:00:00.000Z"), notaExamen: { toFixed: () => "8.5" } })
      .mockResolvedValueOnce({ idResultadoExamen: "examen-2", alumnoId: "alumno-1", materiaId: "materia-1", fechaExamen: new Date("2026-09-30T00:00:00.000Z"), notaExamen: { toFixed: () => "6.0" } });

    const primero = await registrarResultadoExamen("alumno-1", input(), mesa);
    const segundo = await registrarResultadoExamen("alumno-1", input({ fecha_examen: new Date("2026-09-30T00:00:00.000Z"), nota: "6" }), mesa);

    expect(primero.id).toBe("examen-1");
    expect(segundo.id).toBe("examen-2");
    expect(tx.resultadoExamen.create).toHaveBeenCalledTimes(2);
  });

  it("rechaza una nota fuera de la escala y no escribe", async () => {
    await expect(registrarResultadoExamen("alumno-1", input({ nota: "11" }), mesa)).rejects.toMatchObject({
      code: "NOTA_FUERA_DE_RANGO", message: "La nota debe estar entre 1 y 10",
    });
    expect(tx.resultadoExamen.create).not.toHaveBeenCalled();
  });

  it("rechaza fechas futuras y materias que el alumno no cursó", async () => {
    await expect(registrarResultadoExamen("alumno-1", input({ fecha_examen: new Date("2999-01-01T00:00:00.000Z") }), mesa)).rejects.toMatchObject({
      code: "FECHA_EXAMEN_FUTURA",
    });
    tx.claseDictadaAlumno.findFirst.mockResolvedValue(null);
    await expect(registrarResultadoExamen("alumno-1", input(), mesa)).rejects.toMatchObject({ code: "MATERIA_NO_CURSADA" });
    expect(tx.resultadoExamen.create).not.toHaveBeenCalled();
  });

  it("niega al profesor que no atendió al alumno antes de verificar la ficha", async () => {
    profesorAtendio.mockResolvedValue(false);

    await expect(registrarResultadoExamen("alumno-privado", input(), { id: "prof-user", rol: "PROFESOR" })).rejects.toMatchObject({
      code: "SIN_PERMISO",
    });
    expect(profesorUsuario).toHaveBeenCalledWith("prof-user", tx);
    expect(alumnoActivo).not.toHaveBeenCalled();
    expect(tx.resultadoExamen.create).not.toHaveBeenCalled();
  });
});
