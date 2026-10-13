import { describe, expect, it } from "vitest";
import { construirFiltroBusquedaGerentes } from "@/server/gerentes/gerente.busqueda";

// Filtro de búsqueda de los gerentes (HU-G-03, spec_modulo_G.md §2.3; criterio de HU-B-05).

const campos = (token: string, conDni = false) => ({
  OR: [
    { apellidoNormalizadoFichaGerente: { contains: token } },
    { nombreNormalizadoFichaGerente: { contains: token } },
    ...(conDni ? [{ dniFichaGerente: { contains: token } }] : []),
  ],
});

describe("construirFiltroBusquedaGerentes", () => {
  it.each([undefined, "", " ", "a", " b "])("menos de 2 caracteres (%j): sin filtro", (q) => {
    expect(construirFiltroBusquedaGerentes(q)).toBeUndefined();
  });

  it("una palabra: en apellido o en nombre (OR), sin el DNI si no es numérica", () => {
    expect(construirFiltroBusquedaGerentes("ferreyra")).toEqual({ AND: [campos("ferreyra")] });
  });

  it("dos palabras: las dos tienen que aparecer (AND), en cualquier orden", () => {
    expect(construirFiltroBusquedaGerentes("carolina paz")).toEqual({ AND: [campos("carolina"), campos("paz")] });
    expect(construirFiltroBusquedaGerentes("paz   carolina")).toEqual({ AND: [campos("paz"), campos("carolina")] });
  });

  it("una palabra numérica suma el DNI (coincidencia parcial)", () => {
    expect(construirFiltroBusquedaGerentes("31222")).toEqual({ AND: [campos("31222", true)] });
    expect(construirFiltroBusquedaGerentes("31a")).toEqual({ AND: [campos("31a")] });
  });

  it("sin distinguir mayúsculas ni tildes: «Álvarez» y «NÚÑEZ» buscan alvarez y nunez", () => {
    expect(construirFiltroBusquedaGerentes("Álvarez")).toEqual({ AND: [campos("alvarez")] });
    expect(construirFiltroBusquedaGerentes("  NÚÑEZ ")).toEqual({ AND: [campos("nunez")] });
  });

  it("como mucho 5 palabras", () => {
    expect(construirFiltroBusquedaGerentes("a1 b2 c3 d4 e5 f6")!.AND).toHaveLength(5);
  });
});
