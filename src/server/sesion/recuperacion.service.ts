import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PrismaClient, type RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/password";
import { texto } from "@/lib/textos";
import { enviarEmail, EnvioEmailError } from "@/server/email/email.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { getParametroNumerico } from "@/server/shared/parametros";
import { ahora } from "@/server/shared/reloj";
import { transaccion, type OpcionesTransaccion, type Tx } from "@/server/shared/transaccion";
import {
  MAX_SOLICITUDES_RECUPERACION_POR_HORA,
  MINUTOS_VALIDEZ_ENLACE_RECUPERACION,
} from "@/server/sesion/recuperacion.constantes";
import {
  SolicitarRecuperacionSchema,
  construirRestablecerPasswordSchema,
  type RestablecerPasswordInput,
} from "@/server/sesion/sesion.schema";
import { cambiarPassword } from "@/server/usuarios/cuenta.service";
import { obtenerNombreVisible } from "@/server/usuarios/usuario.service";

/**
 * Recuperación de contraseña olvidada (HU-A-05, spec_modulo_A.md §2.7).
 * Interna del módulo A (no es pública, §2.9). No importa `next/*`: la capa
 * delgada programa `procesarSolicitudRecuperacion` con `after()` cuando
 * `solicitarRecuperacion` devuelve `entro: true` (sección 0.1 de la task).
 *
 * Ni el token, ni el enlace, ni las contraseñas, ni los hashes salen de acá:
 * ni en errores, ni en logs, ni en eventos (§3.11).
 */

type Db = Tx | PrismaClient;

/** Primera clave del bloqueo de aviso: separa este bloqueo de cualquier otro `pg_advisory_xact_lock` futuro. */
const CLAVE_BLOQUEO_RECUPERACION = 4105;

const MS_POR_MINUTO = 60_000;
const VENTANA_SOLICITUDES_MS = 60 * MS_POR_MINUTO;
const LARGO_TOKEN = { min: 20, max: 200 };

type EventoRecuperacion = "RECUPERACION_SOLICITADA" | "RECUPERACION_LIMITADA" | "RECUPERACION_ENVIO_FALLIDO";

/**
 * Evento de seguridad de la recuperación (§4, Revisión 3; P-A2). Solo
 * `usuarioId` (si se conoce), email e IP. RECUPERACION_CONFIRMADA lo registra
 * `cambiarPassword` con `origen: "RECUPERACION"`.
 */
async function eventoRecuperacion(db: Db, tipo: EventoRecuperacion, datos: { usuarioId?: string | null; email: string; ip: string }) {
  await db.eventoSeguridad.create({
    data: { tipoEvento: tipo, usuarioId: datos.usuarioId ?? null, emailEvento: datos.email, ipEvento: datos.ip, creadoEnEvento: ahora() },
  });
}

/** SHA-256 en hex del valor del enlace: es lo único que se guarda (§3.9). */
function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Instante para las columnas `timestamp` sin zona en SQL crudo, igual que `cuenta.service.ts`. */
function sqlInstante(momento: Date): Prisma.Sql {
  return Prisma.sql`${momento.toISOString()}::timestamptz AT TIME ZONE 'UTC'`;
}

function datosInvalidos(issues: { path: PropertyKey[] }[]): never {
  throw new ErrorDeDominio("errores.cuenta.datosInvalidos", { campos: issues.map((issue) => issue.path.join(".")) });
}

/**
 * Pedir el enlace (§2.7.1, criterios 1, 2 y 6). Valida el formato (el único
 * rechazo distinto de la respuesta uniforme) y, con un bloqueo de aviso por
 * email, cuenta las solicitudes de la última hora: con 3 o más registra
 * RECUPERACION_LIMITADA y no inserta; si no, inserta la solicitud. No mira
 * si la cuenta existe: eso corre después de responder (P-A4). El bloqueo
 * espera bajo el `lock_timeout` de `transaccion`; si se agota, 409
 * TRANSACCION_OCUPADA (depende solo del email).
 */
export async function solicitarRecuperacion(email: string, ip: string, opciones: OpcionesTransaccion = {}): Promise<{ entro: boolean }> {
  const parseado = SolicitarRecuperacionSchema.safeParse({ email });
  if (!parseado.success) datosInvalidos(parseado.error.issues);
  const normalizado = parseado.data.email;

  return transaccion(async (tx) => {
    // Regla N.° 7: dos pedidos simultáneos del mismo email no pasan el límite juntos.
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${CLAVE_BLOQUEO_RECUPERACION}::int, hashtext(${normalizado}))`);
    const momento = ahora();
    const recientes = await tx.solicitudRecuperacion.count({
      where: { emailSolicitud: normalizado, creadoEnSolicitud: { gt: new Date(momento.getTime() - VENTANA_SOLICITUDES_MS) } },
    });
    if (recientes >= MAX_SOLICITUDES_RECUPERACION_POR_HORA) {
      await eventoRecuperacion(tx, "RECUPERACION_LIMITADA", { usuarioId: null, email: normalizado, ip });
      return { entro: false };
    }
    await tx.solicitudRecuperacion.create({ data: { emailSolicitud: normalizado, ipSolicitud: ip, creadoEnSolicitud: momento } });
    return { entro: true };
  }, opciones);
}

/**
 * Lo que corre después de responder (§2.7.1): registra
 * RECUPERACION_SOLICITADA y, si la cuenta existe y está activa, invalida sus
 * enlaces abiertos, crea uno nuevo y envía el email. Si el envío falla (o no
 * hay URL pública), invalida el enlace recién creado y registra
 * RECUPERACION_ENVIO_FALLIDO; el error va al log sin el enlace. Cualquier
 * otra excepción se propaga: la captura y registra la tarea de `after()`.
 */
export async function procesarSolicitudRecuperacion(email: string, ip: string, opciones: OpcionesTransaccion = {}): Promise<void> {
  const parseado = SolicitarRecuperacionSchema.safeParse({ email });
  if (!parseado.success) return; // la capa delgada ya validó: nada que procesar
  const normalizado = parseado.data.email;
  const db = opciones.db ?? prisma;

  const cuenta = await db.usuario.findUnique({
    where: { emailUsuario: normalizado },
    select: { idUsuario: true, activoUsuario: true, rolUsuario: true },
  });
  await eventoRecuperacion(db, "RECUPERACION_SOLICITADA", { usuarioId: cuenta?.idUsuario ?? null, email: normalizado, ip });
  if (!cuenta || !cuenta.activoUsuario) return;

  const token = randomBytes(32).toString("base64url");
  const idToken = await transaccion(async (tx) => {
    // La fila de la cuenta, antes que sus enlaces (mismo orden que
    // restablecerPassword): dos pedidos simultáneos no dejan dos enlaces abiertos.
    await tx.$queryRaw(Prisma.sql`SELECT 1 FROM "usuarios" WHERE "idUsuario" = ${cuenta.idUsuario} FOR UPDATE`);
    const momento = ahora();
    await tx.tokenRecuperacion.updateMany({
      where: { usuarioId: cuenta.idUsuario, consumidoEnToken: null },
      data: { consumidoEnToken: momento },
    });
    const creado = await tx.tokenRecuperacion.create({
      data: {
        usuarioId: cuenta.idUsuario,
        tokenHashRecuperacion: hashToken(token),
        venceEnToken: new Date(momento.getTime() + MINUTOS_VALIDEZ_ENLACE_RECUPERACION * MS_POR_MINUTO),
        creadoEnToken: momento,
      },
      select: { idTokenRecuperacion: true },
    });
    return creado.idTokenRecuperacion;
  }, opciones);

  try {
    const mensaje = await armarEmailRecuperacion({ usuarioId: cuenta.idUsuario, rol: cuenta.rolUsuario, para: normalizado, token });
    await enviarEmail(mensaje);
  } catch (error) {
    await db.tokenRecuperacion.updateMany({
      where: { idTokenRecuperacion: idToken, consumidoEnToken: null },
      data: { consumidoEnToken: ahora() },
    });
    await eventoRecuperacion(db, "RECUPERACION_ENVIO_FALLIDO", { usuarioId: cuenta.idUsuario, email: normalizado, ip });
    // Sin el enlace ni la clave: solo el motivo que escribe este sistema.
    console.error("[recuperacion] no se pudo enviar el email de recuperación:", motivoDeFallo(error));
  }
}

class SinUrlPublicaError extends Error {
  constructor() {
    super("Falta la URL pública del sistema (NEXTAUTH_URL o AUTH_URL)");
    this.name = "SinUrlPublicaError";
  }
}

function motivoDeFallo(error: unknown): string {
  if (error instanceof EnvioEmailError || error instanceof SinUrlPublicaError) return error.message;
  return error instanceof Error ? error.name : "error desconocido";
}

/** `<URL pública>/restablecer-contrasena?token=…` con `NEXTAUTH_URL ?? AUTH_URL`; sin respaldo a localhost. */
function enlaceRecuperacion(token: string): string {
  const base = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim();
  if (!base) throw new SinUrlPublicaError();
  let url: URL;
  try {
    url = new URL("/restablecer-contrasena", base.replace(/\/+$/, ""));
  } catch {
    throw new SinUrlPublicaError();
  }
  url.searchParams.set("token", token);
  return url.toString();
}

function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Contenido del email (§2.7.4, criterio 7). El simulador imprime solo el
 * texto plano, así que el enlace va en el texto; en el HTML se escapan el
 * nombre y la URL. Saludo con `obtenerNombreVisible` (T10).
 */
async function armarEmailRecuperacion(datos: { usuarioId: string; rol: RolUsuario; para: string; token: string }) {
  const enlace = enlaceRecuperacion(datos.token);
  const nombre = await obtenerNombreVisible(datos.usuarioId, datos.rol);
  const saludo = texto("ui.sesion.emailRecuperacion.saludo", { nombre });
  const cuerpo = texto("ui.sesion.emailRecuperacion.cuerpo");
  const boton = texto("ui.sesion.emailRecuperacion.boton");
  const aviso = texto("ui.sesion.emailRecuperacion.aviso", { minutos: MINUTOS_VALIDEZ_ENLACE_RECUPERACION });
  const ignorar = texto("ui.sesion.emailRecuperacion.ignorar");
  return {
    para: datos.para,
    asunto: texto("ui.sesion.emailRecuperacion.asunto"),
    texto: [saludo, cuerpo, enlace, aviso, ignorar].join("\n\n"),
    html: [
      `<p>${escaparHtml(saludo)}</p>`,
      `<p>${escaparHtml(cuerpo)}</p>`,
      `<p><a href="${escaparHtml(enlace)}">${escaparHtml(boton)}</a></p>`,
      `<p>${escaparHtml(aviso)}</p>`,
      `<p>${escaparHtml(ignorar)}</p>`,
    ].join("\n"),
  };
}

/**
 * Verificar el enlace al abrirlo (§2.7.2): `true` si existe, no está
 * consumido ni invalidado y no venció. No lo consume. Un valor con largo
 * fuera de 20 a 200 se rechaza sin consultar la base.
 */
export async function verificarEnlaceRecuperacion(token: string, db: Db = prisma): Promise<boolean> {
  if (typeof token !== "string" || token.length < LARGO_TOKEN.min || token.length > LARGO_TOKEN.max) return false;
  const vigentes = await db.tokenRecuperacion.count({
    where: { tokenHashRecuperacion: hashToken(token), consumidoEnToken: null, venceEnToken: { gt: ahora() } },
  });
  return vigentes > 0;
}

/**
 * Definir la contraseña nueva con el enlace (§2.7.3, criterios 3 a 6).
 *
 * 1. Valida antes de tocar el enlace: política o confirmación → 400.
 * 2. En una `transaccion`: bloquea la fila de la cuenta del enlace (`FOR
 *    UPDATE`, el mismo orden que `procesarSolicitudRecuperacion`, cuenta y
 *    después enlaces) y consume el enlace con un `UPDATE … RETURNING`
 *    condicional (Regla N.° 7): sin fila → 410 ENLACE_INVALIDO. De dos
 *    envíos simultáneos, solo uno confirma.
 * 3. Cuenta inactiva → 410; nueva igual a la vigente → 422. Las dos deshacen
 *    la transacción, así que el enlace sigue valiendo.
 * 4. `cambiarPassword` (hash, marca, sesiones y RECUPERACION_CONFIRMADA) e
 *    invalida los demás enlaces abiertos de la cuenta, que `cambiarPassword`
 *    no toca.
 */
export async function restablecerPassword(
  input: RestablecerPasswordInput,
  ip: string,
  opciones: OpcionesTransaccion = {},
): Promise<{ restablecida: true }> {
  const longitudMinima = await getParametroNumerico("password_longitud_minima", 8);
  const parseado = construirRestablecerPasswordSchema(longitudMinima).safeParse(input);
  if (!parseado.success) datosInvalidos(parseado.error.issues);
  const { token, password_nueva: nueva } = parseado.data;
  const hash = hashToken(token);

  return transaccion(async (tx) => {
    const enlace = await tx.tokenRecuperacion.findUnique({ where: { tokenHashRecuperacion: hash }, select: { usuarioId: true } });
    if (!enlace) throw new ErrorDeDominio("errores.sesion.enlaceInvalido");
    const usuarioId = enlace.usuarioId;

    const [cuenta] = await tx.$queryRaw<{ activoUsuario: boolean; passwordHashUsuario: string }[]>(Prisma.sql`
      SELECT "activoUsuario", "passwordHashUsuario" FROM "usuarios" WHERE "idUsuario" = ${usuarioId} FOR UPDATE`);

    const momento = ahora();
    const consumidos = await tx.$queryRaw<{ idTokenRecuperacion: string }[]>(Prisma.sql`
      UPDATE "tokens_recuperacion"
      SET "consumidoEnToken" = ${sqlInstante(momento)}
      WHERE "tokenHashRecuperacion" = ${hash}
        AND "usuarioId" = ${usuarioId}
        AND "consumidoEnToken" IS NULL
        AND "venceEnToken" > ${sqlInstante(momento)}
      RETURNING "idTokenRecuperacion"`);
    // Vencido, usado, invalidado o de una cuenta inactiva: el mismo 410.
    if (consumidos.length === 0 || !cuenta?.activoUsuario) throw new ErrorDeDominio("errores.sesion.enlaceInvalido");
    if (await comparePassword(nueva, cuenta.passwordHashUsuario)) throw new ErrorDeDominio("errores.sesion.passwordIgualAnterior");

    await cambiarPassword(tx, { usuarioId, nueva, conservarSesionActual: false, origen: "RECUPERACION", ip });
    await tx.tokenRecuperacion.updateMany({ where: { usuarioId, consumidoEnToken: null }, data: { consumidoEnToken: momento } });
    return { restablecida: true } as const;
  }, opciones);
}
