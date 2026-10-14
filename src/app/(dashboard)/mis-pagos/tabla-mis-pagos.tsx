import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { texto } from "@/lib/textos";
import { diaAbreviadoYFecha, fechaCorta, monto } from "@/lib/turno-detalle";
import type { MisPagoItem } from "@/types/pago.types";

/**
 * Tabla de «Mis pagos» (HU-I-05, foto «Mis pagos»): solo consulta. Un pago
 * anulado se atenúa, tacha el monto y lleva «Anulado» con el aspecto de
 * «Cancelado» (DESIGN §6.5); su comprobante sigue disponible. El número abre
 * la vista propia por id de pago (`/mis-pagos/{pago_id}/comprobante`).
 */
export function TablaMisPagos({ items }: { items: MisPagoItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">{texto("ui.pagos.propios.tabla")}</caption>
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">{texto("ui.pagos.propios.columna.fecha")}</th>
            <th scope="col" className="px-4 py-3 font-medium">{texto("ui.pagos.propios.columna.clase")}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{texto("ui.pagos.propios.columna.monto")}</th>
            <th scope="col" className="px-4 py-3 font-medium">{texto("ui.pagos.propios.columna.forma")}</th>
            <th scope="col" className="px-4 py-3 font-medium">{texto("ui.pagos.propios.columna.comprobante")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((pago) => (
            <tr key={pago.pago_id} data-anulado={pago.anulado || undefined} className={pago.anulado ? "text-muted-foreground" : undefined}>
              <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums">{fechaCorta(pago.fecha_pago)}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className="font-medium">{pago.clase.materia.nombre}</span>{" "}
                <span className="font-mono tabular-nums">{diaAbreviadoYFecha(pago.clase.fecha)}</span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                {pago.anulado && (
                  <Badge variant="outline" className="mr-2 border-destructive bg-card text-destructive">{texto("ui.pagos.correccion.anulado")}</Badge>
                )}
                <span className={`font-mono tabular-nums ${pago.anulado ? "line-through" : ""}`}>{monto(pago.monto)}</span>
              </td>
              <td className="whitespace-nowrap px-4 py-3">{pago.forma_pago.nombre}</td>
              <td className="whitespace-nowrap px-4 py-3">
                {pago.comprobante ? (
                  <Link href={`/mis-pagos/${encodeURIComponent(pago.pago_id)}/comprobante`}
                    aria-label={texto("ui.pagos.propios.verComprobante", { numero: pago.comprobante.numero })}
                    className="rounded-sm font-mono text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
                    {pago.comprobante.numero}
                  </Link>
                ) : texto("ui.pagos.propios.sinComprobante")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
