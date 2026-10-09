/**
 * Envío de emails del sistema (PR-0.md §2.11 y §2.13, spec_modulo_A.md
 * §2.7.4). Sin `RESEND_API_KEY` (y siempre en las pruebas) usa el simulador:
 * no manda nada y escribe el email en la consola, fuera de producción. Con
 * `RESEND_API_KEY` y `EMAIL_FROM` envía por la API de Resend. En producción
 * sin clave el envío falla y quien llama lo trata como un envío fallido.
 * Ninguna credencial va en el código (Regla N.° 9).
 */

export type Email = { para: string; asunto: string; texto: string; html?: string };
export type ResultadoEnvio = { simulado: boolean };

export class EnvioEmailError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "EnvioEmailError";
  }
}

/** Emails enviados por el simulador en este proceso (para las pruebas). */
export const emailsSimulados: Email[] = [];

const URL_RESEND = "https://api.resend.com/emails";
const ESPERA_MAXIMA_MS = 10_000;

function usaSimulador(): boolean {
  return process.env.NODE_ENV === "test" || (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production");
}

export async function enviarEmail(email: Email): Promise<ResultadoEnvio> {
  if (usaSimulador()) {
    emailsSimulados.push(email);
    if (process.env.NODE_ENV !== "test") {
      console.log(`[EMAIL simulado] Para: ${email.para} | Asunto: ${email.asunto}\n${email.texto}`);
    }
    return { simulado: true };
  }
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.EMAIL_FROM;
  if (!clave || !remitente) throw new EnvioEmailError("El envío de emails no está configurado (RESEND_API_KEY y EMAIL_FROM)");

  const respuesta = await fetch(URL_RESEND, {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: remitente, to: [email.para], subject: email.asunto, text: email.texto, html: email.html }),
    signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
  }).catch((error: unknown) => {
    throw new EnvioEmailError(`No se pudo contactar al servicio de email: ${error instanceof Error ? error.message : String(error)}`);
  });
  if (!respuesta.ok) throw new EnvioEmailError(`El servicio de email respondió ${respuesta.status}`);
  return { simulado: false };
}
