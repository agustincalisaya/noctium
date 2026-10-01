import { fechaCorta, monto } from "@/lib/turno-detalle";
import type { PagoRegistradoTurno } from "@/types/turno.types";

/**
 * Tarjeta «Pago» (mockup pág. 5), solo cuando la API envía `pagos` (rol con
 * `pagos:leer`; nunca el Profesor). Lista los pagos registrados sin total
 * (decisión del PO, 30/09). «Registrar pago» se agrega en el hito 3 (HU-I-01).
 */
export function TurnoPagoCard({ pagos }: { pagos: PagoRegistradoTurno[] }) {
  return (
    <section aria-labelledby="pago-turno-titulo" className="space-y-4 rounded-md border border-border bg-card p-5 text-card-foreground">
      <h2 id="pago-turno-titulo" className="text-lg font-semibold">Pago</h2>
      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pagos registrados</h3>
        {pagos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguno todavía.</p>
        ) : (
          <ul className="divide-y divide-border" aria-label="Pagos registrados">
            {pagos.map((pago) => (
              <li key={pago.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{pago.alumno.nombre_completo}</p>
                  <p className="text-sm text-muted-foreground">{fechaCorta(pago.fecha_pago)} · {pago.forma_pago.nombre}</p>
                </div>
                <span className="whitespace-nowrap text-right text-sm font-medium">{monto(pago.monto)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
