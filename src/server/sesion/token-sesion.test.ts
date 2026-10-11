import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JWT } from "@auth/core/jwt";

// HU-A-06 (spec_modulo_A.md §2.6.2 y §3.13 punto 4): callbacks `jwt` y
// `session` de src/auth.ts. Se captura la configuración que recibe NextAuth
// para probar los callbacks sin levantar la librería.

const m = vi.hoisted(() => ({
  config: null as null | { callbacks: Record<string, (...args: never[]) => unknown> },
  obtenerEstadoCuenta: vi.fn(),
  getParametroNumerico: vi.fn(async (_clave: string, porDefecto: number) => porDefecto),
}));

vi.mock("next-auth", () => ({
  default: (config: typeof m.config) => {
    m.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
  CredentialsSignin: class extends Error {},
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (opciones: unknown) => opciones }));
vi.mock("@/server/sesion/autenticacion.service", () => ({ verificarCredenciales: vi.fn() }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: m.getParametroNumerico }));
vi.mock("@/server/usuarios/cuenta.service", () => ({ obtenerEstadoCuenta: m.obtenerEstadoCuenta }));

await import("@/auth");

type Jwt = (args: { token: JWT; user?: unknown; trigger?: string; session?: unknown }) => Promise<JWT>;
type Sesion = (args: { session: { user: Record<string, unknown>; expires?: string }; token: JWT }) => {
  user: Record<string, unknown>;
};
const jwt = () => m.config!.callbacks.jwt as unknown as Jwt;
const session = () => m.config!.callbacks.session as unknown as Sesion;

const USUARIO = "ckusuario0000000000000001";
const estadoCuenta = (debe: boolean) => ({ email: "a@b.local", rol: "PROFESOR", activa: true, debe_cambiar_password: debe });

/** Token vigente: emitido hace 10 minutos, vence en 20. */
function tokenVigente(extra: Partial<JWT> = {}): JWT {
  const ahora = Math.floor(Date.now() / 1000);
  return { id: USUARIO, rol: "PROFESOR", jti: "jti-1", iat_sesion: ahora - 600, iat: ahora - 600, exp: ahora + 1200, ...extra } as JWT;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("callback jwt, rama de ingreso", () => {
  it("copia la marca de la cuenta al token (true)", async () => {
    m.obtenerEstadoCuenta.mockResolvedValue(estadoCuenta(true));
    const token = await jwt()({ token: {} as JWT, user: { id: USUARIO, rol: "PROFESOR" } });
    expect(m.obtenerEstadoCuenta).toHaveBeenCalledWith(USUARIO);
    expect(token).toMatchObject({ id: USUARIO, rol: "PROFESOR", debeCambiarPassword: true });
    expect(typeof token.jti).toBe("string");
    expect(Math.floor(token.iat_sesion as number)).toBe(token.iat);
    expect(token.iat_sesion).toBeGreaterThanOrEqual(token.iat as number);
  });

  it("una cuenta sin la marca deja el claim en false", async () => {
    m.obtenerEstadoCuenta.mockResolvedValue(estadoCuenta(false));
    const token = await jwt()({ token: {} as JWT, user: { id: USUARIO, rol: "PROFESOR" } });
    expect(token.debeCambiarPassword).toBe(false);
  });

  it("si la cuenta no se encuentra, el claim queda en false (el servidor decide con la base)", async () => {
    m.obtenerEstadoCuenta.mockResolvedValue(null);
    const token = await jwt()({ token: {} as JWT, user: { id: USUARIO, rol: "PROFESOR" } });
    expect(token.debeCambiarPassword).toBe(false);
  });
});

describe("callback jwt, renovación y rama update", () => {
  it("la renovación no vuelve a leer la cuenta ni cambia la marca ni iat_sesion", async () => {
    const entrada = tokenVigente({ debeCambiarPassword: true, iat_sesion: Date.now() / 1000 - 600.125 });
    const { iat_sesion } = entrada;
    const token = await jwt()({ token: entrada });
    expect(m.obtenerEstadoCuenta).not.toHaveBeenCalled();
    expect(token.debeCambiarPassword).toBe(true);
    expect(token.iat_sesion).toBe(iat_sesion);
  });

  it("un update del cliente con otro iat_sesion y sin la marca no cambia el token", async () => {
    const entrada = tokenVigente({ debeCambiarPassword: true });
    const { iat_sesion, jti, id, rol } = entrada;
    const token = await jwt()({
      token: entrada,
      trigger: "update",
      session: { iat_sesion: iat_sesion + 3600, debeCambiarPassword: false, user: { debeCambiarPassword: false }, id: "otro", rol: "GERENTE" },
    });
    expect(token).toMatchObject({ iat_sesion, jti, id, rol, debeCambiarPassword: true });
    expect(m.obtenerEstadoCuenta).not.toHaveBeenCalled();
  });

  it("un update del cliente no agrega la marca a un token que no la tenía", async () => {
    const entrada = tokenVigente();
    const token = await jwt()({ token: entrada, trigger: "update", session: { debeCambiarPassword: true } });
    expect(token.debeCambiarPassword).toBeUndefined();
    expect(token.iat_sesion).toBe(entrada.iat_sesion);
  });
});

describe("callback session", () => {
  const base = () => ({ user: {} as Record<string, unknown>, expires: "" });

  it("expone la marca como booleano", () => {
    expect(session()({ session: base(), token: tokenVigente({ debeCambiarPassword: true }) }).user).toMatchObject({
      id: USUARIO,
      rol: "PROFESOR",
      debeCambiarPassword: true,
    });
  });

  it("un token sin el claim vale false", () => {
    expect(session()({ session: base(), token: tokenVigente() }).user.debeCambiarPassword).toBe(false);
  });

  it("no expone jti ni iat_sesion", () => {
    const { user } = session()({ session: base(), token: tokenVigente({ debeCambiarPassword: false }) });
    expect(user).not.toHaveProperty("jti");
    expect(user).not.toHaveProperty("iat_sesion");
  });
});
