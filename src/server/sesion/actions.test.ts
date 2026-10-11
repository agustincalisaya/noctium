import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import {
  ESTADO_INICIAL,
  ESTADO_INICIAL_CAMBIO_PASSWORD,
  ESTADO_INICIAL_RESTABLECER_PASSWORD,
  ESTADO_INICIAL_SOLICITUD_RECUPERACION,
} from "@/types/sesion.types";

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
    after: vi.fn(),
    solicitarRecuperacion: vi.fn(),
    procesarSolicitud: vi.fn(),
    restablecerPassword: vi.fn(),
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
// HU-A-05: el servicio de recuperación y `after()` (el callback se ejecuta a mano).
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: m.after }));
vi.mock("@/server/sesion/recuperacion.service", () => ({
  solicitarRecuperacion: m.solicitarRecuperacion,
  procesarSolicitudRecuperacion: m.procesarSolicitud,
  restablecerPassword: m.restablecerPassword,
}));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));

const { cambiarPasswordPropia, iniciarSesion, restablecerPassword, solicitarRecuperacion } = await import("@/server/sesion/actions");

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
  m.solicitarRecuperacion.mockResolvedValue({ entro: true });
  m.procesarSolicitud.mockResolvedValue(undefined);
  m.restablecerPassword.mockResolvedValue({ restablecida: true });
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

// HU-A-05 (spec_modulo_A.md §2.7.1 y §2.7.3): las dos Server Actions de la
// recuperación, capa delgada sobre el mismo servicio que los Route Handlers.

describe("solicitarRecuperacion (Server Action)", () => {
  const pedir = (email: string) => solicitarRecuperacion(ESTADO_INICIAL_SOLICITUD_RECUPERACION, formulario({ email }));

  it("entró: «enviada», con el email normalizado y la IP; el procesamiento corre después con after()", async () => {
    await expect(pedir(" Ana@Noctium.Local ")).resolves.toEqual({ status: "enviada" });
    expect(m.solicitarRecuperacion).toHaveBeenCalledWith(EMAIL, "10.9.8.7");
    expect(m.procesarSolicitud).not.toHaveBeenCalled();
    expect(m.after).toHaveBeenCalledTimes(1);
    await (m.after.mock.calls[0]![0] as () => Promise<void>)();
    expect(m.procesarSolicitud).toHaveBeenCalledWith(EMAIL, "10.9.8.7");
  });

  it("limitada: la misma respuesta y no programa nada", async () => {
    m.solicitarRecuperacion.mockResolvedValue({ entro: false });
    await expect(pedir(EMAIL)).resolves.toEqual({ status: "enviada" });
    expect(m.after).not.toHaveBeenCalled();
  });

  it("una excepción en la tarea programada se registra y no se propaga", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.procesarSolicitud.mockRejectedValue(new Error(`fallo con ${EMAIL}`));
    await pedir(EMAIL);
    await expect((m.after.mock.calls[0]![0] as () => Promise<void>)()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain(EMAIL);
    log.mockRestore();
  });

  it("formato inválido: error del campo con el texto de la pantalla, sin servicio", async () => {
    await expect(pedir("ana@")).resolves.toEqual({
      status: "error_validacion",
      errores: { email: ["Ingresá un email válido, por ejemplo nombre@dominio.com."] },
    });
    expect(m.solicitarRecuperacion).not.toHaveBeenCalled();
  });

  it("bloqueo agotado → el mensaje de transacción ocupada", async () => {
    m.solicitarRecuperacion.mockRejectedValue(new ErrorDeDominio("errores.transaccion.ocupada"));
    await expect(pedir(EMAIL)).resolves.toEqual({ status: "error", mensaje: "Otra persona está modificando estos datos. Intentá de nuevo." });
    expect(m.after).not.toHaveBeenCalled();
  });

  it("error inesperado: sin detalles técnicos", async () => {
    m.solicitarRecuperacion.mockRejectedValue(new Error("connection refused"));
    await expect(pedir(EMAIL)).resolves.toEqual({ status: "error", mensaje: "No se pudo conectar. Intentá nuevamente" });
  });
});

describe("restablecerPassword (Server Action)", () => {
  const TOKEN = "t".repeat(43);
  const restablecer = (extra: Record<string, string> = {}) =>
    restablecerPassword(ESTADO_INICIAL_RESTABLECER_PASSWORD, formulario({ token: TOKEN, password_nueva: NUEVA, confirmacion: NUEVA, ...extra }));

  it("éxito: llama al servicio con la IP y no reemite la sesión", async () => {
    await expect(restablecer()).resolves.toEqual({ status: "exito" });
    expect(m.restablecerPassword).toHaveBeenCalledWith({ token: TOKEN, password_nueva: NUEVA, confirmacion: NUEVA }, "10.9.8.7");
    expect(m.signIn).not.toHaveBeenCalled();
    expect(m.verificarPermiso).not.toHaveBeenCalled();
  });

  it("Zod: política y confirmación como errores de campo, sin servicio", async () => {
    const estado = await restablecer({ password_nueva: "corta", confirmacion: "otra" });
    expect(estado.status).toBe("error_validacion");
    if (estado.status !== "error_validacion") return;
    expect(estado.errores.password_nueva?.length).toBeGreaterThan(0);
    expect(estado.errores.confirmacion).toEqual(["Las contraseñas no coinciden"]);
    expect(m.restablecerPassword).not.toHaveBeenCalled();
  });

  it("token con largo inválido → enlace inválido, sin servicio", async () => {
    await expect(restablecer({ token: "abc" })).resolves.toEqual({
      status: "enlace_invalido",
      mensaje: "El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?",
    });
    expect(m.restablecerPassword).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.sesion.enlaceInvalido", { status: "enlace_invalido", mensaje: "El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?" }],
    ["errores.sesion.passwordIgualAnterior", { status: "error_validacion", errores: { password_nueva: ["La contraseña nueva no puede ser igual a la anterior"] } }],
    ["errores.transaccion.ocupada", { status: "error", mensaje: "Otra persona está modificando estos datos. Intentá de nuevo." }],
  ] as const)("mapea %s", async (codigo, esperado) => {
    m.restablecerPassword.mockRejectedValue(new ErrorDeDominio(codigo));
    await expect(restablecer()).resolves.toEqual(esperado);
  });

  it("error inesperado: sin detalles técnicos ni el token", async () => {
    m.restablecerPassword.mockRejectedValue(new Error(`fallo con ${TOKEN}`));
    const estado = await restablecer();
    expect(estado).toEqual({ status: "error", mensaje: "No se pudo conectar. Intentá nuevamente" });
    expect(JSON.stringify(estado)).not.toContain(TOKEN);
  });
});
