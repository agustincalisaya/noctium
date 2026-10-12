import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const { listarAulas, buscarTurnos } = vi.hoisted(() => ({ listarAulas: vi.fn(), buscarTurnos: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { turno: { findMany: buscarTurnos } } }));
vi.mock("@/server/aulas/aula.publico", () => ({ listarAulasActivasParaTurno: listarAulas }));

const { aulasLibresEnFechas, aulasLibresParaGeneracion } = await import("./turno.generacion.aulas");
const db = { turno: { findMany: buscarTurnos } } as unknown as Prisma.TransactionClient;
const fecha = (valor: string) => new Date(`${valor}T00:00:00.000Z`);
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);
const aulas = [
  { id: "c-grande", nombre: "Aula 10", capacidad: 30 },
  { id: "c-chica", nombre: "Aula 2", capacidad: 8 },
];

beforeEach(() => {
  vi.clearAllMocks();
  listarAulas.mockResolvedValue(aulas);
  buscarTurnos.mockResolvedValue([]);
});

describe("HU-C-21: aulas libres agrupadas por fecha", () => {
  it("lee K una vez y los turnos una sola vez para todas las fechas, separando por fecha y aula", async () => {
    buscarTurnos.mockResolvedValueOnce([
      { fechaTurno: fecha("2026-10-08"), aulaId: "c-chica", horaInicioTurno: hora("15:00"), duracionMinutosTurno: 60 },
      { fechaTurno: fecha("2026-10-15"), aulaId: "c-grande", horaInicioTurno: hora("14:30"), duracionMinutosTurno: 60 },
      { fechaTurno: fecha("2026-10-22"), aulaId: "c-chica", horaInicioTurno: hora("16:00"), duracionMinutosTurno: 60 },
    ]);
    const libres = await aulasLibresEnFechas(db, [fecha("2026-10-08"), fecha("2026-10-15"), fecha("2026-10-22")], "15:00", 60);
    expect(Object.fromEntries([...libres].map(([clave, lista]) => [clave, lista.map(({ id }) => id)]))).toEqual({
      "2026-10-08": ["c-grande"],
      "2026-10-15": ["c-chica"],
      "2026-10-22": ["c-chica", "c-grande"],
    });
    expect(listarAulas).toHaveBeenCalledExactlyOnceWith(1);
    expect(buscarTurnos).toHaveBeenCalledOnce();
  });

  it("sin fechas o sin aulas activas no consulta turnos", async () => {
    expect([...(await aulasLibresEnFechas(db, [], "15:00", 60))]).toEqual([]);
    expect(listarAulas).not.toHaveBeenCalled();
    listarAulas.mockResolvedValueOnce([]);
    expect([...(await aulasLibresEnFechas(db, [fecha("2026-10-08")], "15:00", 60))]).toEqual([["2026-10-08", []]]);
    expect(buscarTurnos).not.toHaveBeenCalled();
  });

  it("la consulta de la ruta devuelve la lista de su fecha", async () => {
    await expect(aulasLibresParaGeneracion({ fecha: fecha("2026-10-08"), hora_inicio: "15:00", duracion_min: 60 }))
      .resolves.toEqual([{ id: "c-chica", nombre: "Aula 2", capacidad: 8 }, { id: "c-grande", nombre: "Aula 10", capacidad: 30 }]);
  });
});
