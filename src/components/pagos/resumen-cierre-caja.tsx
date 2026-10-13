import { DiferenciaCajaBadge } from "@/components/pagos/diferencia-caja-badge";
import { montoConSigno } from "@/lib/caja";
import { texto } from "@/lib/textos";
import type { ResumenCajaDto } from "@/types/caja.types";

/**
 * Resumen del cierre (HU-I-12 criterio 6; spec_modulo_I.md §2.11): fondo,
 * cobros por forma con cantidad y total, ingresos y egresos manuales,
 * ajustes, efectivo esperado y declarado, y la diferencia. Las formas que no
 * son efectivo se informan con «(no entra en el arqueo)». Mismo componente
 * para el paso 2 del cierre propio, el cierre por ausencia y el detalle de un
 * cierre ya hecho (el `resumen` fijo que guardó el cierre).
 */
export function ResumenCierreCaja({ resumen }: { resumen: ResumenCajaDto }) {
  const filas: { etiqueta: React.ReactNode; valor: string; fuerte?: boolean }[] = [
    { etiqueta: texto("ui.caja.resumen.fondo"), valor: montoConSigno(resumen.fondo_inicial) },
    ...resumen.cobros_por_forma.map((cobro) => ({
      etiqueta: <>
        {cobro.cantidad === 1
          ? texto("ui.caja.resumen.cobrosUno", { forma: cobro.forma_pago.nombre })
          : texto("ui.caja.resumen.cobrosVarios", { forma: cobro.forma_pago.nombre, cantidad: cobro.cantidad })}
        {!cobro.forma_pago.es_efectivo && <span className="ml-1 text-xs text-muted-foreground">{texto("ui.caja.resumen.noEntra")}</span>}
      </>,
      valor: montoConSigno(cobro.total),
    })),
    { etiqueta: texto("ui.caja.resumen.ingresos"), valor: montoConSigno(resumen.ingresos_manuales) },
    { etiqueta: texto("ui.caja.resumen.egresos"), valor: `− ${montoConSigno(resumen.egresos_manuales)}` },
    ...resumen.ajustes.map((ajuste) => ({
      etiqueta: <>
        {texto("ui.caja.resumen.ajustes", { forma: ajuste.forma_pago.nombre })}
        {!ajuste.forma_pago.es_efectivo && <span className="ml-1 text-xs text-muted-foreground">{texto("ui.caja.resumen.noEntra")}</span>}
      </>,
      valor: montoConSigno(ajuste.total),
    })),
    { etiqueta: texto("ui.caja.resumen.esperado"), valor: montoConSigno(resumen.efectivo_esperado), fuerte: true },
    ...(resumen.efectivo_declarado !== null
      ? [{ etiqueta: texto("ui.caja.resumen.declarado"), valor: montoConSigno(resumen.efectivo_declarado), fuerte: true }]
      : []),
  ];

  return <div className="space-y-3" data-testid="resumen-cierre-caja">
    <table className="w-full text-sm">
      <tbody>
        {filas.map((fila, i) => <tr key={i} className="border-b border-border last:border-b-0">
          <th scope="row" className={`py-2 pr-3 text-left ${fila.fuerte ? "font-semibold" : "font-normal"}`}>{fila.etiqueta}</th>
          <td className={`py-2 text-right font-mono whitespace-nowrap ${fila.fuerte ? "font-semibold" : ""}`}>{fila.valor}</td>
        </tr>)}
      </tbody>
    </table>
    {resumen.tipo_diferencia !== null && resumen.diferencia !== null && (
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium uppercase text-muted-foreground">{texto("ui.caja.resumen.diferencia")}</span>
        <DiferenciaCajaBadge tipo={resumen.tipo_diferencia} diferencia={resumen.diferencia} />
      </p>
    )}
    <p className="text-xs text-muted-foreground">{texto("ui.caja.resumen.formula")}</p>
  </div>;
}
