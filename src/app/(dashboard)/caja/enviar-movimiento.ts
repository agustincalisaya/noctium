import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";

const MENSAJE_ERROR_GENERICO = "No se pudo completar la acción. Intentá nuevamente.";

/**
 * POST de los movimientos manuales (HU-I-12-b) para `ConfirmarAccionDialog`:
 * igual que `fetchOLanzar`, pero CAJA_NO_ABIERTA muestra el texto de UI de
 * movimientos (el del servidor habla de cobros). Los demás rechazos
 * (EGRESO_SUPERA_EFECTIVO, MOVIMIENTO_YA_ANULADO…) usan el mensaje del
 * servidor, que nunca incluye el efectivo esperado (arqueo ciego).
 */
export async function enviarMovimiento(url: string, body: unknown): Promise<void> {
  const response = await fetchAutenticado(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) return;
  const resultado = await response.json().catch(() => null);
  if (resultado?.error?.code === "CAJA_NO_ABIERTA") throw new Error(texto("ui.caja.movimiento.cajaCerrada"));
  throw new Error(resultado?.error?.message ?? MENSAJE_ERROR_GENERICO);
}
