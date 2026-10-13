import { describe, expect, it } from "vitest";
import { ReservasPendientesQuerySchema, ReservasVencidasQuerySchema, filtrosReservas } from "./reserva.schema";

// HU-C-26 (spec_modulo_C.md §2.20.2 y §2.20.3): query de las dos pestañas.
const MATERIA = "clh3am8f00000qzrmn831i7rn";

describe("ReservasPendientesQuerySchema", () => {
  it("sin parámetros: página 1", () => {
    expect(ReservasPendientesQuerySchema.parse({})).toEqual({ pagina: 1 });
  });

  it("acepta los tres filtros combinados, recorta el alumno y convierte la página", () => {
    expect(ReservasPendientesQuerySchema.parse({ alumno: "  Ruiz ", materia_id: MATERIA, vencen: "manana", pagina: "3" }))
      .toEqual({ alumno: "Ruiz", materia_id: MATERIA, vencen: "manana", pagina: 3 });
  });

  it.each(["en_3_horas", "hoy", "manana"])("vencen=%s es válido", (vencen) => {
    expect(ReservasPendientesQuerySchema.safeParse({ vencen }).success).toBe(true);
  });

  it.each([
    ["materia_id no CUID", { materia_id: "materia-1" }],
    ["vencen fuera del enum", { vencen: "semana" }],
    ["pagina cero", { pagina: "0" }],
    ["pagina negativa", { pagina: "-2" }],
    ["pagina no entera", { pagina: "1.5" }],
    ["alumno de más de 100 caracteres", { alumno: "a".repeat(101) }],
    ["por_pagina (fijo en 10)", { por_pagina: "20" }],
    ["campo extra", { tab: "pendientes" }],
  ])("rechaza %s", (_caso, query) => {
    expect(ReservasPendientesQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("ReservasVencidasQuerySchema", () => {
  it("acepta alumno, materia y página", () => {
    expect(ReservasVencidasQuerySchema.parse({ alumno: "301", materia_id: MATERIA, pagina: "2" }))
      .toEqual({ alumno: "301", materia_id: MATERIA, pagina: 2 });
  });

  it("rechaza `vencen` (solo en Pendientes) y cualquier campo extra", () => {
    expect(ReservasVencidasQuerySchema.safeParse({ vencen: "hoy" }).success).toBe(false);
    expect(ReservasVencidasQuerySchema.safeParse({ dias: "30" }).success).toBe(false);
  });

  it("rechaza materia_id no CUID y página no positiva", () => {
    expect(ReservasVencidasQuerySchema.safeParse({ materia_id: "x" }).success).toBe(false);
    expect(ReservasVencidasQuerySchema.safeParse({ pagina: "0" }).success).toBe(false);
  });
});

describe("filtrosReservas", () => {
  it("traduce materia_id → materiaId y omite lo que no vino", () => {
    expect(filtrosReservas({ materia_id: MATERIA, pagina: 1 })).toEqual({ materiaId: MATERIA, pagina: 1 });
    expect(filtrosReservas({ alumno: "Ruiz", vencen: "hoy" as const, pagina: 2 })).toEqual({ alumno: "Ruiz", vencen: "hoy", pagina: 2 });
  });
});
