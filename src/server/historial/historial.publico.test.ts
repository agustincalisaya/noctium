import { beforeEach, describe, expect, it, vi } from "vitest";

// Relación 1:N (PR-0.md §2.0): la clase dictada del turno es la no anulada (findFirst con anuladaEl: null).
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { claseDictada: { findFirst: findUnique } } }));

const { obtenerClaseDictadaDeTurno } = await import("./historial.publico");

beforeEach(() => vi.clearAllMocks());

describe("obtenerClaseDictadaDeTurno (Historial E §2.4)", () => {
  it("devuelve null cuando el turno no tiene un registro de clase dictada", async () => {
    findUnique.mockResolvedValueOnce(null);

    await expect(obtenerClaseDictadaDeTurno("turno-1")).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({
      where: { turnoId: "turno-1", anuladaEl: null },
      select: {
        idClaseDictada: true,
        createdAtClaseDictada: true,
        _count: { select: { alumnos: true } },
      },
    });
  });

  it("devuelve los datos públicos del registro y no filtra la lista de alumnos", async () => {
    const registrada = new Date("2026-09-29T14:30:00.000Z");
    const db = { claseDictada: { findFirst: vi.fn().mockResolvedValue({
      idClaseDictada: "clase-1",
      createdAtClaseDictada: registrada,
      _count: { alumnos: 4 },
    }) } } as never;

    await expect(obtenerClaseDictadaDeTurno("turno-1", db)).resolves.toEqual({
      id: "clase-1",
      registrada_en: registrada.toISOString(),
      alumnos_registrados: 4,
    });
    expect(db.claseDictada.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { turnoId: "turno-1", anuladaEl: null } }));
  });
});
