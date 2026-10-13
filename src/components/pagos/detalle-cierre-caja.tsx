"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { ResumenCierreCaja } from "@/components/pagos/resumen-cierre-caja";
import { Button, buttonVariants } from "@/components/ui/button";
import { fechaHoraCaja } from "@/lib/caja";
import { texto } from "@/lib/textos";
import type { DetalleCierreDto } from "@/types/caja.types";

/**
 * Detalle de un cierre de caja (HU-I-12 criterio 8; spec_modulo_I.md §2.12):
 * datos del centro, integrante, apertura y cierre, el resumen fijo del
 * cierre, la diferencia, el motivo y —solo al imprimir— la fecha de impresión.
 * «Imprimir» llama a `window.print()`; la regla `@media print` de
 * `globals.css` deja visible solo `[data-cierre-caja]` (mismo mecanismo que el
 * comprobante de HU-I-11), sin menú ni el resto de la pantalla.
 */
export function DetalleCierreCaja({ cierre, hrefVolver }: { cierre: DetalleCierreDto; hrefVolver: string }) {
  // La fecha de impresión la arma el cliente (§2.12), después de hidratar.
  const [impresoEl, setImpresoEl] = useState("");
  useEffect(() => {
    const actualizar = () => setImpresoEl(fechaHoraCaja(new Date().toISOString()));
    actualizar();
    window.addEventListener("beforeprint", actualizar);
    return () => window.removeEventListener("beforeprint", actualizar);
  }, []);
  const integrante = cierre.integrante.nombre_completo ?? texto("ui.caja.detalle.sinNombre");

  return <article data-cierre-caja
    className="mx-auto w-full max-w-3xl space-y-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6 print:max-w-none print:border-0 print:p-0 print:shadow-none">
    <header className="space-y-1 border-b border-border pb-3">
      <p className="text-sm font-semibold">{cierre.centro.nombre}</p>
      <p className="text-xs text-muted-foreground">
        {cierre.centro.domicilio}{cierre.centro.telefono && <> · {texto("ui.caja.detalle.telefono", { telefono: cierre.centro.telefono })}</>}
      </p>
    </header>
    <div className="space-y-1">
      <h1 className="text-xl font-semibold">{texto("ui.caja.detalle.titulo", { integrante })}</h1>
      <p className="text-sm text-muted-foreground">
        {texto("ui.caja.detalle.periodo", { apertura: fechaHoraCaja(cierre.abierta_el), cierre: fechaHoraCaja(cierre.cerrada_el) })}
      </p>
      {cierre.por_ausencia && (
        <p className="text-sm text-muted-foreground">
          {texto("ui.caja.detalle.porAusencia", { gerente: cierre.cerrada_por?.nombre_completo ?? "—" })}
        </p>
      )}
    </div>

    <ResumenCierreCaja resumen={cierre.resumen} />

    <div className="space-y-1">
      <p className="text-xs font-medium uppercase text-muted-foreground">{texto("ui.caja.detalle.motivo")}</p>
      <p className="text-sm break-words">{cierre.motivo ?? "—"}</p>
    </div>

    <p className="hidden text-xs text-muted-foreground print:block" data-testid="fecha-impresion">
      {texto("ui.caja.detalle.fechaImpresion", { fecha: impresoEl })}
    </p>
    <p className="text-xs text-muted-foreground print:hidden">{texto("ui.caja.detalle.ayudaImprimir")}</p>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end print:hidden">
      <Link href={hrefVolver} className={buttonVariants({ variant: "outline" })}>{texto("ui.caja.detalle.volver")}</Link>
      <Button type="button" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden />
        {texto("ui.caja.detalle.imprimir")}
      </Button>
    </div>
  </article>;
}
