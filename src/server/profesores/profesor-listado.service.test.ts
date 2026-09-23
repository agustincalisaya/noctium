import { beforeEach, describe, expect, it, vi } from "vitest";

// HU-D-05: listarProfesores(), listarOpcionesProfesoresActivos() y
// obtenerDetalleProfesor(), con `prisma` mockeado.

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profesor: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    profesorMateria: { findMany: vi.fn() },
    horarioProfesor: { findMany: vi.fn() },
  },
}));

vi.mock("@/server/materias/materia.service", () => ({
  bloquearMateriasParaAsociar: vi.fn(),
}));

const { prisma } = await import("@/lib/prisma");
const { listarProfesores, listarOpcionesProfesoresActivos, obtenerDetalleProfesor } = await import(
  "@/server/profesores/profesor.service"
);

const ORDEN_ESPERADO = [
  { apellidoNormalizadoProfesor: "asc" },
  { nombreNormalizadoProfesor: "asc" },
  { dniProfesor: "asc" },
];

function filaListado(n: number, materias: string[] = []) {
  return {
    idProfesor: `ckprofesor${String(n).padStart(15, "0")}`,
    apellidoProfesor: `Apellido${n}`,
    nombreProfesor: `Nombre${n}`,
    dniProfesor: String(30000000 + n),
    telefonoProfesor: null,
    emailProfesor: `p${n}@example.com`,
    activoProfesor: n % 2 === 0,
    materias: materias.map((nombreMateria) => ({ materia: { nombreMateria } })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listarProfesores (criterios 1, 2 y 5)", () => {
  it("ordena por apellido, nombre normalizados y DNI, y pagina de a 20", async () => {
    vi.mocked(prisma.profesor.count).mockResolvedValue(22);
    vi.mocked(prisma.profesor.findMany).mockResolvedValue([filaListado(21), filaListado(22)] as never);

    const { items, paginacion } = await listarProfesores({ pagina: 2, por_pagina: 20 });

    const args = vi.mocked(prisma.profesor.findMany).mock.calls[0]![0]!;
    expect(args.orderBy).toEqual(ORDEN_ESPERADO);
    expect(args.skip).toBe(20);
    expect(args.take).toBe(20);
    expect(paginacion).toEqual({ total: 22, pagina_actual: 2, total_paginas: 2, por_pagina: 20 });
    expect(items).toHaveLength(2);
  });

  it("selecciona solo los campos de la tabla (sin auditoría ni cuenta vinculada)", async () => {
    vi.mocked(prisma.profesor.count).mockResolvedValue(1);
    vi.mocked(prisma.profesor.findMany).mockResolvedValue([filaListado(1)] as never);

    await listarProfesores({ pagina: 1, por_pagina: 20 });

    const { select } = vi.mocked(prisma.profesor.findMany).mock.calls[0]![0]! as {
      select: Record<string, unknown>;
    };
    expect(Object.keys(select).sort()).toEqual(
      [
        "activoProfesor",
        "apellidoProfesor",
        "dniProfesor",
        "emailProfesor",
        "idProfesor",
        "materias",
        "nombreProfesor",
        "telefonoProfesor",
      ].sort(),
    );
  });

  it("devuelve los nombres de materias en el orden de la consulta", async () => {
    vi.mocked(prisma.profesor.count).mockResolvedValue(1);
    vi.mocked(prisma.profesor.findMany).mockResolvedValue([
      filaListado(1, ["Física", "Matemática", "Programación I", "Química"]),
    ] as never);

    const { items } = await listarProfesores({ pagina: 1, por_pagina: 20 });

    expect(items[0]).toEqual({
      id: "ckprofesor000000000000001",
      apellido: "Apellido1",
      nombre: "Nombre1",
      dni: "30000001",
      telefono: null,
      email: "p1@example.com",
      activo: false,
      materias: ["Física", "Matemática", "Programación I", "Química"],
    });
  });

  it("acota una página fuera de rango a la última", async () => {
    vi.mocked(prisma.profesor.count).mockResolvedValue(22);
    vi.mocked(prisma.profesor.findMany).mockResolvedValue([] as never);

    const { paginacion } = await listarProfesores({ pagina: 9, por_pagina: 20 });

    expect(paginacion.pagina_actual).toBe(2);
    expect(vi.mocked(prisma.profesor.findMany).mock.calls[0]![0]!.skip).toBe(20);
  });

  it("sin profesores: página 1 de 0, sin items", async () => {
    vi.mocked(prisma.profesor.count).mockResolvedValue(0);
    vi.mocked(prisma.profesor.findMany).mockResolvedValue([] as never);

    const { items, paginacion } = await listarProfesores({ pagina: 3, por_pagina: 20 });

    expect(items).toEqual([]);
    expect(paginacion).toEqual({ total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 20 });
    expect(vi.mocked(prisma.profesor.findMany).mock.calls[0]![0]!.skip).toBe(0);
  });
});

describe("listarOpcionesProfesoresActivos (para HU-J-01)", () => {
  it('filtra activos, usa el mismo orden y arma "Apellido, Nombre"', async () => {
    vi.mocked(prisma.profesor.findMany).mockResolvedValue([
      { idProfesor: "a", apellidoProfesor: "Álvarez", nombreProfesor: "Lucía", dniProfesor: "1" },
      { idProfesor: "b", apellidoProfesor: "benítez", nombreProfesor: "Diego", dniProfesor: "2" },
    ] as never);

    const opciones = await listarOpcionesProfesoresActivos();

    const args = vi.mocked(prisma.profesor.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({ activoProfesor: true });
    expect(args.orderBy).toEqual(ORDEN_ESPERADO);
    expect(opciones).toEqual([
      { id: "a", nombreParaMostrar: "Álvarez, Lucía" },
      { id: "b", nombreParaMostrar: "benítez, Diego" },
    ]);
  });
});

describe("obtenerDetalleProfesor (criterio 3)", () => {
  it("devuelve null si el profesor no existe", async () => {
    vi.mocked(prisma.profesor.findUnique).mockResolvedValue(null);
    await expect(obtenerDetalleProfesor("inexistente")).resolves.toBeNull();
    expect(prisma.profesorMateria.findMany).not.toHaveBeenCalled();
  });

  it("combina identidad, contacto, materias y horarios", async () => {
    const alta = new Date("2026-09-01T12:00:00Z");
    vi.mocked(prisma.profesor.findUnique).mockResolvedValue({
      idProfesor: "p1",
      nombreProfesor: "Julián",
      apellidoProfesor: "Castro",
      dniProfesor: "32200011",
      fechaNacimientoProfesor: new Date(Date.UTC(1986, 11, 5)),
      generoProfesor: "MASCULINO",
      telefonoProfesor: "+541155600111",
      emailProfesor: null,
      activoProfesor: true,
      createdAtProfesor: alta,
    } as never);
    vi.mocked(prisma.profesorMateria.findMany).mockResolvedValue([
      { materia: { idMateria: "m1", nombreMateria: "Física", codigoMateria: "FIS101", activaMateria: true } },
    ] as never);
    vi.mocked(prisma.horarioProfesor.findMany).mockResolvedValue([
      {
        idHorario: "h1",
        diaSemanaHorario: "LUNES",
        horaDesdeHorario: new Date(Date.UTC(1970, 0, 1, 8, 0)),
        horaHastaHorario: new Date(Date.UTC(1970, 0, 1, 10, 0)),
      },
    ] as never);

    const detalle = await obtenerDetalleProfesor("p1");

    expect(detalle).toMatchObject({
      id: "p1",
      apellido: "Castro",
      nombre: "Julián",
      telefono: "+541155600111",
      email: null,
      activo: true,
      fechaAlta: alta,
      materias: [{ id: "m1", nombre: "Física", codigo: "FIS101", activa: true }],
      horarios: [{ id: "h1", diaSemana: "LUNES", horaInicio: "08:00", horaFin: "10:00" }],
    });
  });
});
