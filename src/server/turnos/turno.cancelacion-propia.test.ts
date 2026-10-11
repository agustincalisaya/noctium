import { describe, expect, it } from "vitest";
import { inicioDeTurno } from "@/server/shared/fechas-centro";
import { evaluarCancelacion } from "./turno.cancelacion-propia";

const momento = new Date("2026-10-10T13:00:00.000Z");
const turno = {
  estadoTurno: "DISPONIBLE" as const,
  fechaTurno: new Date("2026-10-11T00:00:00.000Z"),
  horaInicioTurno: new Date("1970-01-01T13:00:00.000Z"),
};
const base = { vigencia: "VIGENTE" as const, estadoPago: "PAGADA" as const, venceEl: null };

describe("evaluarCancelacion", () => {
  it("admite una inscripción pagada en el instante exacto del límite", () => {
    expect(evaluarCancelacion(base, turno, momento, { cancelacionAnticipacionHoras: 24 })).toMatchObject({ estado: "PERMITIDA" });
  });

  it("rechaza una inscripción pagada pasado el límite", () => {
    const limite = new Date(inicioDeTurno(turno).getTime() - 24 * 3_600_000);
    expect(evaluarCancelacion(base, turno, new Date(limite.getTime() + 1), { cancelacionAnticipacionHoras: 24 })).toMatchObject({ estado: "FUERA_DE_PLAZO" });
  });

  it("permite una reserva sin pagar antes de vencer aunque haya pasado el límite", () => {
    const reserva = { ...base, estadoPago: "RESERVADA" as const, venceEl: new Date("2026-10-10T14:00:00.000Z") };
    expect(evaluarCancelacion(reserva, turno, new Date("2026-10-10T13:30:00.000Z"), { cancelacionAnticipacionHoras: 25 })).toMatchObject({ estado: "PERMITIDA", limite: reserva.venceEl });
  });

  it("no habilita clases canceladas, iniciadas ni inscripciones finalizadas", () => {
    expect(evaluarCancelacion(base, { ...turno, estadoTurno: "CANCELADO" }, momento, { cancelacionAnticipacionHoras: 24 }).estado).toBe("NO_DISPONIBLE");
    expect(evaluarCancelacion({ ...base, vigencia: "CANCELADA_ALUMNO" }, turno, momento, { cancelacionAnticipacionHoras: 24 }).estado).toBe("NO_DISPONIBLE");
  });

  it("rechaza una reserva cuyo vencimiento ya pasó aunque esté dentro del plazo de anticipación", () => {
    const reservaVencida = { ...base, estadoPago: "RESERVADA" as const, venceEl: new Date("2026-10-10T12:59:00.000Z") };
    expect(evaluarCancelacion(reservaVencida, turno, momento, { cancelacionAnticipacionHoras: 24 })).toMatchObject({ estado: "NO_DISPONIBLE", limite: null });
  });
});
