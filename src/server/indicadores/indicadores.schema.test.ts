import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cantidadMesesInclusivos,
  RangoIndicadoresQuerySchema,
  listarMeses,
  mesActualBuenosAires,
  resolverRangoIndicadores,
} from "./indicadores.schema";

afterEach(() => vi.useRealTimers());

describe("rango mensual de Indicadores", () => {
  it("resuelve por defecto los últimos seis meses incluyendo el actual del centro", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T18:00:00.000Z"));

    const rango = resolverRangoIndicadores({});

    expect(rango).toEqual({
      desde: "2026-04",
      hasta: "2026-09",
      meses: ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"],
    });
  });

  it("calcula el mes de Buenos Aires cuando UTC ya cambió de mes", () => {
    expect(mesActualBuenosAires(new Date("2026-10-01T02:30:00.000Z"))).toBe("2026-09");
  });

  it("si solo se envía hasta, incluye los cinco meses anteriores", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T18:00:00.000Z"));
    expect(resolverRangoIndicadores({ hasta: "2027-01" })).toMatchObject({
      desde: "2026-08",
      hasta: "2027-01",
    });
  });

  it("si solo se envía desde, usa el mes actual como hasta", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T18:00:00.000Z"));
    expect(resolverRangoIndicadores({ desde: "2026-07" })).toMatchObject({
      desde: "2026-07",
      hasta: "2026-09",
    });
  });

  it("acepta exactamente 24 meses y rechaza 25", () => {
    expect(RangoIndicadoresQuerySchema.safeParse({ desde: "2024-10", hasta: "2026-09" }).success).toBe(true);
    const resultado = RangoIndicadoresQuerySchema.safeParse({ desde: "2024-09", hasta: "2026-09" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(resultado.error.issues[0]?.message).toBe("El rango máximo es de 24 meses");
  });

  it("rechaza meses mal formados y rangos invertidos", () => {
    expect(RangoIndicadoresQuerySchema.safeParse({ desde: "2026-13", hasta: "2026-09" }).success).toBe(false);
    const invertido = RangoIndicadoresQuerySchema.safeParse({ desde: "2026-10", hasta: "2026-09" });
    expect(invertido.success).toBe(false);
    if (!invertido.success) expect(invertido.error.issues[0]?.message).toBe("El mes desde no puede ser posterior al mes hasta");
  });

  it("rechaza desde futuro si hasta se omite", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T18:00:00.000Z"));
    const resultado = RangoIndicadoresQuerySchema.safeParse({ desde: "2026-10" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(resultado.error.issues[0]?.message).toBe("El mes desde no puede ser posterior al mes actual");
  });

  it("lista todos los meses entre años y conserva un rango de un mes", () => {
    expect(listarMeses("2026-12", "2027-02")).toEqual(["2026-12", "2027-01", "2027-02"]);
    expect(listarMeses("2026-09", "2026-09")).toEqual(["2026-09"]);
    expect(cantidadMesesInclusivos("2026-09", "2026-09")).toBe(1);
  });
});

 describe("página de presentismo bajo", () => {
  it("usa página uno por defecto", async () => { const { PresentismoBajoQuerySchema } = await import("./indicadores.schema"); expect(PresentismoBajoQuerySchema.parse({}).pagina).toBe(1); });
  it.each(["0", "-1", "1.5", "abc", ""])("rechaza página %s", async pagina => { const { PresentismoBajoQuerySchema } = await import("./indicadores.schema"); expect(PresentismoBajoQuerySchema.safeParse({ pagina }).success).toBe(false); });
 });
