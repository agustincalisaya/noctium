import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/password";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico } from "@/server/shared/parametros";
import type { RolUsuario } from "@prisma/client";

/**
 * Hash bcrypt de referencia (costo 12) contra el que se compara cuando el
 * email no existe, para que el tiempo de respuesta no permita inferir por
 * timing si una cuenta está registrada (spec_modulo_A.md §3.1). No protege
 * ningún dato real: es una constante pública, no un secreto (Regla N.° 9
 * de docs/RULES.md no aplica acá).
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$HDgU4qRtZLscFAMAJJZc2.v4/ViPy8.A2bLN0Wi7LEBxurJ1MDep2";

export async function verificarRateLimit(email: string, ip: string): Promise<void> {
  const [maxIntentos, ventanaMinutos] = await Promise.all([
    getParametroNumerico("login_max_intentos", 5),
    getParametroNumerico("login_ventana_minutos", 15),
  ]);

  const intentosRecientes = await prisma.intentoLoginFallido.count({
    where: {
      emailIntento: email,
      ipIntento: ip,
      creadoEnIntento: { gte: new Date(Date.now() - ventanaMinutos * 60_000) },
    },
  });

  if (intentosRecientes >= maxIntentos) {
    throw new ServiceError("RATE_LIMIT_EXCEDIDO");
  }
}

export async function registrarIntentoFallido(email: string, ip: string): Promise<void> {
  await prisma.intentoLoginFallido.create({
    data: { emailIntento: email, ipIntento: ip },
  });
}

async function registrarEventoSeguridad(params: {
  tipo: "LOGIN_EXITOSO" | "LOGIN_FALLIDO" | "CUENTA_INACTIVA_RECHAZADA" | "LOGOUT";
  usuarioId: string | null;
  email?: string;
  ip: string;
}): Promise<void> {
  await prisma.eventoSeguridad.create({
    data: {
      tipoEvento: params.tipo,
      usuarioId: params.usuarioId,
      emailEvento: params.email ?? null,
      ipEvento: params.ip,
    },
  });
}

/**
 * Verifica credenciales de login (spec_modulo_A.md §2.1). Orden no
 * negociable: rate limit → comparación de password (siempre, exista o no
 * el usuario) → recién después, estado de la cuenta.
 */
export async function verificarCredenciales(
  email: string,
  password: string,
  ip: string,
): Promise<{ id: string; rol: RolUsuario }> {
  await verificarRateLimit(email, ip);

  const usuario = await prisma.usuario.findUnique({
    where: { emailUsuario: email },
  });

  const hashParaComparar = usuario?.passwordHashUsuario ?? DUMMY_PASSWORD_HASH;
  const passwordValida = await comparePassword(password, hashParaComparar);

  if (!usuario || !passwordValida) {
    await registrarIntentoFallido(email, ip);
    await registrarEventoSeguridad({
      tipo: "LOGIN_FALLIDO",
      usuarioId: usuario?.idUsuario ?? null,
      email,
      ip,
    });
    throw new ServiceError("CREDENCIALES_INVALIDAS");
  }

  if (!usuario.activoUsuario) {
    await registrarEventoSeguridad({
      tipo: "CUENTA_INACTIVA_RECHAZADA",
      usuarioId: usuario.idUsuario,
      email,
      ip,
    });
    throw new ServiceError("CUENTA_INACTIVA");
  }

  await registrarEventoSeguridad({
    tipo: "LOGIN_EXITOSO",
    usuarioId: usuario.idUsuario,
    email,
    ip,
  });

  return { id: usuario.idUsuario, rol: usuario.rolUsuario };
}

/**
 * Cierra sesión (spec_modulo_A.md §2.3). `exp` es el vencimiento original
 * del token que se está cerrando (no `now + algo`) — no es parte de la
 * firma que propone HU-A-03.md §4.2 (`jti, usuarioId, ip`), pero el
 * comportamiento exigido ahí mismo ("expira_en igual al exp original") no
 * se puede resolver sin conocerlo, así que se agrega como 4to parámetro.
 *
 * Si el INSERT falla (error de comunicación con la base), igual se
 * responde éxito al caller: no se reintenta en segundo plano (nota de
 * sincronización, spec_modulo_A.md §2.3) — el respaldo es que el token de
 * todos modos deja de ser válido al vencer naturalmente (máx.
 * SESION_INACTIVIDAD_MIN).
 */
export async function cerrarSesion(
  jti: string,
  usuarioId: string,
  ip: string,
  exp: number,
): Promise<{ revocado: boolean }> {
  try {
    await prisma.tokenRevocado.create({
      data: { jti, usuarioId, expiraEn: new Date(exp * 1000) },
    });
  } catch (error) {
    console.error("cerrarSesion: no se pudo insertar en TokenRevocado", error);
  }

  await registrarEventoSeguridad({ tipo: "LOGOUT", usuarioId, ip });

  return { revocado: true };
}
