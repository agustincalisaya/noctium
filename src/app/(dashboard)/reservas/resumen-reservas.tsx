import { formatearMonto } from "@/lib/moneda";
import { texto } from "@/lib/textos";
import type { ResumenReservas as DatosResumen } from "@/types/reserva.types";

/**
 * Los cuatro totales de Reservas (HU-C-26 criterio 1, spec_modulo_C.md
 * §2.20.1; foto «Reservas · Pendientes»). Solo presentación: los números salen
 * de `resumenReservas()`.
 */
export function ResumenReservas({ resumen }: { resumen: DatosResumen }) {
  const tarjetas = [
    { clave: "pendientes", etiqueta: texto("ui.reservas.resumen.pendientes"), valor: resumen.pendientes.cantidad,
      detalle: texto("ui.reservas.resumen.aCobrar", { importe: formatearMonto(resumen.pendientes.importe_total) }) },
    { clave: "en3", etiqueta: texto("ui.reservas.resumen.vencenEnTresHoras"), valor: resumen.vencen_en_3_horas },
    { clave: "hoy", etiqueta: texto("ui.reservas.resumen.vencenHoy"), valor: resumen.vencen_hoy },
    { clave: "vencieron", etiqueta: texto("ui.reservas.resumen.vencieronHoy"), valor: resumen.vencieron_hoy },
  ];
  return (
    <section aria-label={texto("ui.reservas.resumen.titulo")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tarjetas.map((tarjeta) => (
        <div key={tarjeta.clave} className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{tarjeta.etiqueta}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{tarjeta.valor}</p>
          {tarjeta.detalle && <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{tarjeta.detalle}</p>}
        </div>
      ))}
    </section>
  );
}
