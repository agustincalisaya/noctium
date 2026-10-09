import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, findMany, listarIds, basicos } = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn(), listarIds: vi.fn(), basicos: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { turno: { findUnique, findMany } } }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ listarIdsAlumnosActivos: listarIds, obtenerAlumnosBasicos: basicos }));

const { listarOpcionesAlumnoTurno } = await import("./turno.service");
const turno = { estadoTurno: "PENDIENTE", fechaTurno: new Date("2026-10-10T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60, aulaId: "aula-1", cupoMaximoTurno: 2 };
const alumno = (id: string, activo = true) => ({ id, nombre: id, apellido: id, dni: id, activo, forma_pago_preferida_id: null });
const otro = (inicio: string, duracion: number, ...ids: string[]) => ({ horaInicioTurno: new Date(`1970-01-01T${inicio}:00.000Z`), duracionMinutosTurno: duracion, alumnos: ids.map((alumnoId) => ({ alumnoId })) });

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(turno);
  findMany.mockResolvedValue([]);
  listarIds.mockResolvedValue(["a", "b", "c"]);
  basicos.mockResolvedValue([alumno("b"), alumno("a"), alumno("c", false)]);
});

describe("opciones preventivas de alumnos para un turno persistido", () => {
  it("devuelve todos los activos sin conflictos, ordenados, reutilizando obtenerAlumnosBasicos", async () => {
    await expect(listarOpcionesAlumnoTurno("turno-1")).resolves.toEqual({ turno_id: "turno-1", alumnos: [
      { id: "a", nombre: "a", apellido: "a", dni: "a" }, { id: "b", nombre: "b", apellido: "b", dni: "b" },
    ] });
    expect(listarIds).toHaveBeenCalledOnce();
    expect(basicos).toHaveBeenCalledExactlyOnceWith(["a", "b", "c"]);
    expect(findMany).toHaveBeenCalledWith({ where: { idTurno: { not: "turno-1" }, fechaTurno: turno.fechaTurno,
      // Solo ocupan al alumno sus inscripciones vigentes ahora (PR-0.md §2.0 y §2.2).
      estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }, alumnos: { some: expect.objectContaining({ alumnoId: { in: ["a", "b", "c"] }, vigencia: "VIGENTE" }) } },
      select: { horaInicioTurno: true, duracionMinutosTurno: true, alumnos: { where: expect.objectContaining({ alumnoId: { in: ["a", "b", "c"] }, vigencia: "VIGENTE" }), select: { alumnoId: true } } } });
  });

  it("excluye solapamientos y conserva intervalos contiguos", async () => {
    findMany.mockResolvedValue([otro("09:30", 60, "a"), otro("11:00", 60, "b")]);
    await expect(listarOpcionesAlumnoTurno("turno-1")).resolves.toMatchObject({ alumnos: [{ id: "b" }] });
  });

  it("lista vacía evita consultas innecesarias", async () => {
    listarIds.mockResolvedValue([]);
    await expect(listarOpcionesAlumnoTurno("turno-1")).resolves.toEqual({ turno_id: "turno-1", alumnos: [] });
    expect(basicos).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each([
    [null, "TURNO_NO_ENCONTRADO"],
    [{ ...turno, estadoTurno: "DISPONIBLE" }, "TURNO_YA_DISPONIBLE"],
    [{ ...turno, aulaId: null }, "TURNO_SIN_AULA"],
  ])("rechaza turno inválido", async (valor, code) => {
    findUnique.mockResolvedValue(valor);
    await expect(listarOpcionesAlumnoTurno("turno-1")).rejects.toMatchObject({ code });
    expect(listarIds).not.toHaveBeenCalled();
  });
});
