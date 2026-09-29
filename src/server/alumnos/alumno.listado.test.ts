import { beforeEach, describe, expect, it, vi } from "vitest";

// HU-B-05: listarAlumnos() (spec_modulo_B.md §2.4 y §2.7) con `prisma`
// mockeado. Lo que importa es que conteo y página usen el mismo `where`.

const { count, findMany } = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { alumno: { count, findMany } } }));
const { listarAlumnos } = await import("./alumno.service");
const { ListarAlumnosQuerySchema } = await import("./alumno.schema");

const ORDEN = [{ apellidoNormalizadoAlumno: "asc" }, { nombreNormalizadoAlumno: "asc" }, { dniAlumno: "asc" }];
const fila = {
  idAlumno: "a1", apellidoAlumno: "Pérez", nombreAlumno: "Joaquín", dniAlumno: "40100006",
  telefonoAlumno: null, emailAlumno: "alumno06@noctium.local", activoAlumno: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue(1);
  findMany.mockResolvedValue([fila]);
});

describe("HU-B-05 listarAlumnos con búsqueda", () => {
  it.each([{}, { q: "a" }, { q: "  " }])("sin búsqueda válida no filtra (%j)", async (params) => {
    await listarAlumnos(ListarAlumnosQuerySchema.parse(params));
    expect(count).toHaveBeenCalledWith({ where: undefined });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined, orderBy: ORDEN }));
  });

  it("conteo y página usan el mismo where, con el orden de siempre", async () => {
    await listarAlumnos(ListarAlumnosQuerySchema.parse({ q: "perez joaquin" }));
    const where = count.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(2);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where, orderBy: ORDEN, skip: 0, take: 20 }));
  });

  it("total y páginas salen del resultado filtrado", async () => {
    count.mockResolvedValue(17);
    const { paginacion } = await listarAlumnos(ListarAlumnosQuerySchema.parse({ q: "ez", por_pagina: 5, pagina: 4 }));
    expect(paginacion).toEqual({ total: 17, pagina_actual: 4, total_paginas: 4, por_pagina: 5 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 15, take: 5 }));
  });

  it("una página mayor a la última del filtrado se acota a la última", async () => {
    count.mockResolvedValue(3);
    const { paginacion } = await listarAlumnos(ListarAlumnosQuerySchema.parse({ q: "val", pagina: 5 }));
    expect(paginacion.pagina_actual).toBe(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });

  it("sin coincidencias devuelve la página 1 vacía", async () => {
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    await expect(listarAlumnos(ListarAlumnosQuerySchema.parse({ q: "juan perez", pagina: 3 }))).resolves.toEqual({
      items: [],
      paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 20 },
    });
  });

  it("mantiene el formato de fila del listado", async () => {
    const { items } = await listarAlumnos(ListarAlumnosQuerySchema.parse({ q: "perez" }));
    expect(items).toEqual([{
      id: "a1", apellido: "Pérez", nombre: "Joaquín", dni: "40100006", telefono: null,
      email: "alumno06@noctium.local", is_active: true,
    }]);
  });
});

describe("HU-B-05 ListarAlumnosQuerySchema", () => {
  it("recorta q y rechaza más de 100 caracteres", () => {
    expect(ListarAlumnosQuerySchema.parse({ q: "  val  " }).q).toBe("val");
    expect(ListarAlumnosQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    expect(ListarAlumnosQuerySchema.safeParse({ q: "x".repeat(100) }).success).toBe(true);
  });
});
