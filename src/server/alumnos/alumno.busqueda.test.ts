import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { alumno: { findMany } } }));
const { buscarAlumnosActivos } = await import("./alumno.service");

const filas = [
  { idAlumno: "1", nombreAlumno: "Ána", apellidoAlumno: "Pérez", dniAlumno: "30123456", nombreNormalizadoAlumno: "ana", apellidoNormalizadoAlumno: "perez", activoAlumno: true },
  { idAlumno: "2", nombreAlumno: "Bruno", apellidoAlumno: "Gómez", dniAlumno: "28999888", nombreNormalizadoAlumno: "bruno", apellidoNormalizadoAlumno: "gomez", activoAlumno: true },
  { idAlumno: "3", nombreAlumno: "Ana", apellidoAlumno: "López", dniAlumno: "30999999", nombreNormalizadoAlumno: "ana", apellidoNormalizadoAlumno: "lopez", activoAlumno: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockImplementation(async ({ where, take }) => {
    const encontrados = filas.filter((fila) => where.activoAlumno && fila.activoAlumno && where.OR.some((condicion: Record<string, { contains: string }>) =>
      Object.entries(condicion).some(([campo, filtro]) => String(fila[campo as keyof typeof fila]).includes(filtro.contains))));
    return encontrados.slice(0, take);
  });
});

describe("HU-C-04 búsqueda predictiva de alumnos", () => {
  it.each([
    ["ANA", "1"], ["PÉRE", "1"], ["1234", "1"], ["GÓME", "2"],
  ])("encuentra %s por nombre, apellido o DNI sin depender de acentos o mayúsculas", async (query, id) => {
    await expect(buscarAlumnosActivos(query)).resolves.toEqual([expect.objectContaining({ id })]);
  });
  it("no consulta con menos de dos caracteres", async () => {
    await expect(buscarAlumnosActivos(" A ")).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
  it("excluye alumnos inactivos y limita resultados a diez", async () => {
    await expect(buscarAlumnosActivos("ana")).resolves.toEqual([expect.objectContaining({ id: "1" })]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ activoAlumno: true }), take: 10 }));
  });
});
