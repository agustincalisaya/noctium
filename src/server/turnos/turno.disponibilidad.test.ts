import { describe, expect, it } from "vitest";
import { calcularTramosLibres, iniciosPosibles } from "./turno.disponibilidad";

const franja = { inicio: 600, fin: 840 }; // 10:00–14:00

describe("HU-C-07 calcularTramosLibres", () => {
  it("conserva la franja completa sin ocupados y no comparte el objeto de entrada", () => {
    const tramos = calcularTramosLibres(franja, []);
    expect(tramos).toEqual([franja]);
    expect(tramos[0]).not.toBe(franja);
  });

  it.each([
    [{ inicio: 660, fin: 720 }, [{ inicio: 600, fin: 660 }, { inicio: 720, fin: 840 }]],
    [{ inicio: 600, fin: 660 }, [{ inicio: 660, fin: 840 }]],
    [{ inicio: 780, fin: 840 }, [{ inicio: 600, fin: 780 }]],
  ])("resta un ocupado en el medio o en un borde", (ocupado, esperado) => {
    expect(calcularTramosLibres(franja, [ocupado])).toEqual(esperado);
  });

  it("ordena y une ocupados superpuestos antes de determinar los tramos libres", () => {
    const ocupados = [{ inicio: 750, fin: 810 }, { inicio: 660, fin: 720 }, { inicio: 700, fin: 780 }];
    expect(calcularTramosLibres(franja, ocupados)).toEqual([{ inicio: 600, fin: 660 }, { inicio: 810, fin: 840 }]);
    expect(ocupados).toEqual([{ inicio: 750, fin: 810 }, { inicio: 660, fin: 720 }, { inicio: 700, fin: 780 }]);
  });

  it("no deja huecos artificiales entre ocupados contiguos", () => {
    expect(calcularTramosLibres(franja, [{ inicio: 660, fin: 720 }, { inicio: 720, fin: 780 }]))
      .toEqual([{ inicio: 600, fin: 660 }, { inicio: 780, fin: 840 }]);
  });

  it("ignora ocupados externos, incluso los contiguos a la franja", () => {
    expect(calcularTramosLibres(franja, [
      { inicio: 480, fin: 600 }, { inicio: 840, fin: 900 }, { inicio: 900, fin: 960 },
    ])).toEqual([franja]);
  });

  it("recorta ocupados que exceden la franja y admite cobertura completa", () => {
    expect(calcularTramosLibres(franja, [{ inicio: 540, fin: 660 }, { inicio: 780, fin: 900 }]))
      .toEqual([{ inicio: 660, fin: 780 }]);
    expect(calcularTramosLibres(franja, [{ inicio: 540, fin: 900 }])).toEqual([]);
  });
});

describe("HU-C-07 iniciosPosibles", () => {
  it.each([
    [60, [600, 630, 660, 690, 720, 750, 780]],
    [120, [600, 630, 660, 690, 720]],
    [180, [600, 630, 660]],
  ])("genera inicios para duración %i y granularidad 30", (duracion, esperados) => {
    expect(iniciosPosibles(franja, duracion, 30)).toEqual(esperados);
  });

  it("incluye el único inicio cuando el tramo mide exactamente la duración", () => {
    expect(iniciosPosibles({ inicio: 600, fin: 720 }, 120, 30)).toEqual([600]);
  });

  it("no ofrece inicios si el tramo es menor que la duración", () => {
    expect(iniciosPosibles({ inicio: 600, fin: 719 }, 120, 30)).toEqual([]);
  });

  it("alinea el primer inicio a múltiplos de granularidad desde las 00:00", () => {
    expect(iniciosPosibles({ inicio: 605, fin: 750 }, 60, 30)).toEqual([630, 660, 690]);
  });

  it("devuelve lista vacía para duración o granularidad que no sean enteros positivos", () => {
    expect(iniciosPosibles(franja, 0, 30)).toEqual([]);
    expect(iniciosPosibles(franja, 60, 0)).toEqual([]);
    expect(iniciosPosibles(franja, 60.5, 30)).toEqual([]);
    expect(iniciosPosibles(franja, 60, 30.5)).toEqual([]);
  });
});
