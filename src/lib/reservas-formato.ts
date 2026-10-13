import { texto } from "@/lib/textos";
import { diaAbreviadoYFecha } from "@/lib/turno-detalle";

/**
 * Cuánto falta para que venza una reserva (HU-C-26 criterio 2): «en 45 min»,
 * «en 3 h» y, si no es una hora exacta, «en 1 h 30 min» (task, 0.4 punto 2).
 * Una reserva listada todavía no venció: menos de un minuto se muestra como
 * «en 1 min», nunca «en 0 min».
 */
export function formatearFaltan(minutos: number): string {
  const total = Math.max(1, Math.floor(minutos));
  if (total < 60) return texto("ui.reservas.faltan.minutos", { min: total });
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return resto === 0
    ? texto("ui.reservas.faltan.horas", { h: horas })
    : texto("ui.reservas.faltan.horasYMinutos", { h: horas, min: resto });
}

/** «Apellido, Nombre» → «Nombre Apellido», como en la foto y en la confirmación de quitar de HU-C-24. */
export function nombreNatural(nombreParaMostrar: string): string {
  return nombreParaMostrar.replace(/^([^,]+),\s*(.+)$/, "$2 $1");
}

/**
 * Instante ISO ya expresado en la zona del centro («2026-10-06T22:04:00-03:00»,
 * como lo devuelven las lecturas de C) → «Mar 06/10 22:04», sin reconvertir zona.
 */
export function diaYHoraDeInstanteCentro(instante: string): string {
  return `${diaAbreviadoYFecha(instante.slice(0, 10))} ${instante.slice(11, 16)}`;
}
