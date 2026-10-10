import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// HU-A-06 (spec_modulo_A.md §2.6.2 y DESIGN.md §6.4): /home es el destino del
// login. Con la marca —leída de la base— va al primer ingreso; con
// ?contrasena=actualizada muestra el banner de éxito.

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  estadoCuenta: vi.fn(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/server/usuarios/usuario.service", () => ({ obtenerNombreVisible: async () => "Ana Gómez" }));
vi.mock("@/server/usuarios/cuenta.service", () => ({ obtenerEstadoCuenta: m.estadoCuenta }));

const { default: HomePage } = await import("@/app/(dashboard)/home/page");

const BANNER = "Tu contraseña se actualizó. Ya podés usar el sistema.";
const cuenta = (marca: boolean) => ({ email: "ana@noctium.local", rol: "PROFESOR", activa: true, debe_cambiar_password: marca });
const ver = async (params: { contrasena?: string } = {}) => renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve(params) }));

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "usuario-sesion", rol: "PROFESOR", debeCambiarPassword: false } });
  m.estadoCuenta.mockResolvedValue(cuenta(false));
});

describe("/home y la marca «Debe cambiar la contraseña»", () => {
  it("con la marca en la base → /primer-ingreso", async () => {
    m.estadoCuenta.mockResolvedValue(cuenta(true));
    await expect(ver()).rejects.toThrow("REDIRECT:/primer-ingreso");
    expect(m.estadoCuenta).toHaveBeenCalledWith("usuario-sesion");
  });

  it("decide con la base: un token sin la marca no alcanza si la base la tiene", async () => {
    m.estadoCuenta.mockResolvedValue(cuenta(true));
    m.auth.mockResolvedValue({ user: { id: "usuario-sesion", rol: "PROFESOR", debeCambiarPassword: false } });
    await expect(ver()).rejects.toThrow("REDIRECT:/primer-ingreso");
  });

  it("sin la marca → muestra la pantalla de siempre, sin banner", async () => {
    const html = await ver();
    expect(html).toContain("Ana Gómez");
    expect(html).toContain("Profesor");
    expect(html).not.toContain(BANNER);
  });

  it("con ?contrasena=actualizada → banner de éxito", async () => {
    const html = await ver({ contrasena: "actualizada" });
    expect(html).toContain(BANNER);
    expect(html).toContain('role="status"');
  });

  it("sin sesión → /login, como hasta ahora", async () => {
    m.auth.mockResolvedValue(null);
    await expect(ver()).rejects.toThrow("REDIRECT:/login");
  });
});
