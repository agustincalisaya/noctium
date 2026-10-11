import { describe, expect, it } from "vitest";
import { TEXTOS, texto } from "./textos";
import { ETIQUETA_ESTADO_TURNO } from "@/types/turno.types";

describe("HU-C-19: presentación central de clases", () => {
  it("el catálogo no conserva la terminología anterior en sus valores", () => {
    expect(Object.entries(TEXTOS).filter(([, valor]) => /\bturnos?\b/i.test(valor))).toEqual([]);
  });
  it("conserva los estados internos y presenta sus etiquetas en femenino", () => {
    expect(ETIQUETA_ESTADO_TURNO).toEqual({
      PENDIENTE: "Pendiente", DISPONIBLE: "Disponible", COMPLETO: "Completa", CANCELADO: "Cancelada",
    });
  });
  it("conserva las claves legacy y distingue el registro como dictada", () => {
    expect(texto("errores.turno.noEncontrado")).toBe("No se encontró la clase");
    expect(texto("errores.claseDictada.turnoNoAdmiteClase")).toBe("Solo se puede registrar como dictada una clase Disponible o Completa");
    expect(texto("errores.inscripcion.alumnoYaAsignado")).toBe("El mismo alumno no puede agregarse dos veces a la misma clase");
  });
});
