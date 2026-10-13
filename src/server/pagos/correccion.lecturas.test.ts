import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, obtenerNombresPersonal } = vi.hoisted(() => ({
  db: { pago: { findUnique: vi.fn() }, operacionPago: { findUniqueOrThrow: vi.fn() }, formaPago: { findMany: vi.fn() } },
  obtenerNombresPersonal: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/personal/personal.publico", () => ({ obtenerNombresPersonal }));

const { obtenerHistorialDePago } = await import("./correccion.lecturas");

const t = (iso: string) => new Date(iso);
const dec = (v: string) => new Prisma.Decimal(v);

/** Operación de dos pagos (p1 y p2) con correcciones en el orden en que las devuelve INCLUDE_OPERACION_VIGENTE (más nuevas primero). */
function operacion({ correccionesP1 = [] as unknown[], correccionesOperacion = [] as unknown[], anulacionP1 = null as unknown } = {}) {
  return {
    idOperacionPago: "op-1", alumnoId: "a1", cajaId: "caja-1", creadoPorUsuarioId: "u-mesa", registradaEl: t("2026-10-08T13:12:00.000Z"),
    formaPagoId: "formapago-efectivo", fechaPago: t("2026-10-08T00:00:00.000Z"),
    correcciones: correccionesOperacion,
    pagos: [
      {
        idPago: "p1", turnoId: "t1", inscripcionId: "i1", precio: 24000, montoPago: dec("24000"), createdAtPago: t("2026-10-08T13:12:00.000Z"),
        motivoAjuste: null, ajustadoPorUsuarioId: null, correcciones: correccionesP1, anulacion: anulacionP1,
      },
      {
        idPago: "p2", turnoId: "t2", inscripcionId: "i2", precio: 24000, montoPago: dec("24000"), createdAtPago: t("2026-10-08T13:12:00.000Z"),
        motivoAjuste: null, ajustadoPorUsuarioId: null, correcciones: [], anulacion: null,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.pago.findUnique.mockResolvedValue({ operacionId: "op-1" });
  db.formaPago.findMany.mockResolvedValue([
    { idFormaPago: "formapago-efectivo", nombreFormaPago: "Efectivo" },
    { idFormaPago: "formapago-transferencia", nombreFormaPago: "Transferencia" },
  ]);
  obtenerNombresPersonal.mockResolvedValue([
    { usuario_id: "u-mesa", nombre_completo: "Ruiz, Marta" },
    { usuario_id: "u-gerente", nombre_completo: "Pérez, Ana" },
  ]);
});

describe("obtenerHistorialDePago (DEC-27, spec_modulo_I.md §2.14.6)", () => {
  it("pago inexistente → PAGO_NO_ENCONTRADO (404)", async () => {
    db.pago.findUnique.mockResolvedValue(null);
    await expect(obtenerHistorialDePago("nada")).rejects.toMatchObject({ code: "PAGO_NO_ENCONTRADO", status: 404 });
  });

  it("sin cambios: registro con los valores vigentes y cambios: []", async () => {
    db.operacionPago.findUniqueOrThrow.mockResolvedValue(operacion());
    expect(await obtenerHistorialDePago("p1")).toEqual({
      registro: {
        monto: "24000.00", forma_pago: { id: "formapago-efectivo", nombre: "Efectivo" }, fecha_pago: "2026-10-08",
        registrado_por: { usuario_id: "u-mesa", nombre_completo: "Ruiz, Marta" }, registrado_en: "2026-10-08T10:12:00-03:00",
      },
      cambios: [],
    });
  });

  it("mezcla las tres tablas de origen con su propio anterior → nuevo, más nuevo primero, y resuelve usuarios en lote", async () => {
    db.operacionPago.findUniqueOrThrow.mockResolvedValue(operacion({
      correccionesP1: [
        { montoAnterior: dec("22000"), montoNuevo: dec("20000"), motivo: "Beca parcial", creadoPorUsuarioId: "u-mesa", createdAtCorreccionPago: t("2026-10-09T15:00:00.000Z") },
        { montoAnterior: dec("24000"), montoNuevo: dec("22000"), motivo: "Descuento", creadoPorUsuarioId: "u-mesa", createdAtCorreccionPago: t("2026-10-09T14:00:00.000Z") },
      ],
      // La de la operación pudo hacerse desde el otro pago (p2): vale para todos.
      correccionesOperacion: [
        { formaPagoAnteriorId: "formapago-efectivo", formaPagoNuevaId: "formapago-transferencia", fechaPagoAnterior: null, fechaPagoNueva: null, motivo: "Era transferencia", creadoPorUsuarioId: "u-gerente", createdAtCorreccionOperacion: t("2026-10-09T16:00:00.000Z") },
        { formaPagoAnteriorId: null, formaPagoNuevaId: null, fechaPagoAnterior: t("2026-10-08T00:00:00.000Z"), fechaPagoNueva: t("2026-10-07T00:00:00.000Z"), motivo: "Fecha", creadoPorUsuarioId: "u-mesa", createdAtCorreccionOperacion: t("2026-10-09T12:00:00.000Z") },
      ],
      anulacionP1: { motivo: "Reintegro", creadoPorUsuarioId: "u-gerente", createdAtAnulacionPago: t("2026-10-10T12:00:00.000Z") },
    }));
    const r = await obtenerHistorialDePago("p1");
    expect(r.registro).toMatchObject({ monto: "20000.00", forma_pago: { nombre: "Transferencia" }, fecha_pago: "2026-10-07" });
    expect(r.cambios.map((c) => [c.tipo, c.valor_anterior, c.valor_nuevo, c.motivo, c.usuario?.nombre_completo])).toEqual([
      ["ANULACION", "20000.00", null, "Reintegro", "Pérez, Ana"],
      ["CORRECCION_FORMA", "Efectivo", "Transferencia", "Era transferencia", "Pérez, Ana"],
      ["CORRECCION_MONTO", "22000.00", "20000.00", "Beca parcial", "Ruiz, Marta"],
      ["CORRECCION_MONTO", "24000.00", "22000.00", "Descuento", "Ruiz, Marta"],
      ["CORRECCION_FECHA", "2026-10-08", "2026-10-07", "Fecha", "Ruiz, Marta"],
    ]);
    expect(r.cambios[0]!.fecha).toBe("2026-10-10T09:00:00-03:00");
    expect(obtenerNombresPersonal).toHaveBeenCalledTimes(1);
    expect(db.formaPago.findMany).toHaveBeenCalledTimes(1);
  });

  it("en el mismo instante ordena fecha, forma y monto (inverso al orden de escritura)", async () => {
    const mismo = t("2026-10-09T12:00:00.000Z");
    db.operacionPago.findUniqueOrThrow.mockResolvedValue(operacion({
      correccionesP1: [{ montoAnterior: dec("24000"), montoNuevo: dec("20000"), motivo: "m", creadoPorUsuarioId: "u-mesa", createdAtCorreccionPago: mismo }],
      correccionesOperacion: [
        { formaPagoAnteriorId: null, formaPagoNuevaId: null, fechaPagoAnterior: t("2026-10-08T00:00:00.000Z"), fechaPagoNueva: t("2026-10-07T00:00:00.000Z"), motivo: "m", creadoPorUsuarioId: "u-mesa", createdAtCorreccionOperacion: mismo },
        { formaPagoAnteriorId: "formapago-efectivo", formaPagoNuevaId: "formapago-transferencia", fechaPagoAnterior: null, fechaPagoNueva: null, motivo: "m", creadoPorUsuarioId: "u-mesa", createdAtCorreccionOperacion: mismo },
      ],
    }));
    expect((await obtenerHistorialDePago("p1")).cambios.map((c) => c.tipo)).toEqual(["CORRECCION_FECHA", "CORRECCION_FORMA", "CORRECCION_MONTO"]);
  });

  it("una anulación de proceso automático no tiene usuario; una cuenta sin ficha, nombre null", async () => {
    obtenerNombresPersonal.mockResolvedValue([]);
    db.operacionPago.findUniqueOrThrow.mockResolvedValue(operacion({
      anulacionP1: { motivo: "Reintegro", creadoPorUsuarioId: null, createdAtAnulacionPago: t("2026-10-10T12:00:00.000Z") },
    }));
    const r = await obtenerHistorialDePago("p1");
    expect(r.cambios[0]!.usuario).toBeNull();
    expect(r.registro.registrado_por).toEqual({ usuario_id: "u-mesa", nombre_completo: null });
  });
});
