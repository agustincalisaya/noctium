import type { ReactNode } from "react";
import { fechaCorta, monto } from "@/lib/turno-detalle";
import type { PagoRegistradoTurno } from "@/types/turno.types";

/**
 * Tarjeta «Pago» (mockup pág. 5), solo cuando la API envía `pagos` (rol con
 * `pagos:leer`; nunca el Profesor). HU-I-01 añade la acción autorizada y el
 * total de importes registrados solicitado por la referencia PDF, sin saldo
 * esperado ni validación de precio. La suma usa centavos enteros exactos.
 */
export function TurnoPagoCard({ pagos, accion }: { pagos: PagoRegistradoTurno[]; accion?: ReactNode }) {
  const centavos = pagos.reduce((total, pago) => {
    const [entero, decimal = ""] = pago.monto.split(".");
    return total + BigInt(entero) * BigInt(100) + BigInt(decimal.padEnd(2, "0"));
  }, BigInt(0));
  const total = `${centavos / BigInt(100)}.${String(centavos % BigInt(100)).padStart(2, "0")}`;
  return (
    <section aria-labelledby="pago-turno-titulo" className="space-y-3 rounded-md border border-border bg-card p-4 text-card-foreground sm:p-[22px]">
      <h2 id="pago-turno-titulo" className="text-sm font-semibold">Pago</h2>
      {accion}
      <div className="space-y-2">
        <h3 className="text-[10px] leading-4 uppercase tracking-wide text-muted-foreground">Pagos registrados</h3>
        {pagos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguno todavía.</p>
        ) : (
          <ul className="space-y-2" aria-label="Pagos registrados">
            {pagos.map((pago) => (
              <li key={pago.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-[13px] font-medium">{pago.alumno.nombre_completo}</p>
                  <p className="text-[11px] leading-4 text-muted-foreground">{fechaCorta(pago.fecha_pago)} · {pago.forma_pago.nombre}</p>
                </div>
                <span className="whitespace-nowrap text-right font-mono text-xs tabular-nums">{monto(pago.monto)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {pagos.length > 0 && <div className="flex justify-between gap-3 border-t border-border pt-2 text-xs font-semibold">
        <span>Total registrado</span><span className="whitespace-nowrap font-mono tabular-nums">{monto(total)}</span>
      </div>}
    </section>
  );
}
