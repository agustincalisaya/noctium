import { describe, expect, it } from "vitest";
import { rolPuedeAccederRuta } from "./rutas-por-rol";
describe("E02 rutas y alcance", () => {
  it("alumnos mesa/gerente; profesor solo ruta de turno", () => { expect(rolPuedeAccederRuta("MESA_ENTRADA","/alumnos/a/clases")).toBe(true); expect(rolPuedeAccederRuta("GERENTE","/alumnos/a")).toBe(true); expect(rolPuedeAccederRuta("PROFESOR","/alumnos")).toBe(false); expect(rolPuedeAccederRuta("PROFESOR","/alumnos/a?tab=historial")).toBe(false); expect(rolPuedeAccederRuta("PROFESOR","/turnos/t/alumnos/a/historial")).toBe(true); });
});
