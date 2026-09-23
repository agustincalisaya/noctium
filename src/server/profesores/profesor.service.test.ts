import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";

// Código escrito, no ejecutado — sin test runner instalado (HU-D-01 §6).
// HU-D-03: obtenerMateriasDelProfesor() y asociarMateriasAProfesor(), con
// `prisma` y el servicio público del módulo L mockeados.

const tx = {
  profesor: { updateMany: vi.fn(), findUnique: vi.fn() },
  profesorMateria: { findMany: vi.fn(), createMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profesorMateria: { findMany: vi.fn() },
    $transaction: vi.fn((callback: (cliente: typeof tx) => unknown) => callback(tx)),
  },
}));

vi.mock("@/server/materias/materia.service", () => ({
  bloquearMateriasParaAsociar: vi.fn(),
}));

const { prisma } = await import("@/lib/prisma");
const { bloquearMateriasParaAsociar } = await import("@/server/materias/materia.service");
const { asociarMateriasAProfesor, obtenerMateriasDelProfesor } = await import("./profesor.service");

const PROFESOR = "ckprofesor000000000000001";
const USUARIO = "ckusuario0000000000000001";
const FISICA = { id: "ckmateria0000000000000001", nombre: "Física", codigo: "FIS101", activa: true };
const QUIMICA = { id: "ckmateria0000000000000002", nombre: "Química", codigo: null, activa: true };
const HISTORIA = { id: "ckmateria0000000000000003", nombre: "Historia de la Ciencia", codigo: "HIS101", activa: false };

async function capturarError(promesa: Promise<unknown>): Promise<ServiceError> {
  try {
    await promesa;
  } catch (error) {
    return error as ServiceError;
  }
  throw new Error("Se esperaba un error");
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.profesor.updateMany.mockResolvedValue({ count: 1 });
  tx.profesorMateria.findMany.mockResolvedValue([]);
  tx.profesorMateria.createMany.mockResolvedValue({ count: 0 });
});

describe("obtenerMateriasDelProfesor", () => {
  it("devuelve activas e inactivas, con `activa` según el estado de cada materia", async () => {
    vi.mocked(prisma.profesorMateria.findMany).mockResolvedValue([
      { materia: { idMateria: FISICA.id, nombreMateria: "Física", codigoMateria: "FIS101", activaMateria: true } },
      { materia: { idMateria: HISTORIA.id, nombreMateria: "Historia de la Ciencia", codigoMateria: "HIS101", activaMateria: false } },
    ] as never);

    const materias = await obtenerMateriasDelProfesor(PROFESOR);

    expect(materias).toEqual([
      { id: FISICA.id, nombre: "Física", codigo: "FIS101", activa: true },
      { id: HISTORIA.id, nombre: "Historia de la Ciencia", codigo: "HIS101", activa: false },
    ]);
    // Sin filtro por activaMateria: las inactivas asociadas también vuelven.
    expect(prisma.profesorMateria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { profesorId: PROFESOR } }),
    );
  });

  it("devuelve una lista vacía si el profesor no tiene asociaciones", async () => {
    vi.mocked(prisma.profesorMateria.findMany).mockResolvedValue([]);
    await expect(obtenerMateriasDelProfesor(PROFESOR)).resolves.toEqual([]);
  });
});

describe("asociarMateriasAProfesor", () => {
  it("asocia todo el lote en un único createMany con el autor, sin skipDuplicates", async () => {
    vi.mocked(bloquearMateriasParaAsociar).mockResolvedValue([QUIMICA, FISICA]);

    const asociadas = await asociarMateriasAProfesor(PROFESOR, [FISICA.id, QUIMICA.id], USUARIO);

    expect(asociadas).toEqual([
      { id: FISICA.id, nombre: "Física", codigo: "FIS101" },
      { id: QUIMICA.id, nombre: "Química", codigo: null },
    ]);
    expect(tx.profesor.updateMany).toHaveBeenCalledWith({
      where: { idProfesor: PROFESOR, activoProfesor: true },
      data: { modificadoPorUsuarioId: USUARIO },
    });
    expect(bloquearMateriasParaAsociar).toHaveBeenCalledWith([FISICA.id, QUIMICA.id], tx);
    expect(tx.profesorMateria.createMany).toHaveBeenCalledTimes(1);
    expect(tx.profesorMateria.createMany).toHaveBeenCalledWith({
      data: [
        { profesorId: PROFESOR, materiaId: FISICA.id, creadoPorUsuarioId: USUARIO },
        { profesorId: PROFESOR, materiaId: QUIMICA.id, creadoPorUsuarioId: USUARIO },
      ],
    });
  });

  it("profesor inactivo → PROFESOR_INACTIVO, sin tocar materias", async () => {
    tx.profesor.updateMany.mockResolvedValue({ count: 0 });
    tx.profesor.findUnique.mockResolvedValue({ idProfesor: PROFESOR });

    const error = await capturarError(asociarMateriasAProfesor(PROFESOR, [FISICA.id], USUARIO));

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe("PROFESOR_INACTIVO");
    expect(bloquearMateriasParaAsociar).not.toHaveBeenCalled();
    expect(tx.profesorMateria.createMany).not.toHaveBeenCalled();
  });

  it("profesor inexistente → PROFESOR_NO_ENCONTRADO", async () => {
    tx.profesor.updateMany.mockResolvedValue({ count: 0 });
    tx.profesor.findUnique.mockResolvedValue(null);

    const error = await capturarError(asociarMateriasAProfesor(PROFESOR, [FISICA.id], USUARIO));

    expect(error.code).toBe("PROFESOR_NO_ENCONTRADO");
    expect(tx.profesorMateria.createMany).not.toHaveBeenCalled();
  });

  it("materia ya asociada → MATERIA_YA_ASOCIADA con esa materia en detalles", async () => {
    tx.profesorMateria.findMany.mockResolvedValue([
      { materia: { idMateria: FISICA.id, nombreMateria: "Física" } },
    ]);

    const error = await capturarError(
      asociarMateriasAProfesor(PROFESOR, [FISICA.id, QUIMICA.id], USUARIO),
    );

    expect(error.code).toBe("MATERIA_YA_ASOCIADA");
    expect(error.detalles).toEqual({ materias: [{ id: FISICA.id, nombre: "Física" }] });
    expect(tx.profesorMateria.createMany).not.toHaveBeenCalled();
  });

  it("una inactiva en un lote de tres → MATERIA_INACTIVA solo con esa, y createMany no se invoca", async () => {
    vi.mocked(bloquearMateriasParaAsociar).mockResolvedValue([FISICA, QUIMICA, HISTORIA]);

    const error = await capturarError(
      asociarMateriasAProfesor(PROFESOR, [FISICA.id, QUIMICA.id, HISTORIA.id], USUARIO),
    );

    expect(error.code).toBe("MATERIA_INACTIVA");
    expect(error.detalles).toEqual({
      materias: [{ id: HISTORIA.id, nombre: "Historia de la Ciencia" }],
    });
    expect(tx.profesorMateria.createMany).not.toHaveBeenCalled();
  });

  it("id sin materia → MATERIA_NO_ENCONTRADA, y createMany no se invoca", async () => {
    vi.mocked(bloquearMateriasParaAsociar).mockResolvedValue([FISICA]);

    const error = await capturarError(
      asociarMateriasAProfesor(PROFESOR, [FISICA.id, "ckinexistente000000000001"], USUARIO),
    );

    expect(error.code).toBe("MATERIA_NO_ENCONTRADA");
    expect(tx.profesorMateria.createMany).not.toHaveBeenCalled();
  });

  it("P2002 forzado en el INSERT (confirmaciones simultáneas) → MATERIA_YA_ASOCIADA", async () => {
    vi.mocked(bloquearMateriasParaAsociar).mockResolvedValue([FISICA]);
    tx.profesorMateria.createMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );

    const error = await capturarError(asociarMateriasAProfesor(PROFESOR, [FISICA.id], USUARIO));

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe("MATERIA_YA_ASOCIADA");
  });

  it("un error inesperado se propaga sin traducir", async () => {
    vi.mocked(bloquearMateriasParaAsociar).mockRejectedValue(new Error("conexión perdida"));

    await expect(
      asociarMateriasAProfesor(PROFESOR, [FISICA.id], USUARIO),
    ).rejects.toThrow("conexión perdida");
  });
});
