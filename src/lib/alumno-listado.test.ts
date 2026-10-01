import { describe, expect, it } from "vitest";
import { parametrosListadoAlumnos } from "@/lib/alumno-listado";

describe("parametrosListadoAlumnos (HU-B-05)", () => {
  it("sin búsqueda ni página queda en /alumnos", () => {
    expect(parametrosListadoAlumnos({})).toBe("");
    expect(parametrosListadoAlumnos({ pagina: 1 })).toBe("");
  });

  it("incluye la búsqueda y la página mayor a 1", () => {
    expect(parametrosListadoAlumnos({ q: "val", pagina: 2 })).toBe("?q=val&pagina=2");
    expect(parametrosListadoAlumnos({ pagina: 3 })).toBe("?pagina=3");
  });

  it("codifica espacios y tildes", () => {
    expect(parametrosListadoAlumnos({ q: "pérez joaquín" })).toBe("?q=p%C3%A9rez+joaqu%C3%ADn");
  });
});
