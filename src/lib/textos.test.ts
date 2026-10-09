import { describe, expect, it, vi } from "vitest";
import { TEXTOS, texto, type ClaveTexto } from "@/lib/textos";

describe("texto", () => {
  it("preserva el catálogo y la interpolación síncrona", () => {
    expect(texto("errores.examen.notaFueraDeRango", { min: 0, max: 10 })).toBe("La nota debe estar entre 0 y 10");
    expect(texto("errores.profesor.conClasesFuturas")).toBe(TEXTOS["errores.profesor.conClasesFuturas"]);
    expect(texto("errores.profesor.conClasesFuturas", { total: null })).toContain("{total}");
    expect(texto("errores.profesor.conClasesFuturas", { total: 0 })).toContain("0 clases");
  });
  it("devuelve la clave ausente y advierte sólo esa clave, sin datos sensibles", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(texto("ui.inexistente" as ClaveTexto, { secreto: "privado" })).toBe("ui.inexistente");
      expect(texto("toString" as ClaveTexto)).toBe("toString");
      expect(warn.mock.calls).toEqual([["ui.inexistente"], ["toString"]]);
    } finally { warn.mockRestore(); }
  });
  it("los estados nuevos de clases usan femenino", () => {
    expect(TEXTOS["ui.turnos.clase.nombre"]).toBe("Clase");
    expect(TEXTOS["ui.turnos.estado.completa"]).toBe("Completa");
    expect(TEXTOS["ui.turnos.estado.cancelada"]).toBe("Cancelada");
  });
});
