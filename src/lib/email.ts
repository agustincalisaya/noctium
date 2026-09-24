/**
 * Interfaz mínima de envío de email (HU-B-08, Decisión Resuelta 3 de
 * `docs/tasks/Sprint 1/HU-B-08.md` §0): destraba el flujo de autorregistro
 * sin comprometerse a ningún proveedor real. Confirmado por relevamiento
 * (búsqueda en todo el repo): no existía ningún patrón de abstracción de
 * notificación/envío previo — esta es la interfaz más simple posible, sin
 * colas, reintentos ni plantillas.
 */
export interface EmailSender {
  enviar(destinatario: string, asunto: string, cuerpo: string): Promise<void>;
}

/**
 * Implementación de desarrollo: loguea el email por consola en vez de
 * mandarlo. Única implementación existente — un proveedor real queda fuera
 * de alcance de esta HU (ver Nota de alcance de la task).
 */
export const emailSenderConsola: EmailSender = {
  async enviar(destinatario, asunto, cuerpo) {
    console.log(`[EMAIL] Para: ${destinatario} | Asunto: ${asunto}\n${cuerpo}`);
  },
};
