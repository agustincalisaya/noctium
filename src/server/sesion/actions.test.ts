import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ESTADO_INICIAL, ESTADO_INICIAL_CAMBIO_PASSWORD } from "@/types/sesion.types";

// HU-A-06: Server Actions de sesión (spec_modulo_A.md §2.6.2 y §2.6.3).
// `iniciarSesion` redirige según la marca; `cambiarPasswordPropia` es capa
// delgada: permiso, Zod, servicio y reemisión de la sesión con `signIn`.

const m = vi.hoisted(() => {
  class PermisoError extends Error {
    constructor(public readonly status: number, public readonly code: string, message: string) {
      super(message);
    }
  }
  return {
    PermisoError,
    auth: vi.fn(),
    signIn: vi.fn(),
    verificarPermiso: vi.fn(),
    servicio: vi.fn(),
    estadoCuenta: vi.fn(),
    redirect: vi.fn((destino: string) => {
      throw new Error(`REDIRECT:${destino}`);
    }),
  };
});

vi.mock("next-auth", () => ({ CredentialsSignin: class extends Error { code = "" } }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "10.9.8.7, 10.0.0.1" }) }));
vi.mock("@/auth", () => ({
  auth: m.auth,
  signIn: m.signIn,
  obtenerIp: (req: Request) => req.headers.get("x-forwarded-for")!.split(",")[0]!.trim(),
}));
vi.mock("@/server/shared/with-permission", () => ({ verificarPermiso: m.verificarPermiso, PermisoError: m.PermisoError }));
vi.mock("@/server/sesion/cambio-password.service", () => ({ cambiarPasswordPropia: m.servicio }));
vi.mock("@/server/usuarios/cuenta.service", () => ({ obtenerEstadoCuenta: m.estadoCuenta }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));

const { cambiarPasswordPropia, iniciarSesion } = await import("@/server/sesion/actions");

const USUARIO = "ckusuario0000000000000001";
const EMAIL = "ana@noctium.local";
const NUEVA = "NuevaClave1";

function formulario(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [clave, valor] of Object.entries(campos)) fd.set(clave, valor);
  return fd;
}
const cambio = (extra: Record<string, string> = {}) => formulario({ password_nueva: NUEVA, confirmacion: NUEVA, ...extra });
const cuenta = (marca: boolean) => ({ email: EMAIL, rol: "PROFESOR", activa: true, debe_cambiar_password: marca });

beforeEach(() => {
  vi.clearAllMocks();
  m.verificarPermiso.mockResolvedValue({ id: USUARIO, rol: "PROFESOR" });
  m.estadoCuenta.mockResolvedValue(cuenta(true));
  m.servicio.mockResolvedValue({ reemitir_sesion: true });
  m.signIn.mockResolvedValue(undefined);
});

describe("cambiarPasswordPropia (Server Action)", () => {
  it("verifica cuenta:cambiar_password y pasa al servicio la cuenta de la sesión y la IP", async () => {
    await cambiarPasswordPropia(ESTADO_INICIAL_CAMBIO_PASSWORD, cambio());
    expect(m.verificarPermiso).toHaveBeenCalledExactlyOnceWith("cuenta:cambiar_password");
    expect(m.servicio).toHaveBeenCalledWith({ password_nueva: NUEVA, confirmacion: NUEVA }, USUARIO, "10.9.8.7");
  });

  it("éxito: reemite la sesión con signIn y la contraseña nueva, desde el servidor", async () => {
    await expect(cambiarPasswordPropia(ESTADO_INICIAL_CAMBIO_PASSWORD, cambio())).resolves.toEqual({
      status: "exito",
      sesion_conservada: true,
    });
    expect(m.signIn).toHaveBeenCalledWith("credentials", { email: EMAIL, password: NUEVA, redirect: false });
  });

  it("reemisión fallida: el cambio ya está hecho → sesion_conservada: false", async () => {
    m.signIn.mockRejectedValue(new Error("RATE_LIMIT_EXCEDIDO"));
    await expect(cambiarPasswordPropia(ESTADO_INICIAL_CAMBIO_PASSWORD, cambio())).resolves.toEqual({
      status: "exito",
      sesion_conservada: false,
    });
  });

  it("sin permiso: devuelve el mensaje del permiso y no llama al servicio", async () => {
    m.verificarPermiso.mockRejectedValue(new m.PermisoError(401, "SESION_INVALIDA", "Tu sesión expiró. Iniciá sesión nuevamente"));
    await expect(cambiarPasswordPropia(ESTADO_INICIAL_CAMBIO_PASSWORD, cambio())).resolves.toEqual({
      status: "error",
      mensaje: "Tu sesión expiró. Iniciá sesión nuevamente",
    });
    expect(m.servicio).not.toHaveBeenCalled();
    expect(m.signIn).not.toHaveBeenCalled();
  });

  it("Zod: política y confirmación como errores de campo, sin llamar al servicio", async () => {
    const estado = await cambiarPasswordPropia(ESTADO_INICIAL_CAMBIO_PASSWORD, formulario({ password_nueva: "corta", confirmacion: "otra" }));
    expect(estado.status).toBe("error_validacion");
    if (estado.status !== "error_validacion") return;
    expect(estado.errores.password_nueva?.length).toBeGreaterThan(0);
    expect(estado.errores.confirmacion).toEqual(["Las contraseñas no coinciden"]);
    expect(m.servicio).not.toHaveBeenCalled();
  });

  it("una contraseña actual vacía del formulario cuenta como ausente", async () => {
    await cambiarPasswordPropia(ESTADO_INICIAL_CAMBIO_PASSWORD, cambio({ password_actual: "" }));
    expect(m.servicio.mock.calls[0]![0]).not.toHaveProperty("password_actual", "");
  });

  it.each([
    ["errores.cuenta.passwordActualIncorrecta", false, { password_actual: ["La contraseña actual no es correcta"] }],
    ["errores.cuenta.passwordIgualActual", false, { password_nueva: ["La contraseña nueva no puede ser igual a la actual"] }],
    ["errores.cuenta.passwordIgualActual", true, { password_nueva: ["La contraseña nueva no puede ser tu DNI"] }],
    ["errores.cuenta.datosInvalidos", false, { password_actual: ["Ingresá tu contraseña actual"] }],
  ] as const)("mapea %s (primer ingreso: %s) al campo", async (codigo, marca, errores) => {
    m.estadoCuenta.mockResolvedValue(cuenta(marca));
    m.servicio.mockRejectedValue(new ErrorDeDominio(codigo));
    await expect(cambiarPasswordPropia(ESTADO_INICIAL_CAMBIO_PASSWORD, cambio())).resolves.toEqual({ status: "error_validacion", errores });
    expect(m.signIn).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.sesion.rateLimitExcedido", "Demasiados intentos. Esperá unos minutos e intentá nuevamente"],
    ["errores.transaccion.ocupada", "Otra persona está modificando estos datos. Intentá de nuevo."],
  ] as const)("mapea %s a un error general", async (codigo, mensaje) => {
    m.servicio.mockRejectedValue(new ErrorDeDominio(codigo));
    await expect(cambiarPasswordPropia(ESTADO_INICIAL_CAMBIO_PASSWORD, cambio())).resolves.toEqual({ status: "error", mensaje });
  });

  it("un error inesperado no expone detalles técnicos", async () => {
    m.servicio.mockRejectedValue(new Error("connection refused at 10.0.0.1"));
    await expect(cambiarPasswordPropia(ESTADO_INICIAL_CAMBIO_PASSWORD, cambio())).resolves.toEqual({
      status: "error",
      mensaje: "No se pudo conectar. Intentá nuevamente",
    });
  });
});

describe("iniciarSesion: destino según la marca", () => {
  const login = () => iniciarSesion(ESTADO_INICIAL, formulario({ email: EMAIL, password: "3011122" }));

  it("con la marca → /primer-ingreso", async () => {
    m.auth.mockResolvedValue({ user: { id: USUARIO, rol: "PROFESOR", debeCambiarPassword: true } });
    await expect(login()).rejects.toThrow("REDIRECT:/primer-ingreso");
  });

  it("sin la marca → /home, como hasta ahora", async () => {
    m.auth.mockResolvedValue({ user: { id: USUARIO, rol: "PROFESOR", debeCambiarPassword: false } });
    await expect(login()).rejects.toThrow("REDIRECT:/home");
  });

  it("una sesión sin el claim (token anterior) → /home", async () => {
    m.auth.mockResolvedValue({ user: { id: USUARIO, rol: "PROFESOR" } });
    await expect(login()).rejects.toThrow("REDIRECT:/home");
  });

  it("acepta un DNI de 7 dígitos como contraseña (el login no aplica la política)", async () => {
    m.auth.mockResolvedValue({ user: { id: USUARIO, rol: "PROFESOR", debeCambiarPassword: true } });
    await expect(login()).rejects.toThrow("REDIRECT:/primer-ingreso");
    expect(m.signIn).toHaveBeenCalledWith("credentials", { email: EMAIL, password: "3011122", redirect: false });
  });
});
