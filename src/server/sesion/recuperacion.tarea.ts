import { after } from "next/server";
import { ServiceError } from "@/server/shared/service-error";
import { procesarSolicitudRecuperacion } from "@/server/sesion/recuperacion.service";

/**
 * Programa lo que depende de la existencia de la cuenta para después de
 * responder (HU-A-05, spec_modulo_A.md §2.7.1 paso 3, P-A4). Es capa delgada:
 * la usan el Route Handler y la Server Action del pedido, y el servicio no
 * importa `next/*` (sección 0.1 de la task, decisión 1).
 *
 * Una excepción dentro de la tarea queda registrada acá y no afecta la
 * respuesta ya enviada. El log lleva solo el tipo de error: ni el email, ni
 * el enlace, ni el token (spec_modulo_A.md §3.11).
 */
export function programarProcesamientoRecuperacion(email: string, ip: string): void {
  after(async () => {
    try {
      await procesarSolicitudRecuperacion(email, ip);
    } catch (error) {
      console.error("[recuperacion] falló el procesamiento de una solicitud de enlace:", tipoDeError(error));
    }
  });
}

function tipoDeError(error: unknown): string {
  if (error instanceof ServiceError) return `${error.name} ${error.code}`;
  return error instanceof Error ? error.name : typeof error;
}
