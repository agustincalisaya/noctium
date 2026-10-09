import { Prisma, type RolUsuario, type TipoEventoSeguridad } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ahora } from "@/server/shared/reloj";
import type { Tx } from "@/server/shared/transaccion";
import { CrearCuentaParaFichaSchema, EmailCuentaSchema } from "@/server/usuarios/cuenta.schema";

/**
 * Cuentas de acceso del módulo A (PR-0.md §2.7 y §2.13, spec_modulo_A.md
 * §2.9). A es el único dueño de `usuarios` (Regla N.° 3): las fichas de otros
 * módulos crean, cambian y dan de baja su cuenta por acá, dentro de su propia
 * transacción. Ninguna función valida permisos. Las cuatro funciones de
 * `usuario.service.ts` no cambian.
 */

type Db = Tx | Prisma.TransactionClient;

/** Instante truncado a segundos, igual que el claim `iat_sesion`. */
function truncarASegundos(momento: Date): Date {
  return new Date(Math.floor(momento.getTime() / 1000) * 1000);
}

function datosInvalidos(error: unknown): never {
  throw new ErrorDeDominio("errores.cuenta.datosInvalidos", {
    campos: error instanceof Error && "issues" in error ? (error as { issues: { path: unknown[] }[] }).issues.map((i) => i.path.join(".")) : [],
  });
}

/** Evento de seguridad en la transacción del llamador (spec_modulo_A.md §4, Revisión 3). Sin datos sensibles. */
async function eventoSeguridad(tx: Db, tipo: TipoEventoSeguridad, usuarioId: string, email: string, ip?: string | null) {
  await tx.eventoSeguridad.create({
    data: { tipoEvento: tipo, usuarioId, emailEvento: email, ipEvento: ip ?? "desconocida", creadoEnEvento: ahora() },
  });
}

/**
 * Lanza EMAIL_YA_ASOCIADO si el email (sin distinguir mayúsculas) ya es de
 * otra cuenta. Es una ayuda para la pantalla; en la escritura manda la
 * unicidad de la base.
 */
export async function verificarEmailNoAsociadoAOtraCuenta(
  email: string,
  opciones: { excluirUsuarioId?: string | null } = {},
  db: Db = prisma,
): Promise<void> {
  const otra = await db.usuario.findFirst({
    where: {
      emailUsuario: { equals: email.trim(), mode: "insensitive" },
      ...(opciones.excluirUsuarioId ? { NOT: { idUsuario: opciones.excluirUsuarioId } } : {}),
    },
    select: { idUsuario: true },
  });
  if (otra) throw new ErrorDeDominio("errores.cuenta.emailYaAsociado");
}

/**
 * Crea la cuenta de una ficha (HU-A-06, spec_modulo_A.md §2.6.1): el DNI es
 * la contraseña inicial (solo su hash) y la cuenta nace con la marca «Debe
 * cambiar la contraseña». Un email en uso responde EMAIL_YA_ASOCIADO, sin
 * revelar de quién es; la excepción cancela la transacción del llamador, así
 * que tampoco se crea la ficha. Registra CUENTA_CREADA en la misma transacción.
 */
export async function crearCuentaParaFicha(
  tx: Tx,
  datos: { email: string; dni: string; rol: RolUsuario; ip?: string | null },
): Promise<{ usuario_id: string }> {
  const parseado = CrearCuentaParaFichaSchema.safeParse(datos);
  if (!parseado.success) datosInvalidos(parseado.error);
  const { email, dni, rol } = parseado.data;
  await verificarEmailNoAsociadoAOtraCuenta(email, {}, tx);
  const passwordHash = await hashPassword(dni);
  let usuario;
  try {
    usuario = await tx.usuario.create({
      data: { emailUsuario: email, passwordHashUsuario: passwordHash, rolUsuario: rol, activoUsuario: true, debeCambiarPasswordUsuario: true },
      select: { idUsuario: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ErrorDeDominio("errores.cuenta.emailYaAsociado");
    throw error;
  }
  await eventoSeguridad(tx, "CUENTA_CREADA", usuario.idUsuario, email, datos.ip);
  return { usuario_id: usuario.idUsuario };
}

/**
 * Cambia el email de la cuenta (HU-A-06 criterio 6: en una ficha con cuenta,
 * el email de la ficha es el de la cuenta). No revoca sesiones: la sesión se
 * identifica por el id, no por el email.
 */
export async function cambiarEmailCuenta(tx: Tx, datos: { usuarioId: string; email: string }): Promise<{ cambio: boolean }> {
  const parseado = EmailCuentaSchema.safeParse(datos.email);
  if (!parseado.success) datosInvalidos(parseado.error);
  const email = parseado.data;
  const actual = await tx.usuario.findUnique({ where: { idUsuario: datos.usuarioId }, select: { emailUsuario: true } });
  if (!actual) throw new Error(`cambiarEmailCuenta: no existe la cuenta ${datos.usuarioId}`);
  if (actual.emailUsuario === email) return { cambio: false };
  await verificarEmailNoAsociadoAOtraCuenta(email, { excluirUsuarioId: datos.usuarioId }, tx);
  try {
    await tx.usuario.update({ where: { idUsuario: datos.usuarioId }, data: { emailUsuario: email } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ErrorDeDominio("errores.cuenta.emailYaAsociado");
    throw error;
  }
  return { cambio: true };
}

/**
 * Revoca todas las sesiones de la cuenta iniciadas antes de ahora (RNF-SEG-04,
 * spec_modulo_A.md §3.7): `sesionesValidasDesde` = ahora truncado a
 * segundos, y nunca retrocede (GREATEST con el valor anterior).
 */
export async function revocarSesiones(tx: Db, usuarioId: string): Promise<void> {
  const desde = truncarASegundos(ahora());
  await tx.$executeRaw(Prisma.sql`
    UPDATE "usuarios"
    SET "sesionesValidasDesdeUsuario" = GREATEST(
      COALESCE("sesionesValidasDesdeUsuario", ${desde.toISOString()}::timestamptz AT TIME ZONE 'UTC'),
      ${desde.toISOString()}::timestamptz AT TIME ZONE 'UTC')
    WHERE "idUsuario" = ${usuarioId}`);
}

/** Desactiva la cuenta y revoca sus sesiones. Idempotente; conserva la marca de contraseña. */
export async function desactivarCuenta(tx: Tx, usuarioId: string): Promise<{ cambio: boolean }> {
  const { count } = await tx.usuario.updateMany({ where: { idUsuario: usuarioId, activoUsuario: true }, data: { activoUsuario: false } });
  if (count === 0) return { cambio: false };
  await revocarSesiones(tx, usuarioId);
  return { cambio: true };
}

/** Reactiva la cuenta. Las sesiones revocadas no se restauran: hay que volver a ingresar. Idempotente. */
export async function reactivarCuenta(tx: Tx, usuarioId: string): Promise<{ cambio: boolean }> {
  const { count } = await tx.usuario.updateMany({ where: { idUsuario: usuarioId, activoUsuario: false }, data: { activoUsuario: true } });
  return { cambio: count > 0 };
}

/**
 * Cambia la contraseña (spec_modulo_A.md §2.6.3 y §2.7.3): guarda el hash,
 * quita la marca, revoca las sesiones y registra PASSWORD_CAMBIADA (o
 * RECUPERACION_CONFIRMADA desde la recuperación) en la misma transacción. No
 * compara la contraseña actual ni aplica la política: eso lo hace quien llama.
 * Con `conservarSesionActual` la sesión que hizo el cambio se reemite con
 * `iat_sesion = ahora` (HU-A-06); sin él caen todas (HU-A-05).
 */
export async function cambiarPassword(
  tx: Tx,
  datos: { usuarioId: string; nueva: string; conservarSesionActual: boolean; origen?: "CAMBIO" | "RECUPERACION"; ip?: string | null },
): Promise<{ reemitir_sesion: boolean }> {
  const usuario = await tx.usuario.findUnique({ where: { idUsuario: datos.usuarioId }, select: { emailUsuario: true } });
  if (!usuario) throw new Error(`cambiarPassword: no existe la cuenta ${datos.usuarioId}`);
  await tx.usuario.update({
    where: { idUsuario: datos.usuarioId },
    data: { passwordHashUsuario: await hashPassword(datos.nueva), debeCambiarPasswordUsuario: false },
  });
  await revocarSesiones(tx, datos.usuarioId);
  await eventoSeguridad(tx, datos.origen === "RECUPERACION" ? "RECUPERACION_CONFIRMADA" : "PASSWORD_CAMBIADA", datos.usuarioId, usuario.emailUsuario, datos.ip);
  return { reemitir_sesion: datos.conservarSesionActual };
}

export type EstadoCuenta = { email: string; rol: RolUsuario; activa: boolean; debe_cambiar_password: boolean };

/** Estado de la cuenta, o `null` si no existe. Nunca devuelve el hash. */
export async function obtenerEstadoCuenta(usuarioId: string, db: Db = prisma): Promise<EstadoCuenta | null> {
  const usuario = await db.usuario.findUnique({
    where: { idUsuario: usuarioId },
    select: { emailUsuario: true, rolUsuario: true, activoUsuario: true, debeCambiarPasswordUsuario: true },
  });
  return usuario
    ? { email: usuario.emailUsuario, rol: usuario.rolUsuario, activa: usuario.activoUsuario, debe_cambiar_password: usuario.debeCambiarPasswordUsuario }
    : null;
}

export type ResumenCuenta = {
  estado: "ACTIVA" | "INACTIVA" | "SIN_CUENTA";
  email: string | null;
  rol: RolUsuario | null;
  debe_cambiar_password: boolean;
};

/** Sección «Cuenta de acceso» de las fichas: SIN_CUENTA con `usuarioId` nulo o inexistente. */
export async function obtenerResumenCuenta(usuarioId: string | null, db: Db = prisma): Promise<ResumenCuenta> {
  const estado = usuarioId ? await obtenerEstadoCuenta(usuarioId, db) : null;
  if (!estado) return { estado: "SIN_CUENTA", email: null, rol: null, debe_cambiar_password: false };
  return { estado: estado.activa ? "ACTIVA" : "INACTIVA", email: estado.email, rol: estado.rol, debe_cambiar_password: estado.debe_cambiar_password };
}

/** Los ids de la lista cuya cuenta está activa (HU-G-05, «al menos un gerente activo»). Lectura simple, sin bloqueo. */
export async function filtrarCuentasActivas(tx: Db, usuarioIds: string[]): Promise<string[]> {
  const unicos = [...new Set(usuarioIds)];
  if (unicos.length === 0) return [];
  const activas = await tx.usuario.findMany({ where: { idUsuario: { in: unicos }, activoUsuario: true }, select: { idUsuario: true } });
  const conjunto = new Set(activas.map((u) => u.idUsuario));
  return unicos.filter((id) => conjunto.has(id));
}
