import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  materia: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  historialTarifa: { create: vi.fn() }, bloquear: vi.fn(), nombres: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: (fn: (tx: unknown) => unknown) => fn(mocks) }));
vi.mock("@/server/shared/bloquear", () => ({ bloquear: mocks.bloquear }));
vi.mock("@/server/personal/personal.publico", () => ({ obtenerNombresPersonal: mocks.nombres }));
import { CambiarTarifaSchema } from "@/server/materias/materia.schema";
import { cambiarTarifaMateria, listarMaterias, obtenerMateriaPorId } from "@/server/materias/materia.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.materia.findUnique.mockResolvedValue({ activaMateria: true, tarifaHoraMateria: 12000 });
  mocks.nombres.mockResolvedValue([]);
});
describe("HU-L-06: esquema y cambio", () => {
  it.each([0, -1, 1.2, 1000001, "12000", null, undefined])("rechaza importe %s", (tarifa_hora) => {
    expect(CambiarTarifaSchema.safeParse({ tarifa_hora, tarifa_actual: 12000 }).success).toBe(false);
  });
  it("acepta límites y primera definición; rechaza tarifa anterior ausente y campos ajenos", () => {
    for (const tarifa_hora of [1, 1000000]) expect(CambiarTarifaSchema.safeParse({ tarifa_hora, tarifa_actual: null }).success).toBe(true);
    expect(CambiarTarifaSchema.safeParse({ tarifa_hora: 15000 }).success).toBe(false);
    expect(CambiarTarifaSchema.safeParse({ tarifa_hora: 15000, tarifa_actual: 12000, nombre: "otro" }).success).toBe(false);
  });
  it("bloquea antes de leer; registra anterior, nueva, actor y fecha sin cambiar versión", async () => {
    await expect(cambiarTarifaMateria("m", { tarifa_hora: 15000, tarifa_actual: 12000 }, "gerente")).resolves.toEqual({ id: "m", tarifa_hora: 15000, tarifa_anterior: 12000 });
    expect(mocks.bloquear).toHaveBeenCalledWith(mocks, { recursos: { materias: ["m"] } });
    expect(mocks.bloquear.mock.invocationCallOrder[0]).toBeLessThan(mocks.materia.findUnique.mock.invocationCallOrder[0]);
    expect(mocks.materia.update).toHaveBeenCalledWith({ where: { idMateria: "m" }, data: { tarifaHoraMateria: 15000, modificadoPorUsuarioId: "gerente" } });
    expect(mocks.historialTarifa.create).toHaveBeenCalledWith({ data: { materiaId: "m", tarifaAnterior: 12000, tarifaNueva: 15000, usuarioId: "gerente", fecha: expect.any(Date), masivo: false } });
  });
  it.each([
    [null, "MATERIA_NO_ENCONTRADA"],
    [{ activaMateria: false, tarifaHoraMateria: 12000 }, "MATERIA_INACTIVA"],
    [{ activaMateria: true, tarifaHoraMateria: 13000 }, "CONFLICTO_EDICION_CONCURRENTE"],
    [{ activaMateria: true, tarifaHoraMateria: 15000 }, "CONFLICTO_EDICION_CONCURRENTE"],
  ])("rechaza %j sin escribir", async (actual, code) => {
    mocks.materia.findUnique.mockResolvedValue(actual);
    await expect(cambiarTarifaMateria("m", { tarifa_hora: 15000, tarifa_actual: 12000 }, "g")).rejects.toMatchObject({ code });
    expect(mocks.materia.update).not.toHaveBeenCalled(); expect(mocks.historialTarifa.create).not.toHaveBeenCalled();
  });
  it("importe igual no escribe", async () => {
    await expect(cambiarTarifaMateria("m", { tarifa_hora: 12000, tarifa_actual: 12000 }, "g")).rejects.toMatchObject({ code: "TARIFA_SIN_CAMBIO" });
    expect(mocks.historialTarifa.create).not.toHaveBeenCalled();
  });
  it("primera definición conserva anterior null", async () => {
    mocks.materia.findUnique.mockResolvedValue({ activaMateria: true, tarifaHoraMateria: null });
    await expect(cambiarTarifaMateria("m", { tarifa_hora: 15000, tarifa_actual: null }, "g")).resolves.toMatchObject({ tarifa_anterior: null });
    expect(mocks.historialTarifa.create.mock.calls[0][0].data.tarifaAnterior).toBeNull();
  });
});
describe("lecturas condicionadas", () => {
  const materia = { idMateria: "m", nombreMateria: "Física", codigoMateria: "FIS", activaMateria: true, tarifaHoraMateria: 12000,
    createdAtMateria: new Date(), updatedAtMateria: new Date(), version: 0, profesores: [], _count: { profesores: 0 },
    historialTarifas: [{ tarifaAnterior: null, tarifaNueva: 12000, fecha: new Date(), usuarioId: "g", masivo: false }],
  };
  it("Profesor no recibe ni selecciona tarifas o historial", async () => {
    mocks.materia.findUnique.mockResolvedValue(materia);
    mocks.materia.findMany.mockResolvedValue([materia]); mocks.materia.count.mockResolvedValue(1);
    const detalle = await obtenerMateriaPorId("m");
    const lista = await listarMaterias({ pagina: 1, por_pagina: 20 });
    expect(detalle).not.toHaveProperty("tarifa_hora"); expect(detalle).not.toHaveProperty("historial_tarifas");
    expect(lista.items[0]).not.toHaveProperty("tarifa_hora");
    for (const fn of [mocks.materia.findUnique, mocks.materia.findMany]) {
      expect(fn.mock.calls[0][0].select).not.toHaveProperty("tarifaHoraMateria");
      expect(fn.mock.calls[0][0].select).not.toHaveProperty("historialTarifas");
    }
    expect(mocks.nombres).not.toHaveBeenCalled();
  });
  it("Gerente/Mesa ven historial ordenado y nombre null si falta ficha", async () => {
    mocks.materia.findUnique.mockResolvedValue(materia);
    const detalle = await obtenerMateriaPorId("m", { conTarifa: true });
    expect(detalle.tarifa_hora).toBe(12000);
    expect(detalle.historial_tarifas?.[0]).toMatchObject({ tarifa_anterior: null, usuario: { id: "g", nombre: null }, masivo: false });
    expect(mocks.nombres).toHaveBeenCalledWith(["g"]);
    expect(mocks.materia.findUnique.mock.calls[0][0].select.historialTarifas.orderBy).toEqual([{ fecha: "desc" }, { idHistorialTarifa: "desc" }]);
  });
});
