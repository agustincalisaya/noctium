import Link from "next/link";
import { DiferenciaCajaBadge } from "@/components/pagos/diferencia-caja-badge";
import { Badge } from "@/components/ui/badge";
import { fechaHoraCaja, montoConSigno } from "@/lib/caja";
import { texto } from "@/lib/textos";
import type { CierreCajaFila } from "@/types/caja.types";

/**
 * Tabla de cierres de caja (HU-I-12 criterio 11): «Mis cierres» de mesa de
 * entrada y los cierres del gerente, que suman la columna Integrante. Cada
 * fila enlaza a su detalle con «Ver cierre».
 */
export function TablaCierresCaja({ cierres, conIntegrante = false, hrefDetalle }: {
  cierres: CierreCajaFila[];
  conIntegrante?: boolean;
  hrefDetalle: (id: string) => string;
}) {
  const encabezado = "px-3 py-2 text-xs font-medium uppercase text-muted-foreground";
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[48rem] text-sm">
      <thead>
        <tr className="border-b border-border">
          {conIntegrante && <th scope="col" className={`${encabezado} text-left`}>{texto("ui.caja.cierres.integrante")}</th>}
          <th scope="col" className={`${encabezado} text-left`}>{texto("ui.caja.cierres.apertura")}</th>
          <th scope="col" className={`${encabezado} text-left`}>{texto("ui.caja.cierres.cierre")}</th>
          <th scope="col" className={`${encabezado} text-right`}>{texto("ui.caja.cierres.fondo")}</th>
          <th scope="col" className={`${encabezado} text-right`}>{texto("ui.caja.cierres.esperado")}</th>
          <th scope="col" className={`${encabezado} text-right`}>{texto("ui.caja.cierres.declarado")}</th>
          <th scope="col" className={`${encabezado} text-left`}>{texto("ui.caja.cierres.diferencia")}</th>
          <th scope="col" className={`${encabezado} text-left`}>{texto("ui.caja.cierres.motivo")}</th>
          <th scope="col" className={encabezado}><span className="sr-only">{texto("ui.caja.cierres.verCierre")}</span></th>
        </tr>
      </thead>
      <tbody>
        {cierres.map((cierre) => <tr key={cierre.id} className="border-b border-border last:border-b-0 align-top">
          {conIntegrante && <td className="px-3 py-3 font-medium">{cierre.integrante.nombre_completo ?? texto("ui.caja.detalle.sinNombre")}</td>}
          <td className="px-3 py-3 font-mono whitespace-nowrap">{fechaHoraCaja(cierre.abierta_el)}</td>
          <td className="px-3 py-3 font-mono whitespace-nowrap">{fechaHoraCaja(cierre.cerrada_el)}</td>
          <td className="px-3 py-3 text-right font-mono whitespace-nowrap">{montoConSigno(cierre.fondo_inicial)}</td>
          <td className="px-3 py-3 text-right font-mono whitespace-nowrap">{montoConSigno(cierre.efectivo_esperado)}</td>
          <td className="px-3 py-3 text-right font-mono whitespace-nowrap">{montoConSigno(cierre.efectivo_declarado)}</td>
          <td className="px-3 py-3">
            <div className="flex flex-col items-start gap-1">
              <DiferenciaCajaBadge tipo={cierre.tipo_diferencia} diferencia={cierre.diferencia} />
              {cierre.por_ausencia && <Badge variant="muted">{texto("ui.caja.cierres.porAusencia")}</Badge>}
            </div>
          </td>
          <td className="max-w-56 px-3 py-3 break-words">{cierre.motivo ?? "—"}</td>
          <td className="px-3 py-3 text-right whitespace-nowrap">
            <Link href={hrefDetalle(cierre.id)} className="font-medium underline underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">
              {texto("ui.caja.cierres.verCierre")}
            </Link>
          </td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
