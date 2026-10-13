import { describe, expect, it } from "vitest";
import { diaYHoraDeInstanteCentro, formatearFaltan, nombreNatural } from "./reservas-formato";
import { parametrosListadoReservas } from "./reservas-listado";

// HU-C-26 criterio 2: cuánto falta para que venza («en 45 min», «en 3 h») y
// formatos de las filas (fotos del prototipo).
describe("formatearFaltan", () => {
  it.each([
    [45, "en 45 min"],
    [180, "en 3 h"],
    [60, "en 1 h"],
    [90, "en 1 h 30 min"],
    [125, "en 2 h 5 min"],
    [59, "en 59 min"],
    [1500, "en 25 h"],
  ])("%i minutos → «%s»", (minutos, esperado) => {
    expect(formatearFaltan(minutos)).toBe(esperado);
  });

  it("una reserva listada no muestra «en 0 min»", () => {
    expect(formatearFaltan(0)).toBe("en 1 min");
  });
});

describe("formatos de las filas", () => {
  it("instante del centro → «Mar 06/10 22:04», sin correr la zona", () => {
    expect(diaYHoraDeInstanteCentro("2026-10-06T22:04:00-03:00")).toBe("Mar 06/10 22:04");
    expect(diaYHoraDeInstanteCentro("2026-10-07T00:19:00-03:00")).toBe("Mié 07/10 00:19");
  });

  it("«Apellido, Nombre» → «Nombre Apellido»", () => {
    expect(nombreNatural("Acosta, Sofía")).toBe("Sofía Acosta");
    expect(nombreNatural("De la Torre, Juan Pablo")).toBe("Juan Pablo De la Torre");
    expect(nombreNatural("SinComa")).toBe("SinComa");
  });
});

describe("parametrosListadoReservas", () => {
  it("el listado sin filtros queda en /reservas", () => {
    expect(parametrosListadoReservas({})).toBe("");
    expect(parametrosListadoReservas({ tab: "pendientes", pagina: 1 })).toBe("");
  });

  it("conserva pestaña, filtros y página", () => {
    expect(parametrosListadoReservas({ tab: "pendientes", alumno: "Ruiz", materiaId: "m1", vencen: "hoy", pagina: 2 }))
      .toBe("?alumno=Ruiz&materia_id=m1&vencen=hoy&pagina=2");
  });

  it("`vencen` solo en Pendientes", () => {
    expect(parametrosListadoReservas({ tab: "vencidas", vencen: "hoy", pagina: 3 })).toBe("?tab=vencidas&pagina=3");
  });
});
