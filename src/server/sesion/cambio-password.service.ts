import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/password";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico } from "@/server/shared/parametros";
import { transaccion, type OpcionesTransaccion } from "@/server/shared/transaccion";
import { registrarIntentoFallido, verificarRateLimit } from "@/server/sesion/autenticacion.service";
import { construirCambiarPasswordSchema, type CambiarPasswordInput } from "@/server/sesion/sesion.schema";
import { cambiarPassword } from "@/server/usuarios/cuenta.service";

/**
 * Cambio de la propia contraseña (HU-A-06, spec_modulo_A.md §2.6.3): primer
 * ingreso y «Mi cuenta». Interna del módulo A (no es pública, §2.9).
 *
 * No verifica el permiso: `usuarioId` llega de la sesión ya autorizada con
 * `cuenta:cambiar_password` por la Server Action (Regla N.° 4). Tampoco
 * reemite la sesión: devuelve `reemitir_sesion` y la acción lo hace después
 * del commit (P-A1), porque los servicios no importan `@/auth`.
 *
 * Orden, sin alterarlo:
 * 1. Valida con `CambiarPasswordSchema` (defensivo: la acción ya validó).
 * 2. Límite de intentos del login (§3.3) con el email de la cuenta y la IP,
 *    antes de comparar nada.
 * 3. Sin la marca («Mi cuenta»), la contraseña actual es obligatoria y se
 *    compara con el hash; si falla, cuenta como intento fallido del login.
 *    Con la marca (primer ingreso) no se pide (P-A9).
 * 4. En una `transaccion`, con la fila de la cuenta bloqueada (`FOR UPDATE`,
 *    sin combinarse con otros bloqueos, §3.12): la nueva tiene que ser
 *    distinta del hash vigente —con la contraseña inicial, distinta del DNI
 *    (T9)— y `cambiarPassword` guarda el hash, quita la marca, revoca las
 *    sesiones y registra PASSWORD_CAMBIADA.
 *
 * Ni las contraseñas ni el hash salen de acá: ni en errores, ni en logs.
 */
export async function cambiarPasswordPropia(
  input: CambiarPasswordInput,
  usuarioId: string,
  ip: string,
  opciones: OpcionesTransaccion = {},
): Promise<{ reemitir_sesion: boolean }> {
  const db = opciones.db ?? prisma;

  const longitudMinima = await getParametroNumerico("password_longitud_minima", 8);
  const parseado = construirCambiarPasswordSchema(longitudMinima).safeParse(input);
  if (!parseado.success) {
    throw new ErrorDeDominio("errores.cuenta.datosInvalidos", {
      campos: parseado.error.issues.map((issue) => issue.path.join(".")),
    });
  }
  const { password_actual: actual, password_nueva: nueva } = parseado.data;

  const cuenta = await db.usuario.findUnique({
    where: { idUsuario: usuarioId },
    select: { emailUsuario: true, passwordHashUsuario: true, debeCambiarPasswordUsuario: true },
  });
  if (!cuenta) throw new Error(`cambiarPasswordPropia: no existe la cuenta ${usuarioId}`);

  try {
    await verificarRateLimit(cuenta.emailUsuario, ip);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "RATE_LIMIT_EXCEDIDO") {
      throw new ErrorDeDominio("errores.sesion.rateLimitExcedido");
    }
    throw error;
  }

  if (!cuenta.debeCambiarPasswordUsuario) {
    if (!actual) {
      throw new ErrorDeDominio("errores.cuenta.datosInvalidos", { campos: ["password_actual"] });
    }
    if (!(await comparePassword(actual, cuenta.passwordHashUsuario))) {
      await registrarIntentoFallido(cuenta.emailUsuario, ip);
      throw new ErrorDeDominio("errores.cuenta.passwordActualIncorrecta");
    }
  }

  return transaccion(async (tx) => {
    const [bloqueada] = await tx.$queryRaw<{ passwordHashUsuario: string }[]>(Prisma.sql`
      SELECT "passwordHashUsuario" FROM "usuarios" WHERE "idUsuario" = ${usuarioId} FOR UPDATE`);
    if (!bloqueada) throw new Error(`cambiarPasswordPropia: no existe la cuenta ${usuarioId}`);
    if (await comparePassword(nueva, bloqueada.passwordHashUsuario)) {
      throw new ErrorDeDominio("errores.cuenta.passwordIgualActual");
    }
    return cambiarPassword(tx, { usuarioId, nueva, conservarSesionActual: true, ip });
  }, opciones);
}
