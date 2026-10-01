import { describe, expect, it } from "vitest";
import { cupo, diaAbreviadoYFecha, diaMes, duracion, fechaCorta, fechaDeInstante, fechaLarga, iniciales, monto } from "./turno-detalle";

describe("formatos del detalle de turno (mockup pág. 5)", () => {
  it("fechas de calendario sin correr el día", () => {
    expect(fechaCorta("2026-10-06")).toBe("06/10/2026");
    expect(diaMes("2026-10-06")).toBe("06/10");
    expect(fechaLarga("2026-10-06")).toBe("Martes 6 de octubre de 2026");
    expect(fechaLarga("2026-01-01")).toBe("Jueves 1 de enero de 2026");
  });

  it("fecha de creación en la zona del centro (Buenos Aires)", () => {
    expect(fechaDeInstante("2026-09-24T12:00:00.000Z")).toBe("24/09/2026");
    // 01:30 UTC del 25 son las 22:30 del 24 en Buenos Aires.
    expect(fechaDeInstante("2026-09-25T01:30:00.000Z")).toBe("24/09/2026");
  });

  it.each([[60, "1 hora"], [120, "2 horas"], [180, "3 horas"], [90, "90 min"], [45, "45 min"]])("duración %i → %s", (minutos, esperado) => {
    expect(duracion(minutos)).toBe(esperado);
  });

  it("cupo máximo en alumnos", () => {
    expect(cupo(6)).toBe("6 alumnos");
    expect(cupo(1)).toBe("1 alumno");
  });

  it("iniciales a partir de «Apellido, Nombre»", () => {
    expect(iniciales("Pérez, Juan")).toBe("JP");
    expect(iniciales("de la Fuente, María José")).toBe("MF");
    expect(iniciales("Ávila, Íñigo")).toBe("ÍÁ");
  });

  it.each([["12000.00", "$ 12.000"], ["15000.50", "$ 15.000,50"], ["999999999.99", "$ 999.999.999,99"], ["500", "$ 500"], ["0.05", "$ 0,05"]])(
    "monto %s → %s", (valor, esperado) => {
      expect(monto(valor)).toBe(esperado);
    });
});

describe("diaAbreviadoYFecha (HU-C-05, mockup pág. 8)", () => {
  it("formatea día abreviado y dd/mm sin correr la fecha de calendario", () => {
    expect(diaAbreviadoYFecha("2026-10-06")).toBe("Mar 06/10");
    expect(diaAbreviadoYFecha("2026-10-04")).toBe("Dom 04/10");
    expect(diaAbreviadoYFecha("2026-10-03")).toBe("Sáb 03/10");
  });
});
