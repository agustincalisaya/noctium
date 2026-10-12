import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  materia: { findMany: vi.fn(), update: vi.fn() }, historialTarifa: { create: vi.fn() }, bloquear: vi.fn(), ahora: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: (fn: (tx: unknown) => unknown) => fn(mocks) }));
vi.mock("@/server/shared/bloquear", () => ({ bloquear: mocks.bloquear }));
vi.mock("@/server/shared/reloj", () => ({ ahora: mocks.ahora }));
import { CambiarTarifasMasivoSchema } from "@/server/materias/materia.schema";
import { cambiarTarifasMasivo, listarMateriasConTarifa } from "@/server/materias/materia.service";

const id = (n: number) => `cm0000000000000000000${String(n).padStart(4, "0")}`;
const filas = [
  { idMateria: id(2), activaMateria: true, tarifaHoraMateria: 12000 },
  { idMateria: id(1), activaMateria: true, tarifaHoraMateria: null },
  { idMateria: id(3), activaMateria: true, tarifaHoraMateria: 15000 },
];
const input = { tarifa_hora: 15000, materias: filas.map((f) => ({ id: f.idMateria, tarifa_actual: f.tarifaHoraMateria })) };
beforeEach(() => {
  vi.clearAllMocks(); mocks.materia.findMany.mockResolvedValue(filas);
  mocks.ahora.mockReturnValue(new Date("2026-10-11T12:00:00Z"));
});
describe("HU-L-07: schema", () => {
  it("acepta límites de cantidad, importes y tarifa actual null", () => {
    for (const cantidad of [1, 200]) for (const tarifa_hora of [1, 1000000]) {
      expect(CambiarTarifasMasivoSchema.safeParse({ tarifa_hora, materias: Array.from({ length: cantidad }, (_, n) => ({ id: id(n), tarifa_actual: null })) }).success).toBe(true);
    }
  });
  it.each([0, -1, 1.5, 1000001, "15000", null, undefined])("rechaza importe %s", (tarifa_hora) => {
    expect(CambiarTarifasMasivoSchema.safeParse({ ...input, tarifa_hora }).success).toBe(false);
  });
  it.each([
    { ...input, materias: [] },
    { ...input, materias: Array.from({ length: 201 }, (_, n) => ({ id: id(n), tarifa_actual: null })) },
    { ...input, materias: [input.materias[0], input.materias[0]] },
    { ...input, version: 1 },
    { ...input, materias: [{ id: id(1), tarifa_actual: null, version: 1 }] },
    { ...input, materias: [{ id: id(1) }] },
    { ...input, materias: [{ id: "incorrecto", tarifa_actual: null }] },
    { ...input, materias: [{ id: id(1), tarifa_actual: 0 }] },
  ])("rechaza selección o campos ajenos %j", (payload) => {
    expect(CambiarTarifasMasivoSchema.safeParse(payload).success).toBe(false);
  });
});
describe("HU-L-07: servicio", () => {
  it("bloquea todos en orden antes de leer; mezcla null/sin cambio comparte fecha", async () => {
    await expect(cambiarTarifasMasivo(input, "g")).resolves.toEqual({ tarifa_hora: 15000, actualizadas: 2, sin_cambio: 1 });
    expect(mocks.bloquear).toHaveBeenCalledExactlyOnceWith(mocks, { recursos: { materias: [id(1), id(2), id(3)] } });
    expect(mocks.bloquear.mock.invocationCallOrder[0]).toBeLessThan(mocks.materia.findMany.mock.invocationCallOrder[0]);
    expect(mocks.materia.update.mock.calls.map(([args]) => args)).toEqual([id(1), id(2)].map((idMateria) => ({ where: { idMateria }, data: { tarifaHoraMateria: 15000, modificadoPorUsuarioId: "g" } })));
    expect(mocks.ahora).toHaveBeenCalledTimes(1);
    expect(mocks.historialTarifa.create.mock.calls.map(([args]) => args.data)).toEqual([null, 12000].map((tarifaAnterior, i) => ({ materiaId: id(i + 1), tarifaAnterior, tarifaNueva: 15000, usuarioId: "g", fecha: mocks.ahora(), masivo: true })));
  });
  it("no-op responde 200 conceptual sin tocar historial, metadata ni reloj", async () => {
    mocks.materia.findMany.mockResolvedValue([filas[2]]);
    await expect(cambiarTarifasMasivo({ tarifa_hora: 15000, materias: [input.materias[2]] }, "g")).resolves.toEqual({ tarifa_hora: 15000, actualizadas: 0, sin_cambio: 1 });
    expect(mocks.materia.update).not.toHaveBeenCalled(); expect(mocks.historialTarifa.create).not.toHaveBeenCalled(); expect(mocks.ahora).not.toHaveBeenCalled();
  });
  it.each([
    [filas.slice(0, 2), "MATERIA_NO_ENCONTRADA"],
    [filas.map((f, i) => i === 2 ? { ...f, activaMateria: false } : f), "MATERIA_INACTIVA"],
    [filas.map((f, i) => i === 2 ? { ...f, tarifaHoraMateria: 18000 } : f), "CONFLICTO_EDICION_CONCURRENTE"],
    [filas.map((f, i) => i === 1 ? { ...f, tarifaHoraMateria: 12000 } : f), "CONFLICTO_EDICION_CONCURRENTE"],
  ])("valida todo incluso sin cambio %s antes de escribir", async (actuales, code) => {
    mocks.materia.findMany.mockResolvedValue(actuales);
    await expect(cambiarTarifasMasivo(input, "g")).rejects.toMatchObject({ code });
    expect(mocks.materia.update).not.toHaveBeenCalled(); expect(mocks.historialTarifa.create).not.toHaveBeenCalled();
  });
  it("listado solo activo, orden estable, DTO nullable y sin paginar", async () => {
    mocks.materia.findMany.mockResolvedValue([{ idMateria: id(1), nombreMateria: "Física", codigoMateria: null, tarifaHoraMateria: null }]);
    expect(await listarMateriasConTarifa()).toEqual([{ id: id(1), nombre: "Física", codigo: null, tarifa_hora: null }]);
    expect(mocks.materia.findMany).toHaveBeenCalledWith({ where: { activaMateria: true }, orderBy: [{ nombreNormalizadaMateria: "asc" }, { idMateria: "asc" }], select: { idMateria: true, nombreMateria: true, codigoMateria: true, tarifaHoraMateria: true } });
  });
});
