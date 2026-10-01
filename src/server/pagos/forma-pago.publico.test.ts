import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, tx } = vi.hoisted(() => {
  const crear = () => ({
    formaPago: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  });
  return { db: crear(), tx: crear() };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const { verificarFormaPagoActiva, existeFormaPago, obtenerFormaPago, listarFormasPagoActivas } =
  await import("./forma-pago.publico");

const conTx = tx as never;

beforeEach(() => vi.clearAllMocks());

describe("verificarFormaPagoActiva", () => {
  it("devuelve { id, nombre } si está activa", async () => {
    db.formaPago.findFirst.mockResolvedValue({ idFormaPago: "fp1", nombreFormaPago: "Efectivo" });

    await expect(verificarFormaPagoActiva("fp1")).resolves.toEqual({ id: "fp1", nombre: "Efectivo" });
    expect(db.formaPago.findFirst).toHaveBeenCalledWith({
      where: { idFormaPago: "fp1", activaFormaPago: true },
      select: { idFormaPago: true, nombreFormaPago: true },
    });
  });

  it("devuelve null si está inactiva o no existe", async () => {
    db.formaPago.findFirst.mockResolvedValue(null);

    await expect(verificarFormaPagoActiva("inactiva")).resolves.toBeNull();
    await expect(verificarFormaPagoActiva("inexistente")).resolves.toBeNull();
  });

  it("usa el db recibido", async () => {
    tx.formaPago.findFirst.mockResolvedValue(null);

    await verificarFormaPagoActiva("fp1", conTx);

    expect(tx.formaPago.findFirst).toHaveBeenCalledOnce();
    expect(db.formaPago.findFirst).not.toHaveBeenCalled();
  });
});

describe("existeFormaPago", () => {
  it("es true si existe, sin mirar el estado", async () => {
    db.formaPago.count.mockResolvedValue(1);

    await expect(existeFormaPago("fp1")).resolves.toBe(true);
    expect(db.formaPago.count).toHaveBeenCalledWith({ where: { idFormaPago: "fp1" } });
  });

  it("es false si no existe", async () => {
    db.formaPago.count.mockResolvedValue(0);

    await expect(existeFormaPago("x")).resolves.toBe(false);
  });

  it("usa el db recibido", async () => {
    tx.formaPago.count.mockResolvedValue(0);

    await existeFormaPago("x", conTx);

    expect(tx.formaPago.count).toHaveBeenCalledOnce();
    expect(db.formaPago.count).not.toHaveBeenCalled();
  });
});

describe("obtenerFormaPago", () => {
  it("devuelve la forma con is_active, aun inactiva (nombre histórico)", async () => {
    db.formaPago.findUnique.mockResolvedValue({
      idFormaPago: "fp1",
      nombreFormaPago: "Cheque",
      activaFormaPago: false,
    });

    await expect(obtenerFormaPago("fp1")).resolves.toEqual({ id: "fp1", nombre: "Cheque", is_active: false });
  });

  it("devuelve null si no existe", async () => {
    db.formaPago.findUnique.mockResolvedValue(null);

    await expect(obtenerFormaPago("x")).resolves.toBeNull();
  });

  it("usa el db recibido", async () => {
    tx.formaPago.findUnique.mockResolvedValue(null);

    await obtenerFormaPago("x", conTx);

    expect(tx.formaPago.findUnique).toHaveBeenCalledOnce();
    expect(db.formaPago.findUnique).not.toHaveBeenCalled();
  });
});

describe("listarFormasPagoActivas", () => {
  it("consulta solo activas ordenadas por nombre normalizado y devuelve { id, nombre }", async () => {
    db.formaPago.findMany.mockResolvedValue([
      { idFormaPago: "a", nombreFormaPago: "Débito" },
      { idFormaPago: "b", nombreFormaPago: "Efectivo" },
    ]);

    await expect(listarFormasPagoActivas()).resolves.toEqual([
      { id: "a", nombre: "Débito" },
      { id: "b", nombre: "Efectivo" },
    ]);
    expect(db.formaPago.findMany).toHaveBeenCalledWith({
      where: { activaFormaPago: true },
      orderBy: { nombreNormalizadaFormaPago: "asc" },
      select: { idFormaPago: true, nombreFormaPago: true },
    });
  });
});
