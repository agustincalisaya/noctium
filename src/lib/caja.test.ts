import { describe, expect, it } from "vitest";
import {
  antiguedad, confirmacionCierre, fechaHoraCaja, montoConSigno, montoNoNegativoValido, textoDiferencia, textoDiferenciaEnFrase,
} from "@/lib/caja";

// HU-I-12: formatos de la caja (criterios 7 y 8; antigüedad del criterio 10).
describe("formatos de la caja", () => {
  it("montos con signo y sin centavos cuando son enteros", () => {
    expect(montoConSigno("12000.00")).toBe("$ 12.000");
    expect(montoConSigno("-1500.00")).toBe("− $ 1.500");
    expect(montoConSigno("200.50")).toBe("$ 200,50");
    expect(montoConSigno("0.00")).toBe("$ 0");
  });
  it("valida el monto como el servidor, aceptando coma decimal", () => {
    expect(montoNoNegativoValido("0")).toBe(true);
    expect(montoNoNegativoValido("16000,5")).toBe(true);
    expect(montoNoNegativoValido("-1")).toBe(false);
    expect(montoNoNegativoValido("1.234")).toBe(false);
    expect(montoNoNegativoValido("")).toBe(false);
  });
  it("criterio 7: Sobrante, Faltante o La caja cuadra", () => {
    expect(textoDiferencia("FALTANTE", "-1500.00")).toBe("Faltante de $ 1.500");
    expect(textoDiferencia("SOBRANTE", "250.00")).toBe("Sobrante de $ 250");
    expect(textoDiferencia("CUADRA", "0.00")).toBe("La caja cuadra");
    expect(textoDiferenciaEnFrase("CUADRA", "0.00")).toBe("la caja cuadra");
  });
  it("criterio 8: la confirmación con el texto literal (la leyenda irreversible la agrega el diálogo)", () => {
    expect(confirmacionCierre("FALTANTE", "-1500.00")).toBe("¿Estás seguro de que querés cerrar tu caja con un faltante de $ 1.500?");
    expect(confirmacionCierre("SOBRANTE", "300.00")).toBe("¿Estás seguro de que querés cerrar tu caja con un sobrante de $ 300?");
    expect(confirmacionCierre("CUADRA", "0.00")).toBe("¿Estás seguro de que querés cerrar tu caja sin diferencia?");
    expect(confirmacionCierre("FALTANTE", "-10.00", "Ruiz, Marta")).toBe("¿Estás seguro de que querés cerrar la caja de Ruiz, Marta con un faltante de $ 10?");
    expect(confirmacionCierre("CUADRA", "0.00", "Ruiz, Marta")).toBe("¿Estás seguro de que querés cerrar la caja de Ruiz, Marta sin diferencia?");
  });
  it("fecha y hora en la zona del centro, sin coma", () => {
    expect(fechaHoraCaja("2026-10-06T19:18:00-03:00")).toBe("06/10/2026 19:18");
    expect(fechaHoraCaja("2026-10-07T01:05:00.000Z")).toBe("06/10/2026 22:05");
  });
  it("antigüedad en minutos, horas o días", () => {
    expect(antiguedad(1)).toBe("1 minuto");
    expect(antiguedad(45)).toBe("45 minutos");
    expect(antiguedad(60)).toBe("1 hora");
    expect(antiguedad(180)).toBe("3 horas");
    expect(antiguedad(1620)).toBe("27 horas");
    expect(antiguedad(48 * 60)).toBe("2 días");
  });
});
