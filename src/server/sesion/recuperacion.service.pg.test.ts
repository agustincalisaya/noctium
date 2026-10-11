import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { unico } from "@/server/testing/fabricas";
import { comparePassword, hashPassword } from "@/lib/password";
import { emailsSimulados } from "@/server/email/email.service";
import { ahora, conReloj } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";
import { desactivarCuenta } from "@/server/usuarios/cuenta.service";
import {
  procesarSolicitudRecuperacion,
  restablecerPassword,
  solicitarRecuperacion,
  verificarEnlaceRecuperacion,
} from "@/server/sesion/recuperacion.service";

// PostgreSQL real (`npm run test:pg -- <ruta>`): recuperación de contraseña
// (HU-A-05, spec_modulo_A.md §2.7, §3.9 a §3.12 y §4). El email lo recibe el
// simulador (NODE_ENV=test), de donde se toma el enlace como lo haría la persona.

describe.skipIf(!basePgHabilitada)("recuperación de contraseña con PostgreSQL real", () => {
  let db: PrismaClient;
  const IP = "10.4.5.6";
  const ACTUAL = "Actual123";
  const NUEVA = "NuevaClave1";
  const urlOriginal = process.env.NEXTAUTH_URL;

  beforeAll(async () => { db = clientePg(); });
  afterAll(async () => { await db?.$disconnect(); });
  beforeEach(() => { process.env.NEXTAUTH_URL = "http://localhost:3000"; });
  afterEach(() => {
    if (urlOriginal === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = urlOriginal;
    vi.restoreAllMocks();
  });

  const sha256 = (valor: string) => createHash("sha256").update(valor, "utf8").digest("hex");

  async function crearCuenta(opciones: { marca?: boolean } = {}) {
    const email = `${unico("recupera")}@prueba.local`;
    const u = await db.usuario.create({
      data: {
        emailUsuario: email,
        passwordHashUsuario: await hashPassword(ACTUAL),
        rolUsuario: "ALUMNO",
        debeCambiarPasswordUsuario: opciones.marca ?? false,
      },
    });
    return { id: u.idUsuario, email };
  }

  /** Pide y procesa un enlace como lo haría la capa delgada; devuelve el valor que llegó por email. */
  async function pedirEnlace(email: string): Promise<string> {
    const { entro } = await solicitarRecuperacion(email, IP);
    expect(entro).toBe(true);
    await procesarSolicitudRecuperacion(email, IP);
    const recibido = emailsSimulados.filter((e) => e.para === email).at(-1);
    const token = recibido?.texto.match(/restablecer-contrasena\?token=([A-Za-z0-9_-]+)/)?.[1];
    if (!token) throw new Error("El simulador no recibió el enlace");
    return token;
  }

  const tokensDe = (usuarioId: string) => db.tokenRecuperacion.findMany({ where: { usuarioId }, orderBy: { creadoEnToken: "asc" } });
  const eventos = (email: string, tipo: Prisma.EventoSeguridadWhereInput["tipoEvento"]) =>
    db.eventoSeguridad.findMany({ where: { emailEvento: email, tipoEvento: tipo } });
  const cuenta = (id: string) => db.usuario.findUniqueOrThrow({ where: { idUsuario: id } });

  describe("pedir el enlace", () => {
    it("cuatro pedidos simultáneos del mismo email: entran tres y el cuarto deja RECUPERACION_LIMITADA", async () => {
      const email = `${unico("limite")}@prueba.local`; // sin cuenta: el límite es por email (T6)
      const resultados = await Promise.all([1, 2, 3, 4].map(() => solicitarRecuperacion(email, IP)));
      expect(resultados.filter((r) => r.entro)).toHaveLength(3);
      expect(await db.solicitudRecuperacion.count({ where: { emailSolicitud: email } })).toBe(3);
      expect(await eventos(email, "RECUPERACION_LIMITADA")).toEqual([
        expect.objectContaining({ usuarioId: null, emailEvento: email, ipEvento: IP }),
      ]);
    });

    it("las solicitudes de más de una hora no cuentan", async () => {
      const email = `${unico("ventana")}@prueba.local`;
      const haceUnaHora = new Date(ahora().getTime() - 61 * 60_000);
      await db.solicitudRecuperacion.createMany({
        data: [1, 2, 3].map(() => ({ emailSolicitud: email, ipSolicitud: IP, creadoEnSolicitud: haceUnaHora })),
      });
      await expect(solicitarRecuperacion(email, IP)).resolves.toEqual({ entro: true });
    });

    it("si el bloqueo del email agota su tiempo → 409 TRANSACCION_OCUPADA, sin insertar", async () => {
      const email = `${unico("ocupado")}@prueba.local`;
      let liberar!: () => void;
      let tomado!: () => void;
      const liberado = new Promise<void>((r) => { liberar = r; });
      const bloqueoTomado = new Promise<void>((r) => { tomado = r; });
      // La misma clave que el servicio (4105, hashtext del email), tomada por otra transacción.
      const otra = db.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(4105, hashtext(${email}))`);
        tomado();
        await liberado;
      }, { timeout: 10_000 });
      await bloqueoTomado;
      try {
        await expect(solicitarRecuperacion(email, IP, { db, tiempos: { lockTimeoutMs: 300 } })).rejects.toMatchObject({
          code: "TRANSACCION_OCUPADA",
          status: 409,
        });
      } finally {
        liberar();
        await otra;
      }
      expect(await db.solicitudRecuperacion.count({ where: { emailSolicitud: email } })).toBe(0);
    });
  });

  describe("procesar la solicitud", () => {
    it("email inexistente o cuenta inactiva: RECUPERACION_SOLICITADA y ningún enlace ni email", async () => {
      const inexistente = `${unico("nadie")}@prueba.local`;
      await procesarSolicitudRecuperacion(inexistente, IP);
      expect(await eventos(inexistente, "RECUPERACION_SOLICITADA")).toEqual([expect.objectContaining({ usuarioId: null })]);

      const inactiva = await crearCuenta();
      await transaccion((tx) => desactivarCuenta(tx, inactiva.id), { db });
      await procesarSolicitudRecuperacion(inactiva.email, IP);
      expect(await eventos(inactiva.email, "RECUPERACION_SOLICITADA")).toEqual([expect.objectContaining({ usuarioId: inactiva.id })]);
      expect(await tokensDe(inactiva.id)).toEqual([]);
      expect(emailsSimulados.some((e) => e.para === inexistente || e.para === inactiva.email)).toBe(false);
    });

    it("guarda solo el hash, vence a los 30 minutos y pedir otro invalida el anterior", async () => {
      const { id, email } = await crearCuenta();
      const primero = await pedirEnlace(email);
      const [guardado] = await tokensDe(id);
      expect(guardado!.tokenHashRecuperacion).toBe(sha256(primero));
      expect(guardado!.venceEnToken.getTime() - guardado!.creadoEnToken.getTime()).toBe(30 * 60_000);

      const segundo = await pedirEnlace(email);
      const tokens = await tokensDe(id);
      expect(tokens).toHaveLength(2);
      expect(tokens[0]!.consumidoEnToken).not.toBeNull();
      expect(tokens[1]!.consumidoEnToken).toBeNull();
      expect(await verificarEnlaceRecuperacion(primero)).toBe(false);
      expect(await verificarEnlaceRecuperacion(segundo)).toBe(true);

      const filas = JSON.stringify([await tokensDe(id), await db.eventoSeguridad.findMany({ where: { emailEvento: email } })]);
      for (const valor of [primero, segundo]) expect(filas).not.toContain(valor);
      expect(await eventos(email, "RECUPERACION_SOLICITADA")).toHaveLength(2);
    });

    it("sin URL pública: el enlace creado queda invalidado y se registra RECUPERACION_ENVIO_FALLIDO", async () => {
      const { id, email } = await crearCuenta();
      delete process.env.NEXTAUTH_URL;
      const authUrl = process.env.AUTH_URL;
      delete process.env.AUTH_URL;
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await solicitarRecuperacion(email, IP);
        await procesarSolicitudRecuperacion(email, IP);
      } finally {
        if (authUrl !== undefined) process.env.AUTH_URL = authUrl;
      }
      const [token] = await tokensDe(id);
      expect(token!.consumidoEnToken).not.toBeNull();
      expect(await eventos(email, "RECUPERACION_ENVIO_FALLIDO")).toEqual([expect.objectContaining({ usuarioId: id, ipEvento: IP })]);
      expect(emailsSimulados.some((e) => e.para === email)).toBe(false);
      expect(JSON.stringify(log.mock.calls)).not.toContain(token!.tokenHashRecuperacion);
    });
  });

  describe("restablecer", () => {
    it("éxito: quita la marca, cierra las sesiones, invalida los otros enlaces y registra RECUPERACION_CONFIRMADA", async () => {
      const { id, email } = await crearCuenta({ marca: true });
      const token = await pedirEnlace(email);
      const otro = "otro-enlace-abierto-de-la-misma-cuenta";
      await db.tokenRecuperacion.create({
        data: { usuarioId: id, tokenHashRecuperacion: sha256(otro), venceEnToken: new Date(ahora().getTime() + 10 * 60_000) },
      });
      const antes = Math.floor(Date.now() / 1000);

      await expect(restablecerPassword({ token, password_nueva: NUEVA, confirmacion: NUEVA }, IP, { db })).resolves.toEqual({
        restablecida: true,
      });

      const despues = await cuenta(id);
      expect(await comparePassword(NUEVA, despues.passwordHashUsuario)).toBe(true);
      expect(despues.debeCambiarPasswordUsuario).toBe(false);
      expect(Math.floor(despues.sesionesValidasDesdeUsuario!.getTime() / 1000)).toBeGreaterThanOrEqual(antes);
      expect((await tokensDe(id)).every((t) => t.consumidoEnToken !== null)).toBe(true);
      expect(await verificarEnlaceRecuperacion(otro)).toBe(false);

      expect(await eventos(email, "RECUPERACION_CONFIRMADA")).toEqual([
        expect.objectContaining({ usuarioId: id, emailEvento: email, ipEvento: IP }),
      ]);
      const todos = JSON.stringify(await db.eventoSeguridad.findMany({ where: { emailEvento: email } }));
      for (const sensible of [token, sha256(token), NUEVA, ACTUAL, despues.passwordHashUsuario]) expect(todos).not.toContain(sensible);
    });

    it("dos confirmaciones simultáneas del mismo enlace: una gana y la otra recibe 410", async () => {
      const { id, email } = await crearCuenta();
      const token = await pedirEnlace(email);
      const resultados = await Promise.allSettled(
        ["PrimeraClave1", "SegundaClave2"].map((clave) => restablecerPassword({ token, password_nueva: clave, confirmacion: clave }, IP, { db })),
      );
      expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({
        code: "ENLACE_INVALIDO",
        status: 410,
      });
      expect(await eventos(email, "RECUPERACION_CONFIRMADA")).toHaveLength(1);
      expect((await tokensDe(id))[0]!.consumidoEnToken).not.toBeNull();
    });

    it("igual a la vigente → 422 y se deshace todo: el enlace sigue sirviendo", async () => {
      const { id, email } = await crearCuenta();
      const token = await pedirEnlace(email);
      const hashAntes = (await cuenta(id)).passwordHashUsuario;

      await expect(restablecerPassword({ token, password_nueva: ACTUAL, confirmacion: ACTUAL }, IP, { db })).rejects.toMatchObject({
        code: "PASSWORD_IGUAL_A_ACTUAL",
        status: 422,
      });
      expect((await cuenta(id)).passwordHashUsuario).toBe(hashAntes);
      expect((await tokensDe(id))[0]!.consumidoEnToken).toBeNull();
      expect(await verificarEnlaceRecuperacion(token)).toBe(true);
      expect(await eventos(email, "RECUPERACION_CONFIRMADA")).toEqual([]);

      await expect(restablecerPassword({ token, password_nueva: NUEVA, confirmacion: NUEVA }, IP, { db })).resolves.toEqual({
        restablecida: true,
      });
    });

    it("cuenta desactivada antes de confirmar → 410 y el consumo se deshace", async () => {
      const { id, email } = await crearCuenta();
      const token = await pedirEnlace(email);
      await transaccion((tx) => desactivarCuenta(tx, id), { db });

      await expect(restablecerPassword({ token, password_nueva: NUEVA, confirmacion: NUEVA }, IP, { db })).rejects.toMatchObject({
        code: "ENLACE_INVALIDO",
        status: 410,
      });
      expect((await tokensDe(id))[0]!.consumidoEnToken).toBeNull();
      expect(await comparePassword(ACTUAL, (await cuenta(id)).passwordHashUsuario)).toBe(true);
    });

    it("vencido, ya usado e inexistente → 410", async () => {
      const { email } = await crearCuenta();
      const token = await pedirEnlace(email);
      const pasada = new Date(ahora().getTime() + 31 * 60_000);
      await expect(
        conReloj(pasada, () => restablecerPassword({ token, password_nueva: NUEVA, confirmacion: NUEVA }, IP, { db })),
      ).rejects.toMatchObject({ code: "ENLACE_INVALIDO" });

      await restablecerPassword({ token, password_nueva: NUEVA, confirmacion: NUEVA }, IP, { db });
      await expect(
        restablecerPassword({ token, password_nueva: "OtraClave1", confirmacion: "OtraClave1" }, IP, { db }),
      ).rejects.toMatchObject({ code: "ENLACE_INVALIDO" });

      await expect(
        restablecerPassword({ token: "x".repeat(43), password_nueva: NUEVA, confirmacion: NUEVA }, IP, { db }),
      ).rejects.toMatchObject({ code: "ENLACE_INVALIDO" });
    });

    it("política o confirmación distinta → 400 sin gastar el enlace", async () => {
      const { email } = await crearCuenta();
      const token = await pedirEnlace(email);
      await expect(restablecerPassword({ token, password_nueva: "corta", confirmacion: "corta" }, IP, { db })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
      await expect(restablecerPassword({ token, password_nueva: NUEVA, confirmacion: "Distinta1" }, IP, { db })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
      expect(await verificarEnlaceRecuperacion(token)).toBe(true);
    });
  });
});
