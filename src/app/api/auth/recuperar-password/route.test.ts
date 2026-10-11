import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// HU-A-05 (spec_modulo_A.md §2.7.1): POST /api/auth/recuperar-password. El
// servicio y `after()` están simulados: el callback programado se captura y
// se ejecuta a mano, como lo haría Next después de responder.

const m = vi.hoisted(() => ({
  after: vi.fn(),
  solicitar: vi.fn(),
  procesar: vi.fn(),
}));

vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: m.after }));
vi.mock("@/auth", () => ({ obtenerIp: (req: Request) => req.headers.get("x-forwarded-for")!.split(",")[0]!.trim() }));
vi.mock("@/server/sesion/recuperacion.service", () => ({
  solicitarRecuperacion: m.solicitar,
  procesarSolicitudRecuperacion: m.procesar,
}));

const { POST } = await import("./route");

const IP = "10.2.3.4";
const EMAIL = "ana@noctium.local";

async function pedir(body: unknown, crudo = false) {
  const respuesta = await POST(
    new NextRequest("http://localhost/api/auth/recuperar-password", {
      method: "POST",
      body: crudo ? (body as string) : JSON.stringify(body),
      headers: { "Content-Type": "application/json", "x-forwarded-for": `${IP}, 10.0.0.1` },
    }),
  );
  return { status: respuesta.status, cache: respuesta.headers.get("Cache-Control"), cuerpo: await respuesta.json() };
}

/** Ejecuta la tarea que la ruta programó con `after()`. */
async function correrTareaProgramada() {
  expect(m.after).toHaveBeenCalledTimes(1);
  await (m.after.mock.calls[0]![0] as () => Promise<void>)();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  m.solicitar.mockResolvedValue({ entro: true });
  m.procesar.mockResolvedValue(undefined);
});

describe("POST /api/auth/recuperar-password", () => {
  it("entró: 200 uniforme, no-store y programa el procesamiento con el email normalizado y la IP", async () => {
    expect(await pedir({ email: "  Ana@Noctium.Local " })).toEqual({
      status: 200,
      cache: "no-store, must-revalidate",
      cuerpo: { data: { solicitada: true }, error: null },
    });
    expect(m.solicitar).toHaveBeenCalledWith(EMAIL, IP);
    expect(m.procesar).not.toHaveBeenCalled(); // corre recién después de responder
    await correrTareaProgramada();
    expect(m.procesar).toHaveBeenCalledWith(EMAIL, IP);
  });

  it("limitada: la misma respuesta y no programa nada", async () => {
    m.solicitar.mockResolvedValue({ entro: false });
    expect(await pedir({ email: EMAIL })).toEqual({
      status: 200,
      cache: "no-store, must-revalidate",
      cuerpo: { data: { solicitada: true }, error: null },
    });
    expect(m.after).not.toHaveBeenCalled();
  });

  it("una excepción dentro de la tarea se registra sin el email y no se propaga", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.procesar.mockRejectedValue(new Error(`fallo con ${EMAIL}`));
    expect((await pedir({ email: EMAIL })).status).toBe(200);
    await expect(correrTareaProgramada()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain(EMAIL);
  });

  it.each([
    ["formato inválido", { email: "ana@" }],
    ["sin email", {}],
  ])("%s → 400 VALIDATION_ERROR con el error del campo, sin llamar al servicio", async (_caso, body) => {
    const { status, cache, cuerpo } = await pedir(body);
    expect(status).toBe(400);
    expect(cache).toBe("no-store, must-revalidate");
    expect(cuerpo.data).toBeNull();
    expect(cuerpo.error.code).toBe("VALIDATION_ERROR");
    expect(cuerpo.error.detalles.email.length).toBeGreaterThan(0);
    expect(m.solicitar).not.toHaveBeenCalled();
    expect(m.after).not.toHaveBeenCalled();
  });

  it("formato inválido: el texto de la pantalla", async () => {
    const { cuerpo } = await pedir({ email: "ana@" });
    expect(cuerpo.error.detalles.email).toContain("Ingresá un email válido, por ejemplo nombre@dominio.com.");
  });

  it("cuerpo que no es JSON → 400 VALIDATION_ERROR", async () => {
    const { status, cuerpo } = await pedir("{no-json", true);
    expect(status).toBe(400);
    expect(cuerpo.error.code).toBe("VALIDATION_ERROR");
  });

  it("bloqueo agotado → 409 TRANSACCION_OCUPADA, sin programar nada", async () => {
    m.solicitar.mockRejectedValue(new ErrorDeDominio("errores.transaccion.ocupada"));
    expect(await pedir({ email: EMAIL })).toEqual({
      status: 409,
      cache: "no-store, must-revalidate",
      cuerpo: { data: null, error: { code: "TRANSACCION_OCUPADA", message: "Otra persona está modificando estos datos. Intentá de nuevo." } },
    });
    expect(m.after).not.toHaveBeenCalled();
  });

  it("error inesperado → 500 sin detalles técnicos", async () => {
    m.solicitar.mockRejectedValue(new Error("connection refused at 10.0.0.1"));
    const { status, cache, cuerpo } = await pedir({ email: EMAIL });
    expect({ status, cache }).toEqual({ status: 500, cache: "no-store, must-revalidate" });
    expect(JSON.stringify(cuerpo)).not.toContain("connection refused");
  });
});
