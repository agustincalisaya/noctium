import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// HU-A-05 (spec_modulo_A.md §2.7.2 y §2.7.6): la página del enlace. Con un
// token ausente o con largo fuera de 20 a 200 no consulta la base; si no, lo
// decide `verificarEnlaceRecuperacion` (simulado), que no consume el enlace.

const m = vi.hoisted(() => ({ verificar: vi.fn() }));
vi.mock("@/server/sesion/recuperacion.service", () => ({ verificarEnlaceRecuperacion: m.verificar }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));
vi.mock("@/server/sesion/actions", () => ({ restablecerPassword: vi.fn() }));

const { default: RestablecerContrasenaPage } = await import("./page");

const TOKEN = "t".repeat(43);
const pagina = async (token?: string | string[]) =>
  renderToStaticMarkup(await RestablecerContrasenaPage({ searchParams: Promise.resolve(token === undefined ? {} : { token }) }));
const MENSAJE = "El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?";

beforeEach(() => {
  vi.clearAllMocks();
  m.verificar.mockResolvedValue(true);
});

describe("/restablecer-contrasena", () => {
  it("enlace vigente: el formulario con el token y la marca", async () => {
    const html = await pagina(TOKEN);
    expect(m.verificar).toHaveBeenCalledExactlyOnceWith(TOKEN);
    expect(html).toContain("Noctium");
    expect(html).toContain("Definí una contraseña nueva");
    expect(html).toContain('name="password_nueva"');
    expect(html).toContain(`value="${TOKEN}"`);
    expect(html).not.toContain(MENSAJE);
  });

  it("enlace vencido, usado o inexistente: el mensaje y el acceso a pedir otro, sin formulario", async () => {
    m.verificar.mockResolvedValue(false);
    const html = await pagina(TOKEN);
    expect(html).toContain(MENSAJE);
    expect(html).toContain('href="/recuperar-contrasena"');
    expect(html).not.toContain("<form");
  });

  it.each([
    ["ausente", undefined],
    ["corto", "x".repeat(19)],
    ["largo", "x".repeat(201)],
    ["repetido en la URL", [TOKEN, TOKEN]],
  ])("token %s: inválido sin consultar la base", async (_caso, token) => {
    const html = await pagina(token);
    expect(m.verificar).not.toHaveBeenCalled();
    expect(html).toContain(MENSAJE);
    expect(html).not.toContain("<form");
  });
});
