import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, transaccion, clasesConReservasVencidas, marcarVencidas } = vi.hoisted(() => ({
  prisma: { marca: "prisma" },
  transaccion: vi.fn(),
  clasesConReservasVencidas: vi.fn(),
  marcarVencidas: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion }));
vi.mock("@/server/turnos/inscripcion.service", () => ({ clasesConReservasVencidas, marcarVencidas }));

const { vencerReservas } = await import("./reserva.vencimiento.service");
const MOMENTO = new Date("2026-10-09T18:35:00.000Z");
const tx = { marca: "tx" };

beforeEach(() => {
  vi.clearAllMocks();
  transaccion.mockImplementation(async (callback) => callback(tx));
  clasesConReservasVencidas.mockResolvedValue([]);
  marcarVencidas.mockResolvedValue(0);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("HU-C-24 vencerReservas (C §2.18.1)", () => {
  it("sin clases con reservas vencidas responde ceros y no abre transacciones", async () => {
    await expect(vencerReservas(MOMENTO)).resolves.toEqual({ reservasVencidas: 0, clasesAfectadas: 0, ejecutadoEl: MOMENTO });
    expect(clasesConReservasVencidas).toHaveBeenCalledExactlyOnceWith(prisma, MOMENTO);
    expect(transaccion).not.toHaveBeenCalled();
  });

  it("procesa una clase por transacción, con el mismo momento, y suma los totales", async () => {
    clasesConReservasVencidas.mockResolvedValue(["clase-a", "clase-b"]);
    marcarVencidas.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    await expect(vencerReservas(MOMENTO)).resolves.toEqual({ reservasVencidas: 3, clasesAfectadas: 2, ejecutadoEl: MOMENTO });
    expect(transaccion).toHaveBeenCalledTimes(2);
    expect(marcarVencidas.mock.calls).toEqual([[tx, "clase-a", { momento: MOMENTO }], [tx, "clase-b", { momento: MOMENTO }]]);
  });

  it("una clase que otra operación ya limpió (cero marcadas) no cuenta como afectada: idempotente", async () => {
    clasesConReservasVencidas.mockResolvedValue(["clase-a", "clase-b"]);
    marcarVencidas.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await expect(vencerReservas(MOMENTO)).resolves.toMatchObject({ reservasVencidas: 1, clasesAfectadas: 1 });
  });

  it("si una clase falla registra el error y sigue con las demás", async () => {
    clasesConReservasVencidas.mockResolvedValue(["clase-a", "clase-b", "clase-c"]);
    marcarVencidas.mockResolvedValueOnce(1).mockRejectedValueOnce(new Error("lock timeout")).mockResolvedValueOnce(4);
    await expect(vencerReservas(MOMENTO)).resolves.toMatchObject({ reservasVencidas: 5, clasesAfectadas: 2 });
    expect(marcarVencidas).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("clase-b"), expect.any(Error));
  });

  it("sin momento usa el reloj del sistema", async () => {
    const antes = Date.now();
    const { ejecutadoEl } = await vencerReservas();
    expect(ejecutadoEl.getTime()).toBeGreaterThanOrEqual(antes);
    expect(ejecutadoEl.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
