import { describe, expect, it } from "vitest";
import { MAX_TOKENS_BUSQUEDA, terminoBusqueda, tokenizarBusqueda } from "@/lib/busqueda-texto";

describe("criterio de búsqueda (HU-B-05)", () => {
  it.each([undefined, "", "   ", "a", " a "])("no busca con menos de 2 caracteres (%j)", (texto) => {
    expect(terminoBusqueda(texto)).toBeUndefined();
    expect(tokenizarBusqueda(texto)).toBeNull();
  });

  it("recorta el término sin normalizarlo", () => {
    expect(terminoBusqueda("  Pérez  ")).toBe("Pérez");
  });

  it.each([
    ["ab", ["ab"]],
    ["PÉREZ", ["perez"]],
    ["Ibáñez", ["ibanez"]],
    ["  juan   perez  ", ["juan", "perez"]],
  ])("normaliza y separa %j", (texto, tokens) => {
    expect(tokenizarBusqueda(texto)).toEqual(tokens);
  });

  it("usa las primeras 5 palabras e ignora el resto", () => {
    const tokens = tokenizarBusqueda("uno dos tres cuatro cinco seis siete");
    expect(tokens).toHaveLength(MAX_TOKENS_BUSQUEDA);
    expect(tokens).toEqual(["uno", "dos", "tres", "cuatro", "cinco"]);
  });
});
