import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// HU-A-06 (spec_modulo_A.md §2.6.6): /primer-ingreso exige
// `cuenta:cambiar_password`; sin la marca —valor de la base— va a la pantalla
// inicial. También /mi-cuenta, que con la marca manda al primer ingreso.

const m = vi.hoisted(() => ({
  permiso: vi.fn(),
  estadoCuenta: vi.fn(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: m.redirect, useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/server/shared/with-permission", () => ({ exigirPermiso: m.permiso }));
vi.mock("@/server/usuarios/cuenta.service", () => ({ obtenerEstadoCuenta: m.estadoCuenta }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));
vi.mock("@/server/sesion/actions", () => ({ cambiarPasswordPropia: vi.fn() }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ setDirty: vi.fn() }) }));

const { default: PrimerIngresoPage } = await import("@/app/(primer-ingreso)/primer-ingreso/page");
const { default: MiCuentaPage } = await import("@/app/(dashboard)/mi-cuenta/page");

const cuenta = (marca: boolean) => ({ email: "ana@noctium.local", rol: "ALUMNO", activa: true, debe_cambiar_password: marca });

beforeEach(() => {
  vi.clearAllMocks();
  m.permiso.mockResolvedValue({ id: "usuario-sesion", rol: "ALUMNO" });
});

describe("/primer-ingreso", () => {
  it("con la marca: exige cuenta:cambiar_password y muestra el formulario sin contraseña actual", async () => {
    m.estadoCuenta.mockResolvedValue(cuenta(true));
    const html = renderToStaticMarkup(await PrimerIngresoPage());
    expect(m.permiso).toHaveBeenCalledExactlyOnceWith("cuenta:cambiar_password");
    expect(m.estadoCuenta).toHaveBeenCalledWith("usuario-sesion");
    expect(html).toContain("Primer ingreso");
    expect(html).toContain("Por seguridad, definí una contraseña nueva para seguir.");
    expect(html).toContain("Al menos 8 caracteres, con una mayúscula, una minúscula y un número.");
    expect(html).toContain("Guardar y seguir");
    expect(html).toContain('name="password_nueva"');
    expect(html).toContain('name="confirmacion"');
    expect(html).not.toContain('name="password_actual"');
  });

  it("sin la marca en la base → /home", async () => {
    m.estadoCuenta.mockResolvedValue(cuenta(false));
    await expect(PrimerIngresoPage()).rejects.toThrow("REDIRECT:/home");
  });

  it("la redirección de exigirPermiso se propaga (sin sesión, etc.)", async () => {
    m.permiso.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(PrimerIngresoPage()).rejects.toThrow("REDIRECT:/login");
    expect(m.estadoCuenta).not.toHaveBeenCalled();
  });
});

describe("/mi-cuenta", () => {
  it("sin la marca: formulario con contraseña actual, nueva y confirmación", async () => {
    m.estadoCuenta.mockResolvedValue(cuenta(false));
    const html = renderToStaticMarkup(await MiCuentaPage());
    expect(m.permiso).toHaveBeenCalledExactlyOnceWith("cuenta:cambiar_password");
    expect(html).toContain("Mi cuenta");
    expect(html).toContain('name="password_actual"');
    expect(html).toContain('name="password_nueva"');
    expect(html).toContain('name="confirmacion"');
  });

  it("con la marca en la base → /primer-ingreso", async () => {
    m.estadoCuenta.mockResolvedValue(cuenta(true));
    await expect(MiCuentaPage()).rejects.toThrow("REDIRECT:/primer-ingreso");
  });

  it("HU-A-05: ofrece «¿Olvidaste tu contraseña?» hacia /recuperar-contrasena", async () => {
    m.estadoCuenta.mockResolvedValue(cuenta(false));
    const html = renderToStaticMarkup(await MiCuentaPage());
    expect(html).toMatch(/<a [^>]*href="\/recuperar-contrasena"[^>]*>¿Olvidaste tu contraseña\?<\/a>/);
  });
});
