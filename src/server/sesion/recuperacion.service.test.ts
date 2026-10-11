import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { conReloj } from "@/server/shared/reloj";
import type { ServiceError } from "@/server/shared/service-error";

// HU-A-05 (spec_modulo_A.md §2.7): el servicio de recuperación con la
// persistencia mockeada. El orden de los pasos se verifica con el registro de
// llamadas; la concurrencia y los rollbacks reales están en el .pg.test.ts.

const m = vi.hoisted(() => ({
  orden: [] as string[],
  transacciones: 0,
  db: {} as Record<string, unknown>,
  executeRaw: vi.fn(),
  forUpdate: vi.fn(),
  consumir: vi.fn(),
  contarSolicitudes: vi.fn(),
  crearSolicitud: vi.fn(),
  crearEvento: vi.fn(),
  buscarCuenta: vi.fn(),
  invalidarTokens: vi.fn(),
  crearToken: vi.fn(),
  buscarToken: vi.fn(),
  contarTokens: vi.fn(),
  comparar: vi.fn(),
  cambiarPassword: vi.fn(),
  nombreVisible: vi.fn(),
  enviar: vi.fn(),
}));

const registrar =
  (nombre: string, fn: (...a: unknown[]) => unknown) =>
  (...a: unknown[]) => (m.orden.push(nombre), fn(...a));

/** Texto del SQL crudo (`Prisma.sql`), para distinguir las sentencias. */
const sqlDe = (consulta: unknown) => (consulta as Prisma.Sql).sql;

m.db = {
  $executeRaw: registrar("bloqueo", m.executeRaw),
  $queryRaw: (consulta: unknown) =>
    sqlDe(consulta).includes('UPDATE "tokens_recuperacion"')
      ? registrar("consumir", m.consumir)(consulta)
      : registrar("forUpdate", m.forUpdate)(consulta),
  solicitudRecuperacion: { count: registrar("contar", m.contarSolicitudes), create: registrar("insertar", m.crearSolicitud) },
  eventoSeguridad: { create: (a: { data: { tipoEvento: string } }) => (m.orden.push(`evento:${a.data.tipoEvento}`), m.crearEvento(a)) },
  usuario: { findUnique: registrar("cuenta", m.buscarCuenta) },
  tokenRecuperacion: {
    updateMany: registrar("invalidar", m.invalidarTokens),
    create: registrar("crearToken", m.crearToken),
    findUnique: registrar("buscarToken", m.buscarToken),
    count: registrar("contarTokens", m.contarTokens),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: m.db }));
vi.mock("@/lib/password", () => ({ comparePassword: (...a: unknown[]) => (m.orden.push("comparar"), m.comparar(...a)) }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));
vi.mock("@/server/usuarios/cuenta.service", () => ({
  cambiarPassword: (...a: unknown[]) => (m.orden.push("cambiarPassword"), m.cambiarPassword(...a)),
}));
vi.mock("@/server/usuarios/usuario.service", () => ({ obtenerNombreVisible: (...a: unknown[]) => m.nombreVisible(...a) }));
vi.mock("@/server/email/email.service", async (original) => ({
  ...(await original<typeof import("@/server/email/email.service")>()),
  enviarEmail: (...a: unknown[]) => (m.orden.push("enviar"), m.enviar(...a)),
}));
vi.mock("@/server/shared/transaccion", () => ({
  transaccion: async (fn: (tx: unknown) => Promise<unknown>) => {
    m.orden.push("transaccion");
    m.transacciones += 1;
    return fn(m.db);
  },
}));

const { EnvioEmailError } = await import("@/server/email/email.service");
const { procesarSolicitudRecuperacion, restablecerPassword, solicitarRecuperacion, verificarEnlaceRecuperacion } = await import(
  "@/server/sesion/recuperacion.service"
);

const IP = "10.0.0.9";
const EMAIL = "ana@noctium.local";
const USUARIO = "ckusuario0000000000000001";
const AHORA = new Date("2026-10-10T15:00:00.000Z");
const TOKEN = "t".repeat(43);
const NUEVA = "NuevaClave1";
const sha256 = (valor: string) => createHash("sha256").update(valor, "utf8").digest("hex");

async function capturar(promesa: Promise<unknown>): Promise<ServiceError & { status?: number }> {
  try {
    await promesa;
  } catch (error) {
    return error as ServiceError;
  }
  throw new Error("Se esperaba un error");
}

const entornoOriginal = { NEXTAUTH_URL: process.env.NEXTAUTH_URL, AUTH_URL: process.env.AUTH_URL };

beforeEach(() => {
  vi.clearAllMocks();
  m.orden.length = 0;
  m.transacciones = 0;
  process.env.NEXTAUTH_URL = "https://noctium.test";
  delete process.env.AUTH_URL;
  m.executeRaw.mockResolvedValue(1);
  m.forUpdate.mockResolvedValue([{ activoUsuario: true, passwordHashUsuario: "hash-vigente" }]);
  m.consumir.mockResolvedValue([{ idTokenRecuperacion: "tok1" }]);
  m.contarSolicitudes.mockResolvedValue(0);
  m.crearSolicitud.mockResolvedValue({});
  m.crearEvento.mockResolvedValue({});
  m.buscarCuenta.mockResolvedValue({ idUsuario: USUARIO, activoUsuario: true, rolUsuario: "ALUMNO" });
  m.invalidarTokens.mockResolvedValue({ count: 0 });
  m.crearToken.mockResolvedValue({ idTokenRecuperacion: "tok-nuevo" });
  m.buscarToken.mockResolvedValue({ usuarioId: USUARIO });
  m.contarTokens.mockResolvedValue(1);
  m.comparar.mockResolvedValue(false);
  m.cambiarPassword.mockResolvedValue({ reemitir_sesion: false });
  m.nombreVisible.mockResolvedValue("Ana Pérez");
  m.enviar.mockResolvedValue({ simulado: true });
});

afterEach(() => {
  for (const [clave, valor] of Object.entries(entornoOriginal)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
  vi.restoreAllMocks();
});

const evento = (tipo: string) => m.crearEvento.mock.calls.map(([a]) => a.data).find((d) => d.tipoEvento === tipo);

describe("solicitarRecuperacion", () => {
  it("formato inválido → 400 VALIDATION_ERROR, sin transacción ni evento", async () => {
    const error = await capturar(solicitarRecuperacion("ana@", IP));
    expect(error).toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(m.transacciones).toBe(0);
    expect(m.crearEvento).not.toHaveBeenCalled();
  });

  it("entra: bloqueo por email antes de contar, inserta con ahora() y no busca la cuenta", async () => {
    await expect(conReloj(AHORA, () => solicitarRecuperacion("  Ana@Noctium.Local ", IP))).resolves.toEqual({ entro: true });
    expect(m.orden).toEqual(["transaccion", "bloqueo", "contar", "insertar"]);

    const bloqueo = m.executeRaw.mock.calls[0]![0] as Prisma.Sql;
    expect(bloqueo.sql).toContain("pg_advisory_xact_lock");
    expect(bloqueo.sql).toContain("hashtext");
    expect(bloqueo.values).toContain(EMAIL);

    expect(m.contarSolicitudes).toHaveBeenCalledWith({
      where: { emailSolicitud: EMAIL, creadoEnSolicitud: { gt: new Date(AHORA.getTime() - 60 * 60_000) } },
    });
    expect(m.crearSolicitud).toHaveBeenCalledWith({ data: { emailSolicitud: EMAIL, ipSolicitud: IP, creadoEnSolicitud: AHORA } });
    expect(m.buscarCuenta).not.toHaveBeenCalled();
  });

  it("con 3 solicitudes en la hora: RECUPERACION_LIMITADA con usuarioId null, sin insertar", async () => {
    m.contarSolicitudes.mockResolvedValue(3);
    await expect(solicitarRecuperacion(EMAIL, IP)).resolves.toEqual({ entro: false });
    expect(m.crearSolicitud).not.toHaveBeenCalled();
    expect(evento("RECUPERACION_LIMITADA")).toMatchObject({ usuarioId: null, emailEvento: EMAIL, ipEvento: IP });
    expect(m.buscarCuenta).not.toHaveBeenCalled();
  });

  it("con 2 solicitudes todavía entra", async () => {
    m.contarSolicitudes.mockResolvedValue(2);
    await expect(solicitarRecuperacion(EMAIL, IP)).resolves.toEqual({ entro: true });
    expect(m.crearEvento).not.toHaveBeenCalled();
  });
});

describe("procesarSolicitudRecuperacion", () => {
  it("email inexistente: RECUPERACION_SOLICITADA con usuarioId null y nada más", async () => {
    m.buscarCuenta.mockResolvedValue(null);
    await procesarSolicitudRecuperacion(EMAIL, IP);
    expect(evento("RECUPERACION_SOLICITADA")).toMatchObject({ usuarioId: null, emailEvento: EMAIL, ipEvento: IP });
    expect(m.orden).toEqual(["cuenta", "evento:RECUPERACION_SOLICITADA"]);
  });

  it("cuenta inactiva: el evento con su usuarioId, sin enlace ni email", async () => {
    m.buscarCuenta.mockResolvedValue({ idUsuario: USUARIO, activoUsuario: false, rolUsuario: "ALUMNO" });
    await procesarSolicitudRecuperacion(EMAIL, IP);
    expect(evento("RECUPERACION_SOLICITADA")).toMatchObject({ usuarioId: USUARIO });
    expect(m.crearToken).not.toHaveBeenCalled();
    expect(m.enviar).not.toHaveBeenCalled();
  });

  it("cuenta activa: invalida los anteriores, guarda solo el hash con 30 minutos y envía el email", async () => {
    await conReloj(AHORA, () => procesarSolicitudRecuperacion(EMAIL, IP));
    expect(m.orden).toEqual(["cuenta", "evento:RECUPERACION_SOLICITADA", "transaccion", "forUpdate", "invalidar", "crearToken", "enviar"]);
    expect(m.invalidarTokens).toHaveBeenCalledWith({ where: { usuarioId: USUARIO, consumidoEnToken: null }, data: { consumidoEnToken: AHORA } });

    const { data } = m.crearToken.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data).toMatchObject({ usuarioId: USUARIO, venceEnToken: new Date(AHORA.getTime() + 30 * 60_000), creadoEnToken: AHORA });
    expect(data.tokenHashRecuperacion).toMatch(/^[0-9a-f]{64}$/);

    const email = m.enviar.mock.calls[0]![0] as { para: string; asunto: string; texto: string; html: string };
    const enlace = email.texto.match(/https:\/\/noctium\.test\/restablecer-contrasena\?token=([A-Za-z0-9_-]+)/);
    expect(enlace).not.toBeNull();
    const token = enlace![1]!;
    expect(token).toHaveLength(43); // 32 bytes en base64url
    expect(sha256(token)).toBe(data.tokenHashRecuperacion);
    expect(JSON.stringify(data)).not.toContain(token);

    expect(email).toMatchObject({ para: EMAIL, asunto: "Restablecé tu contraseña de Noctium" });
    expect(email.texto).toContain("Hola, Ana Pérez:");
    expect(email.texto).toContain("El enlace vence a los 30 minutos y es de un solo uso.");
    expect(email.texto).toContain("Si no pediste este cambio, ignorá este email.");
    expect(email.html).toContain(">Definir contraseña nueva</a>");
    expect(m.nombreVisible).toHaveBeenCalledWith(USUARIO, "ALUMNO");
    expect(m.crearEvento).toHaveBeenCalledTimes(1);
  });

  it("el HTML escapa el nombre y la URL", async () => {
    m.nombreVisible.mockResolvedValue('<b>Ana & "Co"</b>');
    await procesarSolicitudRecuperacion(EMAIL, IP);
    const { texto, html } = m.enviar.mock.calls[0]![0] as { texto: string; html: string };
    expect(html).toContain("Hola, &lt;b&gt;Ana &amp; &quot;Co&quot;&lt;/b&gt;:");
    expect(html).not.toContain("<b>");
    const url = texto.match(/https:\/\/\S+/)![0];
    expect(html).toContain(`href="${url.replaceAll("&", "&amp;")}"`);
  });

  it.each([
    ["con barra final", { NEXTAUTH_URL: "https://noctium.test/" }, "https://noctium.test/restablecer-contrasena?token="],
    ["solo AUTH_URL", { AUTH_URL: "http://localhost:4000" }, "http://localhost:4000/restablecer-contrasena?token="],
  ])("URL pública %s", async (_caso, entorno, prefijo) => {
    delete process.env.NEXTAUTH_URL;
    Object.assign(process.env, entorno);
    await procesarSolicitudRecuperacion(EMAIL, IP);
    expect((m.enviar.mock.calls[0]![0] as { texto: string }).texto).toContain(prefijo);
  });

  it.each([
    ["sin URL pública", () => { delete process.env.NEXTAUTH_URL; delete process.env.AUTH_URL; }],
    ["con el envío caído", () => m.enviar.mockRejectedValue(new EnvioEmailError("El servicio de email respondió 500"))],
    ["con un error inesperado al armar el email", () => m.nombreVisible.mockRejectedValue(new TypeError("fallo"))],
  ])("%s: invalida el enlace nuevo, RECUPERACION_ENVIO_FALLIDO y log sin el enlace", async (_caso, preparar) => {
    preparar();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(conReloj(AHORA, () => procesarSolicitudRecuperacion(EMAIL, IP))).resolves.toBeUndefined();

    expect(m.invalidarTokens).toHaveBeenLastCalledWith({
      where: { idTokenRecuperacion: "tok-nuevo", consumidoEnToken: null },
      data: { consumidoEnToken: AHORA },
    });
    expect(evento("RECUPERACION_ENVIO_FALLIDO")).toMatchObject({ usuarioId: USUARIO, emailEvento: EMAIL, ipEvento: IP });
    expect(log).toHaveBeenCalledTimes(1);

    const { tokenHashRecuperacion } = (m.crearToken.mock.calls[0]![0] as { data: { tokenHashRecuperacion: string } }).data;
    const registrado = JSON.stringify(log.mock.calls) + JSON.stringify(m.crearEvento.mock.calls);
    expect(registrado).not.toContain("restablecer-contrasena");
    expect(registrado).not.toContain(tokenHashRecuperacion);
  });

  it("formato inválido: no hace nada", async () => {
    await procesarSolicitudRecuperacion("no-es-email", IP);
    expect(m.orden).toEqual([]);
  });
});

describe("verificarEnlaceRecuperacion", () => {
  it.each([19, 201])("largo %i: false sin consultar la base", async (largo) => {
    await expect(verificarEnlaceRecuperacion("x".repeat(largo))).resolves.toBe(false);
    expect(m.contarTokens).not.toHaveBeenCalled();
  });

  it("busca por el hash, abierto y no vencido; no consume", async () => {
    await expect(conReloj(AHORA, () => verificarEnlaceRecuperacion(TOKEN))).resolves.toBe(true);
    expect(m.contarTokens).toHaveBeenCalledWith({
      where: { tokenHashRecuperacion: sha256(TOKEN), consumidoEnToken: null, venceEnToken: { gt: AHORA } },
    });
    expect(m.invalidarTokens).not.toHaveBeenCalled();
  });

  it("sin coincidencias → false", async () => {
    m.contarTokens.mockResolvedValue(0);
    await expect(verificarEnlaceRecuperacion(TOKEN)).resolves.toBe(false);
  });
});

describe("restablecerPassword", () => {
  const datos = (extra: Record<string, unknown> = {}) => ({ token: TOKEN, password_nueva: NUEVA, confirmacion: NUEVA, ...extra });

  it.each([
    ["política", { password_nueva: "corta", confirmacion: "corta" }],
    ["confirmación distinta", { confirmacion: "OtraClave1" }],
    ["token corto", { token: "abc" }],
  ])("%s → 400 sin tocar el enlace", async (_caso, extra) => {
    const error = await capturar(restablecerPassword(datos(extra), IP));
    expect(error).toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(m.transacciones).toBe(0);
  });

  it("éxito: cuenta bloqueada, consumo condicional, cambiarPassword y los demás enlaces invalidados", async () => {
    await expect(conReloj(AHORA, () => restablecerPassword(datos(), IP))).resolves.toEqual({ restablecida: true });
    expect(m.orden).toEqual(["transaccion", "buscarToken", "forUpdate", "consumir", "comparar", "cambiarPassword", "invalidar"]);
    expect(m.buscarToken).toHaveBeenCalledWith({ where: { tokenHashRecuperacion: sha256(TOKEN) }, select: { usuarioId: true } });

    const consumo = m.consumir.mock.calls[0]![0] as Prisma.Sql;
    expect(consumo.sql).toMatch(/"consumidoEnToken" IS NULL/);
    expect(consumo.sql).toMatch(/"venceEnToken" >/);
    expect(consumo.sql).toMatch(/RETURNING/);
    expect(consumo.values).toContain(sha256(TOKEN));
    expect(consumo.values).not.toContain(TOKEN);

    expect(m.cambiarPassword).toHaveBeenCalledWith(m.db, {
      usuarioId: USUARIO,
      nueva: NUEVA,
      conservarSesionActual: false,
      origen: "RECUPERACION",
      ip: IP,
    });
    expect(m.invalidarTokens).toHaveBeenCalledWith({ where: { usuarioId: USUARIO, consumidoEnToken: null }, data: { consumidoEnToken: AHORA } });
  });

  it("enlace inexistente → 410 ENLACE_INVALIDO", async () => {
    m.buscarToken.mockResolvedValue(null);
    const error = await capturar(restablecerPassword(datos(), IP));
    expect(error).toMatchObject({ code: "ENLACE_INVALIDO", status: 410 });
    expect(error.message).toBe("El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?");
    expect(m.forUpdate).not.toHaveBeenCalled();
  });

  it("vencido, usado o invalidado (el UPDATE no devuelve fila) → 410 sin cambiar la contraseña", async () => {
    m.consumir.mockResolvedValue([]);
    await expect(restablecerPassword(datos(), IP)).rejects.toMatchObject({ code: "ENLACE_INVALIDO", status: 410 });
    expect(m.comparar).not.toHaveBeenCalled();
    expect(m.cambiarPassword).not.toHaveBeenCalled();
  });

  it("cuenta inactiva → 410", async () => {
    m.forUpdate.mockResolvedValue([{ activoUsuario: false, passwordHashUsuario: "h" }]);
    await expect(restablecerPassword(datos(), IP)).rejects.toMatchObject({ code: "ENLACE_INVALIDO", status: 410 });
    expect(m.cambiarPassword).not.toHaveBeenCalled();
  });

  it("igual a la vigente → 422 con el texto «anterior»", async () => {
    m.comparar.mockResolvedValue(true);
    const error = await capturar(restablecerPassword(datos(), IP));
    expect(error).toMatchObject({ code: "PASSWORD_IGUAL_A_ACTUAL", status: 422 });
    expect(error.message).toBe("La contraseña nueva no puede ser igual a la anterior");
    expect(m.comparar).toHaveBeenCalledWith(NUEVA, "hash-vigente");
    expect(m.cambiarPassword).not.toHaveBeenCalled();
  });

  it("ningún error lleva el token ni la contraseña", async () => {
    m.consumir.mockResolvedValue([]);
    const error = await capturar(restablecerPassword(datos(), IP));
    const serializado = JSON.stringify({ ...error, message: error.message });
    expect(serializado).not.toContain(TOKEN);
    expect(serializado).not.toContain(NUEVA);
  });
});
