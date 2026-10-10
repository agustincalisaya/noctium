import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// HU-A-06 criterio 5 (spec_modulo_A.md §2.6.4): la tarjeta «Cuenta de acceso»
// en sus cuatro estados. Navbar se simula solo para no cargar la sesión;
// ROL_LEGIBLE es el mismo mapa.
vi.mock("@/components/layout/Navbar", () => ({
  ROL_LEGIBLE: { MESA_ENTRADA: "Mesa de entrada", PROFESOR: "Profesor", GERENTE: "Gerente", ALUMNO: "Alumno" },
}));

const { CuentaAccesoCard } = await import("@/components/shared/cuenta-acceso-card");

const NOTA = "La cuenta se crea al registrar la ficha: el usuario es el email y la contraseña inicial es el DNI, que se cambia obligatoriamente en el primer ingreso.";
const ver = (cuenta: Parameters<typeof CuentaAccesoCard>[0]["cuenta"]) => renderToStaticMarkup(<CuentaAccesoCard cuenta={cuenta} />);

describe("CuentaAccesoCard", () => {
  it("activa con la marca: «Activa · debe cambiar la contraseña», rol y usuario", () => {
    const html = ver({ estado: "ACTIVA", email: "ana@noctium.local", rol: "PROFESOR", debe_cambiar_password: true });
    expect(html).toContain("Cuenta de acceso");
    expect(html).toContain("Activa · debe cambiar la contraseña");
    expect(html).toContain("bg-warning");
    expect(html).toContain("Profesor");
    expect(html).toContain("ana@noctium.local");
    expect(html).toContain(NOTA);
  });

  it("activa sin la marca: «Activa»", () => {
    const html = ver({ estado: "ACTIVA", email: "ana@noctium.local", rol: "ALUMNO", debe_cambiar_password: false });
    expect(html).toContain(">Activa<");
    expect(html).not.toContain("debe cambiar");
    expect(html).toContain("Alumno");
  });

  it("inactiva: «Inactiva», con rol y usuario", () => {
    const html = ver({ estado: "INACTIVA", email: "ana@noctium.local", rol: "ALUMNO", debe_cambiar_password: true });
    expect(html).toContain(">Inactiva<");
    expect(html).toContain("ana@noctium.local");
  });

  it("sin cuenta: «Sin cuenta», sin rol ni usuario", () => {
    const html = ver({ estado: "SIN_CUENTA", email: null, rol: null, debe_cambiar_password: false });
    expect(html).toContain("Sin cuenta");
    expect(html).not.toContain("Rol");
    expect(html).not.toContain("Usuario (email)");
  });

  it("nunca muestra datos sensibles aunque lleguen por error", () => {
    const html = ver({ estado: "ACTIVA", email: "ana@noctium.local", rol: "ALUMNO", debe_cambiar_password: false, ...({ hash: "$2b$12$x", dni: "30111222" } as object) });
    expect(html).not.toContain("$2b$12$x");
    expect(html).not.toContain("30111222");
  });
});
