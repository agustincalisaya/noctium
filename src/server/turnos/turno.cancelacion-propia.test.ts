import { describe, expect, it } from "vitest";
import { inicioDeTurno } from "@/server/shared/fechas-centro";
import { evaluarCancelacion, limiteCancelacionEnLinea, superoElLimiteDeCancelacion } from "./turno.cancelacion-propia";

// Clase del 11/10/2026 a las 13:00 del centro (UTC−3) = 16:00Z; con 24 h de anticipación el límite es el 10/10 a las 16:00Z.
const turno = {
  estadoTurno: "DISPONIBLE" as const,
  fechaTurno: new Date("2026-10-11T00:00:00.000Z"),
  horaInicioTurno: new Date("1970-01-01T13:00:00.000Z"),
};
const INICIO = new Date("2026-10-11T16:00:00.000Z");
const LIMITE = new Date("2026-10-10T16:00:00.000Z");
const parametros = { cancelacionAnticipacionHoras: 24 };
const base = { vigencia: "VIGENTE" as const, estadoPago: "PAGADA" as const, venceEl: null };
const desplazar = (instante: Date, ms: number) => new Date(instante.getTime() + ms);

describe("límite de cancelación en línea", () => {
  it("la clase de prueba empieza a las 16:00Z y su límite con 24 h es el 10/10 a las 16:00Z", () => {
    expect(inicioDeTurno(turno)).toEqual(INICIO);
    expect(limiteCancelacionEnLinea(INICIO, 24)).toEqual(LIMITE);
    expect(limiteCancelacionEnLinea(INICIO, 48)).toEqual(new Date("2026-10-09T16:00:00.000Z"));
  });

  it("el instante exacto del límite todavía es válido; un milisegundo después ya no", () => {
    expect(superoElLimiteDeCancelacion(desplazar(LIMITE, -1), LIMITE)).toBe(false);
    expect(superoElLimiteDeCancelacion(LIMITE, LIMITE)).toBe(false);
    expect(superoElLimiteDeCancelacion(desplazar(LIMITE, 1), LIMITE)).toBe(true);
  });
});

describe("evaluarCancelacion", () => {
  it("permite una inscripción pagada con anticipación de sobra", () => {
    expect(evaluarCancelacion(base, turno, new Date("2026-10-10T13:00:00.000Z"), parametros)).toMatchObject({ estado: "PERMITIDA", limite: LIMITE });
  });

  it.each(["PAGADA", "PAGO_SIN_REGISTRAR"] as const)("%s: un milisegundo antes del límite y el instante exacto del límite son PERMITIDA", (estadoPago) => {
    const inscripcion = { ...base, estadoPago };
    expect(evaluarCancelacion(inscripcion, turno, desplazar(LIMITE, -1), parametros)).toEqual({ estado: "PERMITIDA", limite: LIMITE });
    expect(evaluarCancelacion(inscripcion, turno, LIMITE, parametros)).toEqual({ estado: "PERMITIDA", limite: LIMITE });
  });

  it.each(["PAGADA", "PAGO_SIN_REGISTRAR"] as const)("%s: un milisegundo después del límite es FUERA_DE_PLAZO, hasta un instante antes del inicio", (estadoPago) => {
    const inscripcion = { ...base, estadoPago };
    expect(evaluarCancelacion(inscripcion, turno, desplazar(LIMITE, 1), parametros)).toEqual({ estado: "FUERA_DE_PLAZO", limite: LIMITE });
    expect(evaluarCancelacion(inscripcion, turno, desplazar(INICIO, -1), parametros)).toEqual({ estado: "FUERA_DE_PLAZO", limite: LIMITE });
  });

  it("el límite sale de la anticipación vigente que se le pasa", () => {
    const con48 = { cancelacionAnticipacionHoras: 48 };
    expect(evaluarCancelacion(base, turno, new Date("2026-10-09T16:00:00.000Z"), con48)).toMatchObject({ estado: "PERMITIDA" });
    expect(evaluarCancelacion(base, turno, new Date("2026-10-09T16:00:00.001Z"), con48)).toMatchObject({ estado: "FUERA_DE_PLAZO" });
  });

  describe("reserva sin pagar (excepción: sin límite de anticipación, hasta su vencimiento)", () => {
    const venceEl = new Date("2026-10-11T12:00:00.000Z"); // pasado el límite, antes del inicio
    const reserva = { ...base, estadoPago: "RESERVADA" as const, venceEl };

    it("un milisegundo antes del vencimiento es PERMITIDA aunque haya pasado el límite, y su límite es el vencimiento", () => {
      const momento = desplazar(venceEl, -1);
      expect(superoElLimiteDeCancelacion(momento, LIMITE)).toBe(true);
      expect(evaluarCancelacion(reserva, turno, momento, parametros)).toEqual({ estado: "PERMITIDA", limite: venceEl });
    });

    it("en el instante exacto del vencimiento y después ya no es cancelable", () => {
      expect(evaluarCancelacion(reserva, turno, venceEl, parametros)).toEqual({ estado: "NO_APLICA", limite: null });
      expect(evaluarCancelacion(reserva, turno, desplazar(venceEl, 1), parametros)).toEqual({ estado: "NO_APLICA", limite: null });
    });

    it("una reserva sin vencimiento no es cancelable", () => {
      expect(evaluarCancelacion({ ...reserva, venceEl: null }, turno, desplazar(LIMITE, -1), parametros).estado).toBe("NO_APLICA");
    });
  });

  describe("no aplica", () => {
    it("una clase cancelada o sin confirmar", () => {
      expect(evaluarCancelacion(base, { ...turno, estadoTurno: "CANCELADO" }, new Date("2026-10-10T13:00:00.000Z"), parametros).estado).toBe("NO_APLICA");
      expect(evaluarCancelacion(base, { ...turno, estadoTurno: "PENDIENTE" }, new Date("2026-10-10T13:00:00.000Z"), parametros).estado).toBe("NO_APLICA");
    });

    it.each(["CANCELADA_ALUMNO", "RESERVA_VENCIDA", "QUITADA_CENTRO", "BAJA_ALUMNO"] as const)("una inscripción %s", (vigencia) => {
      expect(evaluarCancelacion({ ...base, vigencia }, turno, new Date("2026-10-10T13:00:00.000Z"), parametros).estado).toBe("NO_APLICA");
    });

    it("una clase que ya empezó, incluso en el instante exacto del inicio", () => {
      expect(evaluarCancelacion(base, turno, INICIO, parametros)).toEqual({ estado: "NO_APLICA", limite: null });
      expect(evaluarCancelacion(base, turno, desplazar(INICIO, 1), parametros)).toEqual({ estado: "NO_APLICA", limite: null });
    });
  });
});
