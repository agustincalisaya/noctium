import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// HU-A-05 (spec_modulo_A.md §2.7.3): POST /api/auth/restablecer-password con
// el servicio simulado. No inicia sesión: la ruta no usa signIn.

const m = vi.hoisted(() => ({ restablecer: vi.fn(), signIn: vi.fn(), longitud: vi.fn() }));

vi.mock("@/auth", () => ({
  obtenerIp: (req: Request) => req.headers.get("x-forwarded-for")!.split(",")[0]!.trim(),
  signIn: m.signIn,
}));
vi.mock("@/server/sesion/recuperacion.service", () => ({ restablecerPassword: m.restablecer }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: (...a: unknown[]) => m.longitud(...a) }));

const { POST } = await import("./route");

const IP = "10.2.3.4";
const TOKEN = "Tk_".repeat(14) + "x"; // 43 caracteres, como un valor base64url de 32 bytes
const NUEVA = "NuevaClave1";
const SIN_CACHE = "no-store, must-revalidate";

async function restablecer(body: unknown) {
  const respuesta = await POST(
    new NextRequest("http://localhost/api/auth/restablecer-password", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", "x-forwarded-for": `${IP}, 10.0.0.1` },
    }),
  );
  const texto = await respuesta.text();
  return { status: respuesta.status, cache: respuesta.headers.get("Cache-Control"), texto, cuerpo: JSON.parse(texto) };
}

const datos = (extra: Record<string, unknown> = {}) => ({ token: TOKEN, password_nueva: NUEVA, confirmacion: NUEVA, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  m.restablecer.mockResolvedValue({ restablecida: true });
  m.longitud.mockImplementation(async (_clave: string, porDefecto: number) => porDefecto);
});

describe("POST /api/auth/restablecer-password", () => {
  it("200 con { restablecida: true }, no-store, sin iniciar sesión", async () => {
    const { status, cache, cuerpo } = await restablecer(datos());
    expect({ status, cache, cuerpo }).toEqual({ status: 200, cache: SIN_CACHE, cuerpo: { data: { restablecida: true }, error: null } });
    expect(m.restablecer).toHaveBeenCalledWith({ token: TOKEN, password_nueva: NUEVA, confirmacion: NUEVA }, IP);
    expect(m.signIn).not.toHaveBeenCalled();
  });

  it("toma la longitud mínima de password_longitud_minima", async () => {
    m.longitud.mockResolvedValue(12);
    const { status, cuerpo } = await restablecer(datos());
    expect(m.longitud).toHaveBeenCalledWith("password_longitud_minima", 8);
    expect(status).toBe(400);
    expect(cuerpo.error.detalles.password_nueva).toContain("La contraseña debe tener al menos 12 caracteres");
  });

  it.each([
    ["política", { password_nueva: "corta", confirmacion: "corta" }, "password_nueva"],
    ["confirmación distinta", { confirmacion: "OtraClave1" }, "confirmacion"],
    ["token corto", { token: "abc" }, "token"],
  ])("%s → 400 VALIDATION_ERROR por campo, sin llamar al servicio", async (_caso, extra, campo) => {
    const { status, cache, cuerpo } = await restablecer(datos(extra));
    expect({ status, cache }).toEqual({ status: 400, cache: SIN_CACHE });
    expect(cuerpo.error.code).toBe("VALIDATION_ERROR");
    expect(cuerpo.error.detalles[campo].length).toBeGreaterThan(0);
    expect(m.restablecer).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.sesion.enlaceInvalido", 410, "ENLACE_INVALIDO", "El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?"],
    ["errores.sesion.passwordIgualAnterior", 422, "PASSWORD_IGUAL_A_ACTUAL", "La contraseña nueva no puede ser igual a la anterior"],
    ["errores.transaccion.ocupada", 409, "TRANSACCION_OCUPADA", "Otra persona está modificando estos datos. Intentá de nuevo."],
  ] as const)("%s → %i %s", async (clave, status, code, message) => {
    m.restablecer.mockRejectedValue(new ErrorDeDominio(clave));
    const respuesta = await restablecer(datos());
    expect({ status: respuesta.status, cache: respuesta.cache, cuerpo: respuesta.cuerpo }).toEqual({
      status,
      cache: SIN_CACHE,
      cuerpo: { data: null, error: { code, message } },
    });
  });

  it("error inesperado → 500 sin detalles técnicos", async () => {
    m.restablecer.mockRejectedValue(new Error(`fallo con ${TOKEN}`));
    const { status, cache, texto } = await restablecer(datos());
    expect({ status, cache }).toEqual({ status: 500, cache: SIN_CACHE });
    expect(texto).not.toContain("fallo");
  });

  it("ninguna respuesta contiene el token ni la contraseña", async () => {
    const respuestas = [await restablecer(datos()), await restablecer(datos({ confirmacion: "OtraClave1" }))];
    m.restablecer.mockRejectedValue(new ErrorDeDominio("errores.sesion.enlaceInvalido"));
    respuestas.push(await restablecer(datos()));
    m.restablecer.mockRejectedValue(new Error(`fallo con ${TOKEN}`));
    respuestas.push(await restablecer(datos()));
    for (const { texto } of respuestas) {
      expect(texto).not.toContain(TOKEN);
      expect(texto).not.toContain(NUEVA);
    }
  });
});
