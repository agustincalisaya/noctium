import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";

// HU-L-03: modificarMateria() (spec_modulo_L.md §2.4) con `prisma` mockeado,
// y ModificarMateriaSchema.

const tx = {
  materia: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((callback: (cliente: typeof tx) => unknown) => callback(tx)),
  },
}));

const { modificarMateria } = await import("@/server/materias/materia.service");
const { ModificarMateriaSchema } = await import("@/server/materias/materia.schema");

const ID = "ckmateria0000000000000001";
const USUARIO = "ckusuario0000000000000001";
const ACTUAL = { nombreMateria: "Matemática", codigoMateria: "MAT1", version: 3 };

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
  tx.materia.findUnique.mockResolvedValue(ACTUAL);
  tx.materia.findFirst.mockResolvedValue(null);
  tx.materia.updateMany.mockResolvedValue({ count: 1 });
});

describe("modificarMateria", () => {
  it("modifica solo el nombre: actualiza nombre y normalizado, no toca el código", async () => {
    const r = await modificarMateria(ID, { nombre: "Álgebra", version: 3 }, USUARIO);

    expect(r).toEqual({ id: ID, campos_modificados: ["nombre"], version: 4 });
    const { where, data } = tx.materia.updateMany.mock.calls[0][0];
    expect(where).toEqual({ idMateria: ID, version: 3 });
    expect(data).toMatchObject({
      nombreMateria: "Álgebra",
      nombreNormalizadaMateria: "algebra",
      modificadoPorUsuarioId: USUARIO,
      version: { increment: 1 },
    });
    expect(data.updatedAtMateria).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty("codigoMateria");
  });

  it("modifica solo el código: no toca el nombre", async () => {
    const r = await modificarMateria(ID, { codigo: "MAT2", version: 3 }, USUARIO);

    expect(r.campos_modificados).toEqual(["codigo"]);
    const { data } = tx.materia.updateMany.mock.calls[0][0];
    expect(data.codigoMateria).toBe("MAT2");
    expect(data).not.toHaveProperty("nombreMateria");
  });

  it("código null lo quita sin chequear duplicados", async () => {
    const r = await modificarMateria(ID, { codigo: null, version: 3 }, USUARIO);

    expect(r.campos_modificados).toEqual(["codigo"]);
    expect(tx.materia.findFirst).not.toHaveBeenCalled();
    expect(tx.materia.updateMany.mock.calls[0][0].data.codigoMateria).toBeNull();
  });

  it("sin cambios reales no escribe y devuelve campos_modificados vacío", async () => {
    const r = await modificarMateria(ID, { nombre: "Matemática", codigo: "MAT1", version: 3 }, USUARIO);

    expect(r).toEqual({ id: ID, campos_modificados: [], version: 3 });
    expect(tx.materia.updateMany).not.toHaveBeenCalled();
  });

  it("nombre de otra materia activa → NOMBRE_DUPLICADO, excluyendo la propia", async () => {
    tx.materia.findFirst.mockResolvedValueOnce({ activaMateria: true });

    const error = await capturarError(modificarMateria(ID, { nombre: "FÍSICA", version: 3 }, USUARIO));

    expect(error.code).toBe("NOMBRE_DUPLICADO");
    expect(error.message).toBe("Ya existe una materia registrada con ese nombre");
    expect(tx.materia.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nombreNormalizadaMateria: "fisica", NOT: { idMateria: ID } } }),
    );
    expect(tx.materia.updateMany).not.toHaveBeenCalled();
  });

  it("nombre de otra materia inactiva → NOMBRE_DUPLICADO con indicación (inactiva)", async () => {
    tx.materia.findFirst.mockResolvedValueOnce({ activaMateria: false });

    const error = await capturarError(modificarMateria(ID, { nombre: "Historia", version: 3 }, USUARIO));

    expect(error.code).toBe("NOMBRE_DUPLICADO");
    expect(error.message).toContain("(inactiva)");
  });

  it("cambiar solo mayúsculas/acentos del propio nombre no es duplicado", async () => {
    const r = await modificarMateria(ID, { nombre: "Matematica", version: 3 }, USUARIO);

    expect(r.campos_modificados).toEqual(["nombre"]);
    expect(tx.materia.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nombreNormalizadaMateria: "matematica", NOT: { idMateria: ID } } }),
    );
  });

  it("código de otra materia → CODIGO_DUPLICADO", async () => {
    tx.materia.findFirst.mockResolvedValueOnce({ idMateria: "otra" });

    const error = await capturarError(modificarMateria(ID, { codigo: "FIS1", version: 3 }, USUARIO));

    expect(error.code).toBe("CODIGO_DUPLICADO");
    expect(tx.materia.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { codigoMateria: "FIS1", NOT: { idMateria: ID } } }),
    );
  });

  it("version desactualizada → CONFLICTO_EDICION_CONCURRENTE", async () => {
    tx.materia.updateMany.mockResolvedValueOnce({ count: 0 });

    const error = await capturarError(modificarMateria(ID, { nombre: "Álgebra", version: 2 }, USUARIO));

    expect(error.code).toBe("CONFLICTO_EDICION_CONCURRENTE");
  });

  it("P2002 sobre el nombre normalizado → NOMBRE_DUPLICADO, nunca un error crudo", async () => {
    tx.materia.updateMany.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["nombreNormalizadaMateria"] },
      }),
    );

    const error = await capturarError(modificarMateria(ID, { nombre: "Álgebra", version: 3 }, USUARIO));

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe("NOMBRE_DUPLICADO");
  });

  it("P2002 sobre el código → CODIGO_DUPLICADO", async () => {
    tx.materia.updateMany.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["codigoMateria"] },
      }),
    );

    const error = await capturarError(modificarMateria(ID, { codigo: "FIS1", version: 3 }, USUARIO));

    expect(error.code).toBe("CODIGO_DUPLICADO");
  });

  it("materia inexistente → MATERIA_NO_ENCONTRADA", async () => {
    tx.materia.findUnique.mockResolvedValueOnce(null);

    const error = await capturarError(modificarMateria(ID, { nombre: "Álgebra", version: 0 }, USUARIO));

    expect(error.code).toBe("MATERIA_NO_ENCONTRADA");
  });

  it("una materia inactiva también se puede modificar (no filtra por activa)", async () => {
    await modificarMateria(ID, { nombre: "Álgebra", version: 3 }, USUARIO);

    expect(tx.materia.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { idMateria: ID } }));
  });
});

describe("ModificarMateriaSchema", () => {
  it("normaliza igual que el alta", () => {
    const r = ModificarMateriaSchema.parse({ nombre: "  Física   II ", codigo: " fis2 ", version: 0 });
    expect(r).toEqual({ nombre: "Física II", codigo: "FIS2", version: 0 });
  });

  it("campo ausente queda undefined (no se modifica)", () => {
    expect(ModificarMateriaSchema.parse({ version: 1 })).toEqual({ version: 1 });
  });

  it("código vacío o null → null (se quita)", () => {
    expect(ModificarMateriaSchema.parse({ codigo: "", version: 1 }).codigo).toBeNull();
    expect(ModificarMateriaSchema.parse({ codigo: null, version: 1 }).codigo).toBeNull();
  });

  it("rechaza nombre de 1 carácter y código con espacios", () => {
    expect(ModificarMateriaSchema.safeParse({ nombre: "A", version: 1 }).success).toBe(false);
    expect(ModificarMateriaSchema.safeParse({ codigo: "MAT 1", version: 1 }).success).toBe(false);
  });

  it("exige version", () => {
    expect(ModificarMateriaSchema.safeParse({ nombre: "Álgebra" }).success).toBe(false);
  });

  it("rechaza is_active y duración (criterio 5)", () => {
    expect(ModificarMateriaSchema.safeParse({ is_active: false, version: 1 }).success).toBe(false);
    expect(ModificarMateriaSchema.safeParse({ duracion: 60, version: 1 }).success).toBe(false);
  });
});
