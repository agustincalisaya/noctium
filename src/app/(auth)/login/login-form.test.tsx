import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// HU-A-05 criterio 1: el login ofrece «¿Olvidaste tu contraseña?». Es el único
// cambio de la pantalla de acceso para esa HU.

vi.mock("@/server/sesion/actions", () => ({ iniciarSesion: vi.fn() }));

const { LoginForm } = await import("./login-form");

describe("LoginForm", () => {
  it("enlaza a /recuperar-contrasena", () => {
    const html = renderToStaticMarkup(<LoginForm />);
    expect(html).toMatch(/<a [^>]*href="\/recuperar-contrasena"[^>]*>¿Olvidaste tu contraseña\?<\/a>/);
  });

  it("conserva «Crear cuenta» y el botón de ingreso", () => {
    const html = renderToStaticMarkup(<LoginForm />);
    expect(html).toContain('href="/registro"');
    expect(html).toContain("Iniciar sesión");
  });
});
