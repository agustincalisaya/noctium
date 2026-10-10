import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// HU-A-06 (spec_modulo_A.md §3.6, §3.7 y §3.13 punto 2): los cinco pasos de
// withPermission/verificarPermiso/exigirPermiso, con `prisma`, la sesión y la
// cookie mockeadas. El orden se verifica con el registro de llamadas.

const m = vi.hoisted(() => ({
  orden: [] as string[],
  sesion: { actual: null as unknown },
  token: { actual: null as unknown },
  tokenRevocado: vi.fn(),
  usuario: vi.fn(),
  rolPermiso: vi.fn(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (nombre: string) => (nombre === "authjs.session-token" ? { value: "token-crudo" } : undefined) }),
}));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/auth", () => ({
  auth: (arg?: unknown) =>
    typeof arg === "function"
      ? (req: NextRequest, ctx: unknown) => (arg as (r: unknown, c: unknown) => unknown)(Object.assign(req, { auth: m.sesion.actual }), ctx)
      : Promise.resolve(m.sesion.actual),
  decodificarToken: async () => m.token.actual,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tokenRevocado: { findUnique: (...a: unknown[]) => (m.orden.push("jti"), m.tokenRevocado(...a)) },
    usuario: { findUnique: (...a: unknown[]) => (m.orden.push("cuenta"), m.usuario(...a)) },
    rolPermiso: { findUnique: (...a: unknown[]) => (m.orden.push("rol"), m.rolPermiso(...a)) },
  },
}));

const { withPermission, verificarPermiso, exigirPermiso, tienePermiso, PermisoError } = await import(
  "@/server/shared/with-permission"
);

const USUARIO = "ckusuario0000000000000001";
const IAT_SESION = 1_800_000_000;
const SESION_INVALIDA = { code: "SESION_INVALIDA", message: "Tu sesión expiró. Iniciá sesión nuevamente" };
const SIN_PERMISO = { code: "SIN_PERMISO", message: "No tenés permisos para acceder a esta sección" };
const DEBE_CAMBIAR = { code: "DEBE_CAMBIAR_PASSWORD", message: "Tenés que cambiar tu contraseña para seguir" };

/** Cuenta de Sprint 1 y 2: activa, sin marca y sin revocación por cuenta. */
const CUENTA_COMUN = { activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false };

const handler = vi.fn(async () => Response.json({ data: { ok: true }, error: null }));

async function llamar(accion: string) {
  const ruta = withPermission(accion, handler);
  const respuesta = await (ruta as unknown as (req: NextRequest, ctx: unknown) => Promise<Response>)(
    new NextRequest("http://localhost/api/prueba"),
    { params: Promise.resolve({}) },
  );
  return { status: respuesta.status, cache: respuesta.headers.get("Cache-Control"), cuerpo: await respuesta.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.orden.length = 0;
  m.sesion.actual = { user: { id: USUARIO, rol: "MESA_ENTRADA" } };
  m.token.actual = { jti: "jti-1", iat_sesion: IAT_SESION };
  m.tokenRevocado.mockResolvedValue(null);
  m.usuario.mockResolvedValue(CUENTA_COMUN);
  m.rolPermiso.mockResolvedValue({ accionPermiso: "x" });
});

describe("withPermission: cuenta sin marca ni revocación (idéntico a Sprint 2)", () => {
  it("con permiso → ejecuta el handler, con Cache-Control no-store", async () => {
    const r = await llamar("alumnos:leer");
    expect(r).toEqual({ status: 200, cache: "no-store, must-revalidate", cuerpo: { data: { ok: true }, error: null } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("sin permiso del rol → 403 SIN_PERMISO, sin ejecutar el handler", async () => {
    m.rolPermiso.mockResolvedValue(null);
    const r = await llamar("alumnos:leer");
    expect(r).toEqual({ status: 403, cache: "no-store, must-revalidate", cuerpo: { data: null, error: SIN_PERMISO } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("sin sesión → 401 SESION_INVALIDA, sin consultar la base", async () => {
    m.sesion.actual = null;
    const r = await llamar("alumnos:leer");
    expect(r).toEqual({ status: 401, cache: "no-store, must-revalidate", cuerpo: { data: null, error: SESION_INVALIDA } });
    expect(m.orden).toEqual([]);
  });

  it("jti revocado → 401 SESION_INVALIDA", async () => {
    m.tokenRevocado.mockResolvedValue({ jti: "jti-1" });
    const r = await llamar("alumnos:leer");
    expect(r.status).toBe(401);
    expect(r.cuerpo.error).toEqual(SESION_INVALIDA);
  });

  it("lee la cuenta por clave primaria, solo con los tres campos de control (nunca el hash)", async () => {
    await llamar("alumnos:leer");
    expect(m.usuario).toHaveBeenCalledWith({
      where: { idUsuario: USUARIO },
      select: { activoUsuario: true, sesionesValidasDesdeUsuario: true, debeCambiarPasswordUsuario: true },
    });
  });

  it("un token sin iat_sesion sigue valiendo si la cuenta nunca fue revocada", async () => {
    m.token.actual = { jti: "jti-1" };
    expect((await llamar("alumnos:leer")).status).toBe(200);
  });
});

describe("withPermission: estado de la cuenta (paso 3)", () => {
  it("cuenta inactiva → 401 SESION_INVALIDA con el mismo texto que un token vencido", async () => {
    m.usuario.mockResolvedValue({ ...CUENTA_COMUN, activoUsuario: false });
    const r = await llamar("alumnos:leer");
    expect(r).toEqual({ status: 401, cache: "no-store, must-revalidate", cuerpo: { data: null, error: SESION_INVALIDA } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("cuenta inexistente → 401 SESION_INVALIDA", async () => {
    m.usuario.mockResolvedValue(null);
    expect((await llamar("alumnos:leer")).cuerpo.error).toEqual(SESION_INVALIDA);
  });

  it("iat_sesion anterior a sesionesValidasDesde → 401 SESION_INVALIDA", async () => {
    m.usuario.mockResolvedValue({ ...CUENTA_COMUN, sesionesValidasDesdeUsuario: new Date((IAT_SESION + 1) * 1000) });
    const r = await llamar("alumnos:leer");
    expect(r.status).toBe(401);
    expect(r.cuerpo.error).toEqual(SESION_INVALIDA);
  });

  it("iat_sesion igual a sesionesValidasDesde (la sesión reemitida) → pasa: la comparación es estricta", async () => {
    m.usuario.mockResolvedValue({ ...CUENTA_COMUN, sesionesValidasDesdeUsuario: new Date(IAT_SESION * 1000) });
    expect((await llamar("alumnos:leer")).status).toBe(200);
  });

  it("iat_sesion posterior a sesionesValidasDesde → pasa", async () => {
    m.usuario.mockResolvedValue({ ...CUENTA_COMUN, sesionesValidasDesdeUsuario: new Date((IAT_SESION - 60) * 1000) });
    expect((await llamar("alumnos:leer")).status).toBe(200);
  });

  it("token sin iat_sesion con la cuenta revocada → 401 (no hay forma de saber si es anterior)", async () => {
    m.token.actual = { jti: "jti-1" };
    m.usuario.mockResolvedValue({ ...CUENTA_COMUN, sesionesValidasDesdeUsuario: new Date((IAT_SESION - 60) * 1000) });
    expect((await llamar("alumnos:leer")).status).toBe(401);
  });
});

describe("withPermission: marca «Debe cambiar la contraseña» (paso 4)", () => {
  beforeEach(() => {
    m.usuario.mockResolvedValue({ ...CUENTA_COMUN, debeCambiarPasswordUsuario: true });
  });

  it.each(["sesion:ping", "cuenta:cambiar_password"])("%s pasa y sigue al permiso del rol", async (accion) => {
    expect((await llamar(accion)).status).toBe(200);
    expect(m.orden).toEqual(["jti", "cuenta", "rol"]);
  });

  it.each(["alumnos:leer", "turnos:crear", "pagos:crear"])("%s → 403 DEBE_CAMBIAR_PASSWORD, sin consultar el rol", async (accion) => {
    const r = await llamar(accion);
    expect(r).toEqual({ status: 403, cache: "no-store, must-revalidate", cuerpo: { data: null, error: DEBE_CAMBIAR } });
    expect(handler).not.toHaveBeenCalled();
    expect(m.rolPermiso).not.toHaveBeenCalled();
  });

  it("decide con la base, no con el token: un token con la marca y la base sin ella pasa", async () => {
    m.token.actual = { jti: "jti-1", iat_sesion: IAT_SESION, debeCambiarPassword: true };
    m.usuario.mockResolvedValue(CUENTA_COMUN);
    expect((await llamar("alumnos:leer")).status).toBe(200);
  });

  it("decide con la base, no con el token: un token sin la marca y la base con ella → 403", async () => {
    m.token.actual = { jti: "jti-1", iat_sesion: IAT_SESION, debeCambiarPassword: false };
    expect((await llamar("alumnos:leer")).cuerpo.error).toEqual(DEBE_CAMBIAR);
  });
});

describe("withPermission: orden de los cinco pasos", () => {
  it("sin rechazos: jti → cuenta → rol", async () => {
    await llamar("alumnos:leer");
    expect(m.orden).toEqual(["jti", "cuenta", "rol"]);
  });

  it("jti revocado corta antes de leer la cuenta", async () => {
    m.tokenRevocado.mockResolvedValue({ jti: "jti-1" });
    await llamar("alumnos:leer");
    expect(m.orden).toEqual(["jti"]);
  });

  it("cuenta inactiva con la marca: gana el 401 del paso 3, sin llegar al rol", async () => {
    m.usuario.mockResolvedValue({ ...CUENTA_COMUN, activoUsuario: false, debeCambiarPasswordUsuario: true });
    expect((await llamar("alumnos:leer")).status).toBe(401);
    expect(m.orden).toEqual(["jti", "cuenta"]);
  });

  it("con la marca y sin permiso del rol: gana el 403 DEBE_CAMBIAR_PASSWORD del paso 4", async () => {
    m.usuario.mockResolvedValue({ ...CUENTA_COMUN, debeCambiarPasswordUsuario: true });
    m.rolPermiso.mockResolvedValue(null);
    expect((await llamar("alumnos:leer")).cuerpo.error).toEqual(DEBE_CAMBIAR);
  });
});

describe("verificarPermiso, exigirPermiso y tienePermiso", () => {
  it("verificarPermiso devuelve id y rol con una cuenta común", async () => {
    await expect(verificarPermiso("alumnos:leer")).resolves.toEqual({ id: USUARIO, rol: "MESA_ENTRADA" });
    expect(m.orden).toEqual(["jti", "cuenta", "rol"]);
  });

  it.each([
    ["cuenta inactiva", { ...CUENTA_COMUN, activoUsuario: false }, 401, "SESION_INVALIDA"],
    ["sesión revocada por cuenta", { ...CUENTA_COMUN, sesionesValidasDesdeUsuario: new Date((IAT_SESION + 1) * 1000) }, 401, "SESION_INVALIDA"],
    ["con la marca", { ...CUENTA_COMUN, debeCambiarPasswordUsuario: true }, 403, "DEBE_CAMBIAR_PASSWORD"],
  ])("verificarPermiso, %s → PermisoError %i %s", async (_caso, cuenta, status, code) => {
    m.usuario.mockResolvedValue(cuenta);
    const error = await verificarPermiso("alumnos:leer").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PermisoError);
    expect(error).toMatchObject({ status, code });
  });

  it("verificarPermiso con la marca admite cuenta:cambiar_password", async () => {
    m.usuario.mockResolvedValue({ ...CUENTA_COMUN, debeCambiarPasswordUsuario: true });
    await expect(verificarPermiso("cuenta:cambiar_password")).resolves.toEqual({ id: USUARIO, rol: "MESA_ENTRADA" });
  });

  it.each([
    ["con la marca", { ...CUENTA_COMUN, debeCambiarPasswordUsuario: true }, "/primer-ingreso"],
    ["cuenta inactiva", { ...CUENTA_COMUN, activoUsuario: false }, "/login"],
    ["sesión revocada por cuenta", { ...CUENTA_COMUN, sesionesValidasDesdeUsuario: new Date((IAT_SESION + 1) * 1000) }, "/login"],
  ])("exigirPermiso, %s → redirige a %s", async (_caso, cuenta, destino) => {
    m.usuario.mockResolvedValue(cuenta);
    await expect(exigirPermiso("alumnos:leer")).rejects.toThrow(`REDIRECT:${destino}`);
    expect(m.redirect).toHaveBeenCalledWith(destino);
  });

  it("exigirPermiso sin permiso del rol → /sin-permiso (como en Sprint 2)", async () => {
    m.rolPermiso.mockResolvedValue(null);
    await expect(exigirPermiso("alumnos:leer")).rejects.toThrow("REDIRECT:/sin-permiso");
  });

  it("exigirPermiso sin sesión → /login (como en Sprint 2)", async () => {
    m.sesion.actual = null;
    await expect(exigirPermiso("alumnos:leer")).rejects.toThrow("REDIRECT:/login");
  });

  it("tienePermiso con la marca → false para lo no admitido, true para cuenta:cambiar_password", async () => {
    m.usuario.mockResolvedValue({ ...CUENTA_COMUN, debeCambiarPasswordUsuario: true });
    await expect(tienePermiso("alumnos:leer")).resolves.toBe(false);
    await expect(tienePermiso("cuenta:cambiar_password")).resolves.toBe(true);
  });
});
