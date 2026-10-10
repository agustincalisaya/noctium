import { Badge } from "@/components/ui/badge";
import { texto } from "@/lib/textos";
import { diaAbreviadoYFecha } from "@/lib/turno-detalle";
import type { EstadoPagoCobrable } from "@/types/pago.types";

/** Instante ISO ya en la zona del centro («2026-10-09T15:31:00-03:00») → «Vie 09/10 15:31». */
export function diaYHoraDeInstante(instante: string): string {
  return `${diaAbreviadoYFecha(instante.slice(0, 10))} ${instante.slice(11, 16)}`;
}

/**
 * Etiqueta del estado de pago de la inscripción (DESIGN.md §6.6): Reservada
 * en `warning` (vence), Pago sin registrar en `outline` (neutro) y «Se
 * inscribe al confirmar el pago» en `accent` (no es una reserva existente).
 */
export function EstadoPagoBadge({ estado, venceEl }: { estado: EstadoPagoCobrable; venceEl: string | null }) {
  if (estado === "RESERVADA") {
    return <Badge variant="warning" className="whitespace-normal">{texto("ui.pagos.estado.reservada", { vence: venceEl ? diaYHoraDeInstante(venceEl) : "" })}</Badge>;
  }
  if (estado === "SE_INSCRIBE_AL_PAGAR") {
    return <Badge variant="accent" className="whitespace-normal">{texto("ui.pagos.estado.seInscribeAlPagar")}</Badge>;
  }
  return <Badge variant="outline">{texto("ui.pagos.estado.pagoSinRegistrar")}</Badge>;
}
