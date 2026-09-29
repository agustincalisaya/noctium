import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { alumno: { findMany } } }));
const { buscarAlumnosActivos } = await import("./alumno.service");
const { construirFiltroBusquedaAlumno } = await import("./alumno.busqueda");

const filas = [
  { idAlumno: "1", nombreAlumno: "Ána", apellidoAlumno: "Pérez", dniAlumno: "30123456", nombreNormalizadoAlumno: "ana", apellidoNormalizadoAlumno: "perez", activoAlumno: true },
  { idAlumno: "2", nombreAlumno: "Bruno", apellidoAlumno: "Gómez", dniAlumno: "28999888", nombreNormalizadoAlumno: "bruno", apellidoNormalizadoAlumno: "gomez", activoAlumno: true },
  { idAlumno: "3", nombreAlumno: "Ana", apellidoAlumno: "López", dniAlumno: "30999999", nombreNormalizadoAlumno: "ana", apellidoNormalizadoAlumno: "lopez", activoAlumno: false },
];
type Fila = (typeof filas)[number];
type Condicion = Record<string, { contains: string }>;

// Evalúa el `where` que arma construirFiltroBusquedaAlumno(): activo +
// AND de palabras, cada una con un OR de campos (spec_modulo_B.md §2.7).
function cumple(fila: Fila, where: { activoAlumno?: boolean; AND?: { OR: Condicion[] }[] }) {
  if (where.activoAlumno !== undefined && fila.activoAlumno !== where.activoAlumno) return false;
  return (where.AND ?? []).every(({ OR }) => OR.some((condicion) =>
    Object.entries(condicion).some(([campo, filtro]) => String(fila[campo as keyof Fila]).includes(filtro.contains))));
}

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockImplementation(async ({ where, take }) => filas.filter((fila) => cumple(fila, where)).slice(0, take));
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
  it("con varias palabras en cualquier orden usa el criterio de HU-B-05 (§3.9)", async () => {
    await expect(buscarAlumnosActivos("perez ana")).resolves.toEqual([expect.objectContaining({ id: "1" })]);
    await expect(buscarAlumnosActivos("ana perez")).resolves.toEqual([expect.objectContaining({ id: "1" })]);
    await expect(buscarAlumnosActivos("ana gomez")).resolves.toEqual([]);
  });
  it("conserva el formato de salida que consume Turnos", async () => {
    await expect(buscarAlumnosActivos("gomez")).resolves.toEqual([{ id: "2", nombre: "Bruno", apellido: "Gómez", dni: "28999888" }]);
  });
});

describe("HU-B-05 construirFiltroBusquedaAlumno", () => {
  it.each([undefined, "", "   ", "a", " a "])("sin filtro con menos de dos caracteres (%j)", (q) => {
    expect(construirFiltroBusquedaAlumno(q)).toBeUndefined();
  });
  it("una palabra de texto busca en apellido y nombre normalizados, no en DNI", () => {
    expect(construirFiltroBusquedaAlumno("Pérez")).toEqual({
      AND: [{ OR: [{ apellidoNormalizadoAlumno: { contains: "perez" } }, { nombreNormalizadoAlumno: { contains: "perez" } }] }],
    });
  });
  it("una palabra de solo dígitos también busca en el DNI", () => {
    expect(construirFiltroBusquedaAlumno("0034")).toEqual({
      AND: [{ OR: [
        { apellidoNormalizadoAlumno: { contains: "0034" } },
        { nombreNormalizadoAlumno: { contains: "0034" } },
        { dniAlumno: { contains: "0034" } },
      ] }],
    });
  });
  it("cada palabra es una condición AND", () => {
    const filtro = construirFiltroBusquedaAlumno("  JOAQUÍN   pérez ");
    expect(filtro?.AND).toHaveLength(2);
    expect(JSON.stringify(filtro)).toContain('"joaquin"');
    expect(JSON.stringify(filtro)).toContain('"perez"');
  });
  it("usa como máximo las cinco primeras palabras", () => {
    expect(construirFiltroBusquedaAlumno("uno dos tres cuatro cinco seis")?.AND).toHaveLength(5);
  });
});
