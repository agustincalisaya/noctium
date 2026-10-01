import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction, queryRaw, updateMany, eventoCreate } = vi.hoisted(() => ({
  transaction: vi.fn(), queryRaw: vi.fn(), updateMany: vi.fn(), eventoCreate: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: transaction,
  eventoTurno: { create: eventoCreate },
} }));

const { actualizarPrioridadTurno } = await import("./turno.service");

beforeEach(() => {
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([{ idTurno: "turno-1", estadoTurno: "PENDIENTE", prioridadTurno: "NORMAL" }]);
  updateMany.mockResolvedValue({ count: 1 });
  eventoCreate.mockResolvedValue({});
  transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({ $queryRaw: queryRaw, turno: { updateMany } }));
});

describe("HU-C-10 actualizarPrioridadTurno", () => {
  it("admite PENDIENTE, modifica solo prioridad y auditoría, y emite el evento después del commit", async () => {
    let comprometida = false;
    transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const result = await callback({ $queryRaw: queryRaw, turno: { updateMany } });
      comprometida = true;
      return result;
    });
    eventoCreate.mockImplementation(async () => { expect(comprometida).toBe(true); return {}; });
    await expect(actualizarPrioridadTurno("turno-1", { prioridad: "URGENTE" }, "mesa-1"))
      .resolves.toEqual({ id: "turno-1", prioridad: "URGENTE" });
    expect(updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { idTurno: "turno-1", estadoTurno: { not: "CANCELADO" } },
      data: { prioridadTurno: "URGENTE", modificadoPorUsuarioId: "mesa-1" },
    });
    expect(eventoCreate).toHaveBeenCalledExactlyOnceWith({ data: {
      tipoEvento: "turno:prioridad_actualizada", turnoId: "turno-1", usuarioId: "mesa-1",
      payloadEvento: { turno_id: "turno-1", prioridad_anterior: "NORMAL", prioridad_nueva: "URGENTE", usuario_id: "mesa-1" },
    } });
  });

  it("la misma prioridad no escribe ni emite evento", async () => {
    await expect(actualizarPrioridadTurno("turno-1", { prioridad: "NORMAL" }, "mesa-1"))
      .resolves.toEqual({ id: "turno-1", prioridad: "NORMAL", sin_cambios: true });
    expect(updateMany).not.toHaveBeenCalled();
    expect(eventoCreate).not.toHaveBeenCalled();
  });

  it.each([
    [[], "TURNO_NO_ENCONTRADO"],
    [[{ idTurno: "turno-1", estadoTurno: "CANCELADO", prioridadTurno: "NORMAL" }], "TURNO_CANCELADO"],
  ])("rechaza turno faltante o cancelado", async (filas, code) => {
    queryRaw.mockResolvedValue(filas);
    await expect(actualizarPrioridadTurno("turno-1", { prioridad: "ALTA" }, "mesa-1")).rejects.toMatchObject({ code });
    expect(updateMany).not.toHaveBeenCalled();
    expect(eventoCreate).not.toHaveBeenCalled();
  });

  it("no emite evento si la escritura condicional falla o revierte la transacción", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(actualizarPrioridadTurno("turno-1", { prioridad: "ALTA" }, "mesa-1"))
      .rejects.toMatchObject({ code: "TURNO_MODIFICADO" });
    expect(eventoCreate).not.toHaveBeenCalled();
  });

  it("admite un turno confirmado vencido sin consultar vigencia", async () => {
    queryRaw.mockResolvedValue([{ idTurno: "turno-1", estadoTurno: "COMPLETO", prioridadTurno: "NORMAL" }]);
    await expect(actualizarPrioridadTurno("turno-1", { prioridad: "ALTA" }, "mesa-1"))
      .resolves.toEqual({ id: "turno-1", prioridad: "ALTA" });
  });

  it("propaga un fallo del evento posterior al commit sin simular rollback", async () => {
    eventoCreate.mockRejectedValue(new Error("evento no disponible"));
    await expect(actualizarPrioridadTurno("turno-1", { prioridad: "ALTA" }, "mesa-1"))
      .rejects.toThrow("evento no disponible");
    expect(transaction).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledOnce();
  });
});
