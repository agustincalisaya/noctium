import { describe, expect, it } from "vitest";
import { construirFiltroBusquedaPersonal } from "@/server/personal/personal.busqueda";

// Filtro de búsqueda del personal (HU-F-03, spec_modulo_F.md §2.3; criterio de HU-B-05).

const campos = (token: string, conDni = false) => ({
  OR: [
    { apellidoNormalizadoFichaMesaEntrada: { contains: token } },
    { nombreNormalizadoFichaMesaEntrada: { contains: token } },
    ...(conDni ? [{ dniFichaMesaEntrada: { contains: token } }] : []),
  ],
});

describe("construirFiltroBusquedaPersonal", () => {
  it.each([undefined, "", " ", "a", " b "])("menos de 2 caracteres (%j): sin filtro", (q) => {
    expect(construirFiltroBusquedaPersonal(q)).toBeUndefined();
  });

  it("una palabra: en apellido o en nombre (OR), sin el DNI si no es numérica", () => {
    expect(construirFiltroBusquedaPersonal("ruiz")).toEqual({ AND: [campos("ruiz")] });
  });

  it("dos palabras: las dos tienen que aparecer (AND), en cualquier orden", () => {
    expect(construirFiltroBusquedaPersonal("marta ruiz")).toEqual({ AND: [campos("marta"), campos("ruiz")] });
    expect(construirFiltroBusquedaPersonal("ruiz   marta")).toEqual({ AND: [campos("ruiz"), campos("marta")] });
  });

  it("una palabra numérica suma el DNI (coincidencia parcial)", () => {
    expect(construirFiltroBusquedaPersonal("31222")).toEqual({ AND: [campos("31222", true)] });
    expect(construirFiltroBusquedaPersonal("31a")).toEqual({ AND: [campos("31a")] });
  });

  it("sin distinguir mayúsculas ni tildes: «Álvarez» y «NÚÑEZ» buscan alvarez y nunez", () => {
    expect(construirFiltroBusquedaPersonal("Álvarez")).toEqual({ AND: [campos("alvarez")] });
    expect(construirFiltroBusquedaPersonal("  NÚÑEZ ")).toEqual({ AND: [campos("nunez")] });
  });

  it("como mucho 5 palabras", () => {
    expect(construirFiltroBusquedaPersonal("a1 b2 c3 d4 e5 f6")!.AND).toHaveLength(5);
  });
});
