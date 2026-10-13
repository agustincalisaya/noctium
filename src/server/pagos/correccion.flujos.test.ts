import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { corregirPago, corregirOperacion, anularPago, operacionVigente, tx, llamadas } = vi.hoisted(() => {
  const llamadas: string[] = [];
  return {
    llamadas,
    corregirPago: vi.fn(async () => { llamadas.push("monto"); return { comprobante: { id: "comp-monto", numeroVisible: "0001-00000010" } }; }),
    corregirOperacion: vi.fn(async () => { llamadas.push("operacion"); return { clasesAbarcadas: 3, comprobante: { id: "comp-op", numeroVisible: "0001-00000011" } }; }),
    anularPago: vi.fn(),
    operacionVigente: vi.fn(),
    tx: {
      pago: { findUniqueOrThrow: vi.fn() },
      formaPago: { findUniqueOrThrow: vi.fn() },
    },
  };
});
vi.mock("@/server/pagos/correccion.service", () => ({ corregirPago, corregirOperacion, anularPago }));
vi.mock("@/server/pagos/pago.vigente", () => ({ operacionVigente }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: (fn: (t: typeof tx) => unknown) => fn(tx) }));

const { corregirPagoFlujo, anularPagoFlujo } = await import("./correccion.flujos");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");

const MESA = { id: "u-mesa", rol: "MESA_ENTRADA" as const };
const FECHA = new Date("2026-10-08T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  llamadas.length = 0;
  tx.pago.findUniqueOrThrow.mockResolvedValue({ operacionId: "op-1", inscripcionId: "insc-1" });
  tx.formaPago.findUniqueOrThrow.mockResolvedValue({ idFormaPago: "formapago-efectivo", nombreFormaPago: "Efectivo", activaFormaPago: false });
  operacionVigente.mockResolvedValue({
    operacionId: "op-1", formaPagoId: "formapago-efectivo", fechaPago: FECHA,
    pagos: [
      { pagoId: "p1", monto: new Prisma.Decimal("10000"), anulado: false },
      { pagoId: "p2", monto: new Prisma.Decimal("12000"), anulado: false },
      { pagoId: "p3", monto: new Prisma.Decimal("12000"), anulado: true },
    ],
  });
});

describe("corregirPagoFlujo (spec_modulo_I.md §2.14.2)", () => {
  it("solo monto: llama a corregirPago y no a corregirOperacion; clases_abarcadas = pagos no anulados", async () => {
    const r = await corregirPagoFlujo("p1", { monto: "10000", motivo: "Beca" }, MESA);
    expect(corregirPago).toHaveBeenCalledExactlyOnceWith(tx, { pagoId: "p1", monto: "10000", motivo: "Beca", usuario: MESA, cajaAjusteId: undefined });
    expect(corregirOperacion).not.toHaveBeenCalled();
    expect(r).toEqual({
      pago_id: "p1", monto: "10000.00", forma_pago: { id: "formapago-efectivo", nombre: "Efectivo", is_active: false },
      fecha_pago: "2026-10-08", clases_abarcadas: 2, comprobante: { id: "comp-monto", numero: "0001-00000010" },
    });
  });

  it("solo forma o fecha: llama a corregirOperacion con la fecha ya como Date", async () => {
    await corregirPagoFlujo("p1", { forma_pago_id: "formapago-debito", motivo: "Era débito" }, MESA);
    await corregirPagoFlujo("p1", { fecha_pago: FECHA, motivo: "Fecha", caja_ajuste_id: "c-caja" }, MESA);
    expect(corregirPago).not.toHaveBeenCalled();
    expect(corregirOperacion).toHaveBeenNthCalledWith(1, tx, {
      pagoId: "p1", formaPagoId: "formapago-debito", fechaPago: undefined, motivo: "Era débito", usuario: MESA, cajaAjusteId: undefined,
    });
    expect(corregirOperacion).toHaveBeenNthCalledWith(2, tx, {
      pagoId: "p1", formaPagoId: undefined, fechaPago: FECHA, motivo: "Fecha", usuario: MESA, cajaAjusteId: "c-caja",
    });
  });

  it("monto y forma a la vez: primero el monto, después la operación; responde con el último comprobante y su clases_abarcadas", async () => {
    const r = await corregirPagoFlujo("p1", { monto: "10000", forma_pago_id: "formapago-debito", motivo: "Ambos" }, MESA);
    expect(llamadas).toEqual(["monto", "operacion"]);
    expect(r).toMatchObject({ clases_abarcadas: 3, comprobante: { id: "comp-op", numero: "0001-00000011" } });
  });

  it("no envuelve los errores del servicio", async () => {
    const error = new ErrorDeDominio("errores.pago.fueraDeAlcance");
    corregirPago.mockRejectedValueOnce(error);
    await expect(corregirPagoFlujo("p1", { monto: "1", forma_pago_id: "formapago-debito", motivo: "x" }, MESA)).rejects.toBe(error);
    expect(corregirOperacion).not.toHaveBeenCalled();
  });
});

describe("anularPagoFlujo (spec_modulo_I.md §2.14.3)", () => {
  it("delega en anularPago y arma la respuesta con la reserva reabierta y el comprobante de reemplazo", async () => {
    anularPago.mockResolvedValue({
      inscripcion: { cambio: true, anterior: "PAGADA", nuevo: "RESERVADA", venceEl: new Date("2026-10-10T13:14:00.000Z") },
      comprobante: { id: "comp-2", numeroVisible: "0001-00000132" }, ajustes: [], anulacionId: "an-1",
    });
    const r = await anularPagoFlujo("p1", { motivo: "Reintegro", caja_ajuste_id: "c-caja" }, MESA);
    expect(anularPago).toHaveBeenCalledExactlyOnceWith(tx, { pagoId: "p1", motivo: "Reintegro", usuario: MESA, cajaAjusteId: "c-caja" });
    expect(r).toEqual({
      pago_id: "p1", anulado: true,
      inscripcion: { id: "insc-1", estado_pago: "RESERVADA", vence_el: "2026-10-10T10:14:00-03:00" },
      comprobante: { id: "comp-2", numero: "0001-00000132", reemplazo: true },
    });
  });

  it("sin reserva reabierta ni comprobante nuevo: vence_el y comprobante en null", async () => {
    anularPago.mockResolvedValue({
      inscripcion: { cambio: true, anterior: "PAGADA", nuevo: "PAGO_SIN_REGISTRAR", venceEl: null },
      comprobante: null, ajustes: [], anulacionId: "an-1",
    });
    expect(await anularPagoFlujo("p1", { motivo: "x" }, MESA)).toMatchObject({
      inscripcion: { estado_pago: "PAGO_SIN_REGISTRAR", vence_el: null }, comprobante: null,
    });
  });

  it("no envuelve los errores del servicio", async () => {
    const error = new ErrorDeDominio("errores.pago.yaAnulado");
    anularPago.mockRejectedValue(error);
    await expect(anularPagoFlujo("p1", { motivo: "x" }, MESA)).rejects.toBe(error);
  });
});
