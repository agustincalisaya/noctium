import { describe, expect, it } from "vitest";
import { RUTA_PRIMER_INGRESO, rolPuedeAccederRuta, rutaAdmiteMarca } from "./rutas-por-rol";
describe("E02 rutas y alcance", () => {
  it("alumnos mesa/gerente; profesor solo ruta de turno", () => { expect(rolPuedeAccederRuta("MESA_ENTRADA","/alumnos/a/clases")).toBe(true); expect(rolPuedeAccederRuta("GERENTE","/alumnos/a")).toBe(true); expect(rolPuedeAccederRuta("PROFESOR","/alumnos")).toBe(false); expect(rolPuedeAccederRuta("PROFESOR","/alumnos/a?tab=historial")).toBe(false); expect(rolPuedeAccederRuta("PROFESOR","/turnos/t/alumnos/a/historial")).toBe(true); });
});

// HU-A-06 (spec_modulo_A.md §2.6.2 y §2.8.2): rutas de las pantallas de
// contraseña y qué ruta admite la marca «Debe cambiar la contraseña».
const ROLES = ["MESA_ENTRADA", "PROFESOR", "GERENTE", "ALUMNO"] as const;

describe("HU-A-06 pantallas de contraseña", () => {
  it.each(ROLES)("%s accede a /primer-ingreso y a /mi-cuenta", (rol) => {
    expect(rolPuedeAccederRuta(rol, "/primer-ingreso")).toBe(true);
    expect(rolPuedeAccederRuta(rol, "/mi-cuenta")).toBe(true);
  });

  it("las reglas existentes no cambian", () => {
    expect(rolPuedeAccederRuta("ALUMNO", "/alumnos")).toBe(false);
    expect(rolPuedeAccederRuta("MESA_ENTRADA", "/aulas")).toBe(false);
    expect(rolPuedeAccederRuta("PROFESOR", "/home")).toBe(true);
    expect(rolPuedeAccederRuta("ALUMNO", "/mi-historial")).toBe(true);
    expect(rolPuedeAccederRuta("MESA_ENTRADA", "/mi-historial")).toBe(false);
  });
});

describe("HU-A-06 rutaAdmiteMarca", () => {
  it("la ruta de destino es /primer-ingreso", () => {
    expect(RUTA_PRIMER_INGRESO).toBe("/primer-ingreso");
  });

  it.each(["/primer-ingreso", "/primer-ingreso/", "/primer-ingreso/algo"])("%s admite la marca", (ruta) => {
    expect(rutaAdmiteMarca(ruta)).toBe(true);
  });

  it.each(["/home", "/mi-cuenta", "/alumnos", "/turnos/abc", "/", "/primer-ingresos", "/x/primer-ingreso"])(
    "%s no admite la marca",
    (ruta) => {
      expect(rutaAdmiteMarca(ruta)).toBe(false);
    },
  );
});

// HU-A-05 (spec_modulo_A.md §2.7, P-A11, decisión 12 de la task): las dos
// pantallas de la recuperación son públicas. No están en el `matcher` del
// proxy ni en el mapa de rutas: ningún rol queda afuera y la marca no las toca.
describe("HU-A-05 rutas públicas de la recuperación", () => {
  it.each(ROLES)("%s no tiene restricción en /recuperar-contrasena ni en /restablecer-contrasena", (rol) => {
    expect(rolPuedeAccederRuta(rol, "/recuperar-contrasena")).toBe(true);
    expect(rolPuedeAccederRuta(rol, "/restablecer-contrasena?token=abc")).toBe(true);
  });

  it.each(["/recuperar-contrasena", "/restablecer-contrasena"])("%s no es la ruta de la marca", (ruta) => {
    expect(rutaAdmiteMarca(ruta)).toBe(false);
  });
});
