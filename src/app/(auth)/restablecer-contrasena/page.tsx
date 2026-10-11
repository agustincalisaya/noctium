import { TarjetaSesionPublica } from "@/components/sesion/tarjeta-sesion-publica";
import { verificarEnlaceRecuperacion } from "@/server/sesion/recuperacion.service";
import { construirRestablecerPasswordSchema } from "@/server/sesion/sesion.schema";
import { getParametroNumerico } from "@/server/shared/parametros";
import { EnlaceInvalido } from "./enlace-invalido";
import { RestablecerPasswordForm } from "./restablecer-password-form";

/**
 * Definir la contraseña nueva con el enlace del email (HU-A-05,
 * spec_modulo_A.md §2.7.2 y §2.7.6, P-03, figura 90). Pública: la autoriza el
 * enlace. Un token ausente o con largo fuera de 20 a 200 es inválido sin
 * consultar la base; si no, `verificarEnlaceRecuperacion` (que no lo
 * consume). `Referrer-Policy: no-referrer` lo fija `next.config.ts`.
 */
export default async function RestablecerContrasenaPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const longitudMinima = await getParametroNumerico("password_longitud_minima", 8);
  // El mismo largo que valida el schema de la operación.
  const formatoValido = construirRestablecerPasswordSchema(longitudMinima).shape.token.safeParse(token).success;
  const valido = formatoValido && typeof token === "string" && (await verificarEnlaceRecuperacion(token));

  return (
    <TarjetaSesionPublica>
      {valido ? <RestablecerPasswordForm token={token} longitudMinima={longitudMinima} /> : <EnlaceInvalido />}
    </TarjetaSesionPublica>
  );
}
