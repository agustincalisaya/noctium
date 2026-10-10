import { prisma } from "@/lib/prisma";
import { ahora } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";
import { clasesConReservasVencidas, marcarVencidas } from "@/server/turnos/inscripcion.service";

export type ResultadoVencimiento = { reservasVencidas: number; clasesAfectadas: number; ejecutadoEl: Date };

/**
 * Proceso programado de vencimiento (HU-C-24 criterio 1, spec_modulo_C.md
 * §2.18.1). No reescribe la condición de vencimiento: la lectura y la marca
 * son las del PR 0. Una clase por transacción; `marcarVencidas` la bloquea,
 * actualiza con la condición atómica (idempotente), recalcula el estado de la
 * clase y encola el historial («Proceso automático», fecha = `venceEl`) para
 * después del commit. Si una clase falla se registra y se sigue con las demás:
 * la próxima corrida la reintenta.
 */
export async function vencerReservas(momento: Date = ahora()): Promise<ResultadoVencimiento> {
  let reservasVencidas = 0;
  let clasesAfectadas = 0;
  for (const turnoId of await clasesConReservasVencidas(prisma, momento)) {
    try {
      const marcadas = await transaccion((tx) => marcarVencidas(tx, turnoId, { momento }));
      if (marcadas > 0) {
        reservasVencidas += marcadas;
        clasesAfectadas += 1;
      }
    } catch (error) {
      console.error(`[vencerReservas] no se pudo procesar la clase ${turnoId}`, error);
    }
  }
  return { reservasVencidas, clasesAfectadas, ejecutadoEl: momento };
}
