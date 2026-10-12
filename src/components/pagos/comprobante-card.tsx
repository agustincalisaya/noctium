"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { texto } from "@/lib/textos";
import { fechaCorta, fechaHoraDeInstante, monto } from "@/lib/turno-detalle";
import type { ComprobanteLeido } from "@/types/pago.types";

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <p className="text-sm">
      <span className="font-semibold">{etiqueta}:</span> {children}
    </p>
  );
}

/**
 * Comprobante de pago (HU-I-11, spec_modulo_I.md §2.9, imagen 1 de la HU):
 * lo comparten la vista de mesa de entrada/gerente y la del alumno. Muestra
 * la copia fija tal como llega, sin recalcular nada, y las marcas derivadas.
 * El atributo `data-comprobante` activa la hoja de impresión de globals.css,
 * que deja visible solo esta tarjeta.
 */
export function ComprobanteCard({ comprobante }: { comprobante: ComprobanteLeido }) {
  const router = useRouter();
  const { centro, marcas } = comprobante;
  const registradoPor = comprobante.registrado_en_el_centro
    ? texto("ui.comprobantes.registradoEnElCentro")
    : comprobante.registrado_por ?? texto("ui.comprobantes.registradoPorSinDato");

  return (
    <section data-comprobante aria-labelledby="comprobante-titulo"
      className="mx-auto w-full max-w-3xl space-y-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6 print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <h1 id="comprobante-titulo" className="text-lg font-semibold">{texto("ui.comprobantes.titulo", { numero: comprobante.numero })}</h1>
        <button type="button" onClick={() => router.back()} aria-label={texto("ui.comprobantes.cerrarAria")}
          className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring print:hidden">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="space-y-5 rounded-md border border-border p-4 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-semibold break-words">{centro.nombre}</p>
            <p className="text-sm text-muted-foreground">{centro.domicilio} · {texto("ui.comprobantes.telefono", { telefono: centro.telefono })}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-semibold">{texto("ui.comprobantes.tipo")}</p>
            <p className="font-mono text-sm tabular-nums">{texto("ui.comprobantes.numero", { numero: comprobante.numero })}</p>
          </div>
        </div>

        <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <Dato etiqueta={texto("ui.comprobantes.fechaPago")}>{fechaCorta(comprobante.fecha_pago)}</Dato>
          <Dato etiqueta={texto("ui.comprobantes.emitido")}>{fechaHoraDeInstante(comprobante.emitido_el)}</Dato>
          <Dato etiqueta={texto("ui.comprobantes.alumno")}>{comprobante.alumno.nombre_completo}</Dato>
          <Dato etiqueta={texto("ui.comprobantes.dni")}>{comprobante.alumno.dni}</Dato>
          <Dato etiqueta={texto("ui.comprobantes.formaPago")}>{comprobante.forma_pago.nombre}</Dato>
          {comprobante.registrado_en_el_centro
            ? <p className="text-sm">{registradoPor}</p>
            : <Dato etiqueta={texto("ui.comprobantes.registradoPor")}>{registradoPor}</Dato>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b-2 border-foreground/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-2 py-2 font-medium">{texto("ui.comprobantes.materia")}</th>
                <th scope="col" className="px-2 py-2 font-medium">{texto("ui.comprobantes.fecha")}</th>
                <th scope="col" className="px-2 py-2 font-medium">{texto("ui.comprobantes.hora")}</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">{texto("ui.comprobantes.monto")}</th>
              </tr>
            </thead>
            <tbody>
              {comprobante.clases.map((clase, i) => (
                <tr key={`${clase.fecha}-${clase.hora_inicio}-${i}`} className="border-b border-border">
                  <td className="px-2 py-2">{clase.materia}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{fechaCorta(clase.fecha)}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{clase.hora_inicio}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums whitespace-nowrap">{monto(clase.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <th scope="row" className="px-2 py-2 text-left">{texto("ui.comprobantes.total")}</th>
                <td colSpan={3} className="px-2 py-2 text-right font-mono tabular-nums whitespace-nowrap">{monto(comprobante.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="border-t border-dashed border-foreground/50 pt-3 text-xs">{texto("ui.comprobantes.leyenda")}</p>

        {(marcas.anulado || marcas.reemplazado_por || marcas.reemplaza_a) && (
          <div className="space-y-2" data-testid="marcas-comprobante">
            {marcas.anulado && (
              <div className="rounded-md border border-destructive bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
                <p className="font-bold tracking-wide">{texto("ui.comprobantes.anulado")}</p>
                <p>{texto("ui.comprobantes.anuladoFecha", { fecha: fechaCorta(marcas.anulado.fecha) })}</p>
                {marcas.anulado.motivo && <p>{texto("ui.comprobantes.motivo", { motivo: marcas.anulado.motivo })}</p>}
              </div>
            )}
            {marcas.reemplazado_por && (
              <p className="rounded-md bg-warning px-3 py-2 text-sm font-medium text-warning-foreground">
                {texto("ui.comprobantes.reemplazadoPor", { numero: marcas.reemplazado_por.numero })}
              </p>
            )}
            {marcas.reemplaza_a && (
              <p className="text-xs text-muted-foreground">{texto("ui.comprobantes.reemplazaA", { numero: marcas.reemplaza_a.numero })}</p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground print:hidden">{texto("ui.comprobantes.ayudaImprimir")}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end print:hidden">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          {texto("ui.comprobantes.imprimir")}
        </Button>
        <Button type="button" onClick={() => router.back()}>{texto("ui.comprobantes.cerrar")}</Button>
      </div>
    </section>
  );
}
