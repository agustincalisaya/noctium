"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CerrarCajaDialog } from "@/components/pagos/cerrar-caja-dialog";
import { Button } from "@/components/ui/button";
import { antiguedad, fechaHoraCaja, textoDiferenciaEnFrase } from "@/lib/caja";
import { texto } from "@/lib/textos";
import type { CajaAbiertaFila } from "@/types/caja.types";

/**
 * «Cajas abiertas» del gerente (HU-I-12 criterio 10; spec_modulo_I.md
 * §2.12): integrante, desde cuándo y antigüedad, sin el contenido (el arqueo
 * es ciego también para él). La única acción es «Cierre por ausencia», que
 * reutiliza el cierre en dos pasos sobre las rutas `/api/cajas/[id]/ausencia`.
 */
export function CajasAbiertas({ abiertas, puedeCerrarPorAusencia }: { abiertas: CajaAbiertaFila[]; puedeCerrarPorAusencia: boolean }) {
  const router = useRouter();
  const [cerrando, setCerrando] = useState<CajaAbiertaFila | null>(null);
  const nombre = (fila: CajaAbiertaFila) => fila.integrante.nombre_completo ?? texto("ui.caja.detalle.sinNombre");
  const encabezado = "px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground";

  return <section className="rounded-xl border border-border bg-card text-card-foreground" aria-labelledby="cajas-abiertas-titulo">
    <h2 id="cajas-abiertas-titulo" className="px-5 pt-5 pb-3 text-lg font-semibold">{texto("ui.cajas.abiertas.titulo")}</h2>
    {abiertas.length === 0 ? (
      <p className="px-5 pb-5 text-sm text-muted-foreground">{texto("ui.cajas.abiertas.vacio")}</p>
    ) : (
      <div className="overflow-x-auto pb-2">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={`${encabezado} pl-5`}>{texto("ui.caja.cierres.integrante")}</th>
              <th scope="col" className={encabezado}>{texto("ui.cajas.abiertas.desde")}</th>
              <th scope="col" className={encabezado}>{texto("ui.cajas.abiertas.antiguedad")}</th>
              <th scope="col" className={encabezado}><span className="sr-only">{texto("ui.cajas.abiertas.cierrePorAusencia")}</span></th>
            </tr>
          </thead>
          <tbody>
            {abiertas.map((fila) => <tr key={fila.id} className="border-b border-border last:border-b-0">
              <td className="px-3 py-3 pl-5 font-medium">{nombre(fila)}</td>
              <td className="px-3 py-3 font-mono whitespace-nowrap">{fechaHoraCaja(fila.abierta_el)}</td>
              <td className="px-3 py-3">{antiguedad(fila.antiguedad_minutos)}</td>
              <td className="px-3 py-3 pr-5 text-right">
                {puedeCerrarPorAusencia && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setCerrando(fila)}>
                    {texto("ui.cajas.abiertas.cierrePorAusencia")}
                  </Button>
                )}
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    )}

    {cerrando && (
      <CerrarCajaDialog
        abierto
        modo={{ tipo: "ausencia", cajaId: cerrando.id, integrante: nombre(cerrando) }}
        // El gerente no ve si ya hay un monto declarado: si lo hay, el paso 1 responde EFECTIVO_YA_DECLARADO y el diálogo pasa al resumen.
        efectivoDeclarado={null}
        onCerrar={() => { setCerrando(null); router.refresh(); }}
        onCerrada={(resultado) => {
          const integrante = nombre(cerrando);
          setCerrando(null);
          toast.success(texto("ui.caja.cerrar.exitoAusencia", {
            integrante, diferencia: textoDiferenciaEnFrase(resultado.tipo_diferencia, resultado.diferencia),
          }));
          router.refresh();
        }}
      />
    )}
  </section>;
}
