import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/server/shared/service-error";

// HU-A-06 (spec_modulo_A.md §2.6.3): cambiarPasswordPropia con la
// persistencia mockeada. El orden de los pasos se verifica con el registro de
// llamadas; los casos con PostgreSQL real están en el .pg.test.ts.

const m = vi.hoisted(() => ({
  orden: [] as string[],
  cuenta: vi.fn(),
  bloqueada: vi.fn(),
  comparar: vi.fn(),
  rateLimit: vi.fn(),
  intentoFallido: vi.fn(),
  cambiarPassword: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { usuario: { findUnique: (...a: unknown[]) => (m.orden.push("cuenta"), m.cuenta(...a)) } },
}));
vi.mock("@/lib/password", () => ({
  comparePassword: (...a: unknown[]) => (m.orden.push(`comparar:${String(a[0])}`), m.comparar(...a)),
}));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));
vi.mock("@/server/sesion/autenticacion.service", () => ({
  verificarRateLimit: (...a: unknown[]) => (m.orden.push("rateLimit"), m.rateLimit(...a)),
  registrarIntentoFallido: (...a: unknown[]) => (m.orden.push("intentoFallido"), m.intentoFallido(...a)),
}));
vi.mock("@/server/usuarios/cuenta.service", () => ({
  cambiarPassword: (...a: unknown[]) => (m.orden.push("cambiarPassword"), m.cambiarPassword(...a)),
}));
vi.mock("@/server/shared/transaccion", () => ({
  transaccion: async (fn: (tx: unknown) => Promise<unknown>) => {
    m.orden.push("transaccion");
    return fn({ $queryRaw: (...a: unknown[]) => (m.orden.push("forUpdate"), m.bloqueada(...a)) });
  },
}));

const { cambiarPasswordPropia } = await import("@/server/sesion/cambio-password.service");

const USUARIO = "ckusuario0000000000000001";
const IP = "10.0.0.7";
const EMAIL = "ana@noctium.local";
const NUEVA = "NuevaClave1";
const CON_MARCA = { emailUsuario: EMAIL, passwordHashUsuario: "hash-dni", debeCambiarPasswordUsuario: true };
const SIN_MARCA = { emailUsuario: EMAIL, passwordHashUsuario: "hash-actual", debeCambiarPasswordUsuario: false };

const cambio = (extra: Record<string, unknown> = {}) => ({ password_nueva: NUEVA, confirmacion: NUEVA, ...extra });

async function capturar(promesa: Promise<unknown>): Promise<ServiceError> {
  try {
    await promesa;
  } catch (error) {
    return error as ServiceError;
  }
  throw new Error("Se esperaba un error");
}

beforeEach(() => {
  vi.clearAllMocks();
  m.orden.length = 0;
  m.rateLimit.mockResolvedValue(undefined);
  m.comparar.mockResolvedValue(false);
  m.bloqueada.mockResolvedValue([{ passwordHashUsuario: "hash-vigente" }]);
  m.cambiarPassword.mockResolvedValue({ reemitir_sesion: true });
});

describe("primer ingreso (cuenta con la marca)", () => {
  beforeEach(() => m.cuenta.mockResolvedValue(CON_MARCA));

  it("no pide la contraseña actual y cambia conservando la sesión actual", async () => {
    await expect(cambiarPasswordPropia(cambio(), USUARIO, IP)).resolves.toEqual({ reemitir_sesion: true });
    expect(m.orden).toEqual(["cuenta", "rateLimit", "transaccion", "forUpdate", `comparar:${NUEVA}`, "cambiarPassword"]);
    expect(m.cambiarPassword).toHaveBeenCalledWith(expect.anything(), {
      usuarioId: USUARIO,
      nueva: NUEVA,
      conservarSesionActual: true,
      ip: IP,
    });
  });

  it("nueva igual al hash vigente (el DNI) → 422 PASSWORD_IGUAL_A_ACTUAL, sin cambiar nada", async () => {
    m.comparar.mockResolvedValue(true);
    const error = await capturar(cambiarPasswordPropia(cambio(), USUARIO, IP));
    expect(error).toMatchObject({ code: "PASSWORD_IGUAL_A_ACTUAL", status: 422 });
    expect(m.cambiarPassword).not.toHaveBeenCalled();
  });

  it("compara contra el hash de la fila bloqueada, no contra la lectura previa", async () => {
    await cambiarPasswordPropia(cambio(), USUARIO, IP);
    expect(m.comparar).toHaveBeenCalledWith(NUEVA, "hash-vigente");
  });
});

describe("«Mi cuenta» (cuenta sin la marca)", () => {
  beforeEach(() => m.cuenta.mockResolvedValue(SIN_MARCA));

  it("exige la contraseña actual (400 VALIDATION_ERROR), sin compararla ni contarla como intento", async () => {
    const error = await capturar(cambiarPasswordPropia(cambio(), USUARIO, IP));
    expect(error).toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(m.intentoFallido).not.toHaveBeenCalled();
    expect(m.cambiarPassword).not.toHaveBeenCalled();
  });

  it("actual incorrecta → fila en IntentoLoginFallido y 422 PASSWORD_ACTUAL_INCORRECTA", async () => {
    const error = await capturar(cambiarPasswordPropia(cambio({ password_actual: "Otra1234" }), USUARIO, IP));
    expect(error).toMatchObject({ code: "PASSWORD_ACTUAL_INCORRECTA", status: 422, message: "La contraseña actual no es correcta" });
    expect(m.intentoFallido).toHaveBeenCalledWith(EMAIL, IP);
    expect(m.orden).toEqual(["cuenta", "rateLimit", "comparar:Otra1234", "intentoFallido"]);
  });

  it("límite de intentos excedido → 429 RATE_LIMIT_EXCEDIDO antes de comparar la actual", async () => {
    m.rateLimit.mockRejectedValue(new ServiceError("RATE_LIMIT_EXCEDIDO"));
    const error = await capturar(cambiarPasswordPropia(cambio({ password_actual: "Actual123" }), USUARIO, IP));
    expect(error).toMatchObject({ code: "RATE_LIMIT_EXCEDIDO", status: 429 });
    expect(m.rateLimit).toHaveBeenCalledWith(EMAIL, IP);
    expect(m.orden).toEqual(["cuenta", "rateLimit"]);
  });

  it("actual correcta → cambia", async () => {
    m.comparar.mockImplementation(async (texto: string) => texto === "Actual123");
    await expect(cambiarPasswordPropia(cambio({ password_actual: "Actual123" }), USUARIO, IP)).resolves.toEqual({ reemitir_sesion: true });
    expect(m.orden).toEqual(["cuenta", "rateLimit", "comparar:Actual123", "transaccion", "forUpdate", `comparar:${NUEVA}`, "cambiarPassword"]);
  });

  it("nueva igual a la actual → 422 PASSWORD_IGUAL_A_ACTUAL", async () => {
    m.comparar.mockResolvedValue(true);
    const error = await capturar(cambiarPasswordPropia(cambio({ password_actual: NUEVA }), USUARIO, IP));
    expect(error).toMatchObject({ code: "PASSWORD_IGUAL_A_ACTUAL" });
    expect(m.cambiarPassword).not.toHaveBeenCalled();
  });
});

describe("validación (Regla N.° 6, defensiva)", () => {
  beforeEach(() => m.cuenta.mockResolvedValue(CON_MARCA));

  it.each([
    ["corta", "Ab1"],
    ["sin mayúscula", "nuevaclave1"],
    ["sin minúscula", "NUEVACLAVE1"],
    ["sin número", "NuevaClave"],
    ["un DNI", "30111222"],
  ])("política: %s → 400 VALIDATION_ERROR sin leer la cuenta", async (_caso, nueva) => {
    const error = await capturar(cambiarPasswordPropia({ password_nueva: nueva, confirmacion: nueva }, USUARIO, IP));
    expect(error).toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(m.orden).toEqual([]);
  });

  it("confirmación distinta → 400 VALIDATION_ERROR", async () => {
    const error = await capturar(cambiarPasswordPropia({ password_nueva: NUEVA, confirmacion: "Otra1234" }, USUARIO, IP));
    expect(error).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("el error no lleva contraseñas", async () => {
    const error = await capturar(cambiarPasswordPropia({ password_nueva: "Ab1", confirmacion: "Ab1", password_actual: "Secreta9" }, USUARIO, IP));
    expect(JSON.stringify({ ...error, message: error.message })).not.toMatch(/Ab1|Secreta9/);
  });
});
