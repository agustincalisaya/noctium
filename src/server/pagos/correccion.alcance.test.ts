import { afterEach, describe, expect, it, vi } from "vitest";
import { puedeCorregirPago } from "@/server/pagos/correccion.service";
import { emailsSimulados, enviarEmail, EnvioEmailError } from "@/server/email/email.service";
import { obtenerProfesoresBasicos } from "@/server/profesores/profesor.publico";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const momento = new Date("2030-05-31T12:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;

describe("puedeCorregirPago (spec_modulo_I.md §2.14.1)", () => {
  const pago = (dias: number, cajaAbierta = true, anulado = false) => ({ anulado, cajaAbierta, registradoEn: new Date(momento.getTime() - dias * DIA) });

  it("el Gerente corrige cualquier pago no anulado, de cualquier caja y antigüedad", () => {
    expect(puedeCorregirPago({ id: "g", rol: "GERENTE" }, pago(400, false), momento)).toBe(true);
    expect(puedeCorregirPago({ id: "g", rol: "GERENTE" }, pago(1, true, true), momento)).toBe(false);
  });

  it("Mesa de Entrada: 30 días o menos desde el registro y caja del pago abierta", () => {
    const mesa = { id: "m", rol: "MESA_ENTRADA" as const };
    expect(puedeCorregirPago(mesa, pago(30), momento)).toBe(true);
    expect(puedeCorregirPago(mesa, pago(30.01), momento)).toBe(false);
    expect(puedeCorregirPago(mesa, pago(1, false), momento)).toBe(false);
    expect(puedeCorregirPago(mesa, pago(1, true, true), momento)).toBe(false);
  });

  it("Profesor y Alumno, nunca", () => {
    expect(puedeCorregirPago({ id: "p", rol: "PROFESOR" }, pago(1), momento)).toBe(false);
    expect(puedeCorregirPago({ id: "a", rol: "ALUMNO" }, pago(1), momento)).toBe(false);
  });
});

describe("enviarEmail (spec_modulo_A.md §2.7.4)", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("en las pruebas usa el simulador aunque haya clave", async () => {
    vi.stubEnv("RESEND_API_KEY", "clave");
    const antes = emailsSimulados.length;
    await expect(enviarEmail({ para: "a@b.c", asunto: "Hola", texto: "x" })).resolves.toEqual({ simulado: true });
    expect(emailsSimulados.length).toBe(antes + 1);
  });

  it("en desarrollo sin RESEND_API_KEY simula y lo muestra en la consola", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    const consola = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(enviarEmail({ para: "a@b.c", asunto: "Enlace", texto: "https://x/restablecer" })).resolves.toEqual({ simulado: true });
    expect(consola).toHaveBeenCalledWith(expect.stringContaining("https://x/restablecer"));
    consola.mockRestore();
  });

  it("con RESEND_API_KEY y EMAIL_FROM envía por Resend; en producción sin clave falla", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "clave");
    vi.stubEnv("EMAIL_FROM", "Noctium <no-responder@ejemplo.com>");
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetch);
    await expect(enviarEmail({ para: "a@b.c", asunto: "Hola", texto: "x" })).resolves.toEqual({ simulado: false });
    expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
    fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(enviarEmail({ para: "a@b.c", asunto: "Hola", texto: "x" })).rejects.toBeInstanceOf(EnvioEmailError);
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(enviarEmail({ para: "a@b.c", asunto: "Hola", texto: "x" })).rejects.toThrow(/no está configurado/);
  });
});

describe("obtenerProfesoresBasicos (spec_modulo_H.md §2.8.4)", () => {
  it("en lote, activos e inactivos, en el orden pedido, con «Apellido, Nombre»", async () => {
    const db = { profesor: { findMany: vi.fn().mockResolvedValue([
      { idProfesor: "b", nombreProfesor: "Ana", apellidoProfesor: "Pérez", activoProfesor: false },
      { idProfesor: "a", nombreProfesor: "Luis", apellidoProfesor: "Gómez", activoProfesor: true },
    ]) } };
    await expect(obtenerProfesoresBasicos(["a", "x", "b", "a"], db as never)).resolves.toEqual([
      { id: "a", nombre: "Luis", apellido: "Gómez", nombreParaMostrar: "Gómez, Luis", activo: true },
      { id: "b", nombre: "Ana", apellido: "Pérez", nombreParaMostrar: "Pérez, Ana", activo: false },
    ]);
  });
});
