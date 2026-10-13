import Link from "next/link";
import { PagoAcciones } from "@/components/pagos/pago-acciones";
import { Badge } from "@/components/ui/badge";
import { texto } from "@/lib/textos";
import { fechaCorta, monto } from "@/lib/turno-detalle";
import type { PagoRegistradoTurno } from "@/types/turno.types";

/**
 * Tarjeta «Pago» (mockup pág. 5), solo cuando la API envía `pagos` (rol con
 * `pagos:leer`; nunca el Profesor). Muestra los pagos y el total de importes
 * registrados solicitado por la referencia PDF, sin saldo esperado ni
 * validación de precio. La suma usa centavos enteros exactos.
 * HU-I-06: cada pago lleva sus acciones (Corregir, Anular, Ver detalle); un
 * pago anulado se muestra tachado con «Anulado» y no suma en el total.
 */
export function TurnoPagoCard({ pagos, claseEtiqueta, onCambio }: {
  pagos: PagoRegistradoTurno[];
  /** «Materia del Día dd/mm», para los títulos de los diálogos de HU-I-06. */
  claseEtiqueta: string;
  /** Recarga el detalle después de corregir o anular. */
  onCambio: () => void;
}) {
  const centavos = pagos.filter((pago) => !pago.anulado).reduce((total, pago) => {
    const [entero, decimal = ""] = pago.monto.split(".");
    return total + BigInt(entero) * BigInt(100) + BigInt(decimal.padEnd(2, "0"));
  }, BigInt(0));
  const total = `${centavos / BigInt(100)}.${String(centavos % BigInt(100)).padStart(2, "0")}`;
  return (
    <section aria-labelledby="pago-turno-titulo" className="space-y-3 rounded-md border border-border bg-card p-4 text-card-foreground sm:p-[22px]">
      <h2 id="pago-turno-titulo" className="text-sm font-semibold">Pago</h2>
      <div className="space-y-2">
        <h3 className="text-[10px] leading-4 uppercase tracking-wide text-muted-foreground">Pagos registrados</h3>
        {pagos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguno todavía.</p>
        ) : (
          <ul className="space-y-2" aria-label="Pagos registrados">
            {pagos.map((pago) => (
              <li key={pago.id} className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`min-w-0 ${pago.anulado ? "text-muted-foreground" : ""}`}>
                    <p className="break-words text-[13px] font-medium">{pago.alumno.nombre_completo}</p>
                    <p className="text-[11px] leading-4 text-muted-foreground">{fechaCorta(pago.fecha_pago)} · {pago.forma_pago.nombre}</p>
                    {pago.comprobante && (
                      <Link href={`/comprobantes/${pago.comprobante.id}`}
                        className="text-[11px] leading-4 text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-ring">
                        {texto("ui.pagos.comprobanteNumero", { numero: pago.comprobante.numero })}
                      </Link>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`whitespace-nowrap text-right font-mono text-xs tabular-nums ${pago.anulado ? "text-muted-foreground line-through" : ""}`}>{monto(pago.monto)}</span>
                    {pago.anulado && <Badge variant="muted">{texto("ui.pagos.correccion.anulado")}</Badge>}
                  </div>
                </div>
                <PagoAcciones pago={pago} alumnoNombre={pago.alumno.nombre_completo} claseEtiqueta={claseEtiqueta} onActualizado={onCambio} />
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
