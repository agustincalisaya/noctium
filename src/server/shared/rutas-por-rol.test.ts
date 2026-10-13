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

// HU-F-01 (spec_modulo_F.md §3.7, decisión 12 de la task): solo el Gerente
// gestiona el personal de mesa de entrada.
describe("HU-F-01 personal de mesa de entrada", () => {
  it.each(["/personal", "/personal/nuevo", "/personal/x", "/personal/x/editar"])("GERENTE accede a %s", (ruta) => {
    expect(rolPuedeAccederRuta("GERENTE", ruta)).toBe(true);
  });

  it.each(["MESA_ENTRADA", "PROFESOR", "ALUMNO"] as const)("%s no accede a /personal ni a sus subrutas", (rol) => {
    expect(rolPuedeAccederRuta(rol, "/personal")).toBe(false);
    expect(rolPuedeAccederRuta(rol, "/personal/x/editar")).toBe(false);
  });

  it("compara por segmento completo", () => {
    expect(rolPuedeAccederRuta("ALUMNO", "/personales")).toBe(true);
  });
});

// HU-G-01 (spec_modulo_G.md §3.7, decisión 11 de la task): solo el Gerente
// gestiona a los gerentes. `/gerentes` tiene su propia regla, distinta de la
// de `/gerente` (el panel de indicadores).
describe("HU-G-01 gerentes", () => {
  it.each(["/gerentes", "/gerentes/nuevo", "/gerentes/x", "/gerentes/x/editar"])("GERENTE accede a %s", (ruta) => {
    expect(rolPuedeAccederRuta("GERENTE", ruta)).toBe(true);
  });

  it.each(["MESA_ENTRADA", "PROFESOR", "ALUMNO"] as const)("%s no accede a /gerentes ni a sus subrutas", (rol) => {
    expect(rolPuedeAccederRuta(rol, "/gerentes")).toBe(false);
    expect(rolPuedeAccederRuta(rol, "/gerentes/nuevo")).toBe(false);
    expect(rolPuedeAccederRuta(rol, "/gerentes/x/editar")).toBe(false);
  });

  it("la regla de /gerente (indicadores) no cambia y se compara por segmento completo", () => {
    expect(rolPuedeAccederRuta("GERENTE", "/gerente")).toBe(true);
    expect(rolPuedeAccederRuta("MESA_ENTRADA", "/gerente")).toBe(false);
    expect(rolPuedeAccederRuta("ALUMNO", "/gerentesx")).toBe(true);
  });
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

// HU-I-11 (spec_modulo_I.md §2.9.3): el comprobante, para mesa de entrada y
// gerente (`comprobantes:leer`); el del alumno, bajo /mis-pagos.
describe("HU-I-11 comprobantes", () => {
  it("/comprobantes: mesa de entrada y gerente; ni profesor ni alumno", () => {
    expect(rolPuedeAccederRuta("MESA_ENTRADA", "/comprobantes/c1")).toBe(true);
    expect(rolPuedeAccederRuta("GERENTE", "/comprobantes/c1")).toBe(true);
    expect(rolPuedeAccederRuta("PROFESOR", "/comprobantes/c1")).toBe(false);
    expect(rolPuedeAccederRuta("ALUMNO", "/comprobantes/c1")).toBe(false);
  });

  it("/mis-pagos: solo el alumno", () => {
    expect(rolPuedeAccederRuta("ALUMNO", "/mis-pagos/p1/comprobante")).toBe(true);
    for (const rol of ["MESA_ENTRADA", "GERENTE", "PROFESOR"] as const) {
      expect(rolPuedeAccederRuta(rol, "/mis-pagos/p1/comprobante")).toBe(false);
    }
  });

  it("/pagos sigue solo para mesa de entrada", () => {
    expect(rolPuedeAccederRuta("GERENTE", "/pagos/registrar")).toBe(false);
  });
});

// HU-I-10 (criterio 9): «Solo mesa de entrada registra pagos».
describe("HU-I-10 pagos", () => {
  it("/pagos/registrar: solo mesa de entrada", () => {
    expect(rolPuedeAccederRuta("MESA_ENTRADA", "/pagos/registrar")).toBe(true);
    for (const rol of ["GERENTE", "PROFESOR", "ALUMNO"] as const) {
      expect(rolPuedeAccederRuta(rol, "/pagos/registrar")).toBe(false);
    }
  });
});

// HU-C-26 (spec_modulo_C.md §2.20, criterio 8): «Reservas» solo mesa de entrada.
describe("HU-C-26 reservas", () => {
  it("/reservas: solo mesa de entrada, con cualquier pestaña o filtro", () => {
    expect(rolPuedeAccederRuta("MESA_ENTRADA", "/reservas")).toBe(true);
    for (const rol of ["GERENTE", "PROFESOR", "ALUMNO"] as const) {
      expect(rolPuedeAccederRuta(rol, "/reservas")).toBe(false);
      expect(rolPuedeAccederRuta(rol, "/reservas/x")).toBe(false);
    }
  });
});

// HU-I-12 (spec_modulo_I.md §2.10 a §2.12): «Mi caja» solo mesa de entrada;
// «Cierres de caja» solo el Gerente. Se compara por segmento: /caja ≠ /cajas.
describe("HU-I-12 caja", () => {
  it("/caja y el detalle de mis cierres: solo mesa de entrada", () => {
    expect(rolPuedeAccederRuta("MESA_ENTRADA", "/caja")).toBe(true);
    expect(rolPuedeAccederRuta("MESA_ENTRADA", "/caja/cierres/c1")).toBe(true);
    for (const rol of ["GERENTE", "PROFESOR", "ALUMNO"] as const) {
      expect(rolPuedeAccederRuta(rol, "/caja")).toBe(false);
      expect(rolPuedeAccederRuta(rol, "/caja/cierres/c1")).toBe(false);
    }
  });
  it("/cajas y su detalle: solo el Gerente", () => {
    expect(rolPuedeAccederRuta("GERENTE", "/cajas")).toBe(true);
    expect(rolPuedeAccederRuta("GERENTE", "/cajas/c1")).toBe(true);
    for (const rol of ["MESA_ENTRADA", "PROFESOR", "ALUMNO"] as const) {
      expect(rolPuedeAccederRuta(rol, "/cajas")).toBe(false);
      expect(rolPuedeAccederRuta(rol, "/cajas/c1")).toBe(false);
    }
  });
});
