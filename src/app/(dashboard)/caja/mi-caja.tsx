"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { toast } from "sonner";
import { CerrarCajaDialog } from "@/components/pagos/cerrar-caja-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fechaHoraCaja, montoConSigno, textoDiferenciaEnFrase } from "@/lib/caja";
import { texto } from "@/lib/textos";
import type { CajaPropiaDto, ItemCajaDto } from "@/types/caja.types";
import { AbrirCajaDialog } from "./abrir-caja-dialog";
import { ItemCajaBadge } from "./item-caja-badge";

/**
 * Estado de «Mi caja» (HU-I-12; fotos `“Mi caja” sin caja abierta.png`,
 * `Caja abierta (arqueo ciego).png`): sin caja, el estado vacío con «Abrir
 * caja»; con caja, la cabecera, la leyenda del arqueo ciego y la lista de
 * ítems con su monto individual, sin ningún total, y «Cerrar caja».
 * «Registrar movimiento» es de HU-I-12-b.
 */
export function MiCaja({ caja, puedeAbrir, puedeCerrar }: { caja: CajaPropiaDto | null; puedeAbrir: boolean; puedeCerrar: boolean }) {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  if (!caja) {
    return <section className="space-y-3 rounded-xl border border-border bg-card p-5 text-card-foreground" aria-labelledby="sin-caja-titulo">
      <h2 id="sin-caja-titulo" className="text-lg font-semibold">{texto("ui.caja.sinCajaAbierta.titulo")}</h2>
      <p className="text-sm text-muted-foreground">{texto("ui.caja.sinCajaAbierta.cuerpo")}</p>
      {puedeAbrir && <>
        <Button type="button" onClick={() => setAbriendo(true)}>
          <Banknote className="size-4" aria-hidden />
          {texto("ui.caja.abrir")}
        </Button>
        <AbrirCajaDialog abierto={abriendo} onCerrar={() => setAbriendo(false)} />
      </>}
    </section>;
  }

  return <>
    <section className="space-y-3 rounded-xl border border-border bg-card p-5 text-card-foreground" aria-labelledby="caja-abierta-titulo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="caja-abierta-titulo" className="text-lg font-semibold">{texto("ui.caja.abierta.titulo")}</h2>
          <p className="text-sm text-muted-foreground">
            {texto("ui.caja.abierta.desde", { fecha: fechaHoraCaja(caja.abierta_el), monto: montoConSigno(caja.fondo_inicial) })}
          </p>
        </div>
        {puedeCerrar && (
          <Button type="button" variant="outline" className="border-destructive text-destructive hover:bg-destructive-soft"
            onClick={() => setCerrando(true)}>
            {texto("ui.caja.cerrar")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{texto("ui.caja.abierta.arqueoCiego")}</p>
    </section>

    <section className="rounded-xl border border-border bg-card text-card-foreground" aria-labelledby="items-caja-titulo">
      <h2 id="items-caja-titulo" className="px-5 pt-5 pb-3 text-lg font-semibold">{texto("ui.caja.items.titulo")}</h2>
      {caja.items.length === 0
        ? <p className="px-5 pb-5 text-sm text-muted-foreground">{texto("ui.caja.items.vacio")}</p>
        : <TablaItems items={caja.items} />}
    </section>

    {puedeCerrar && (
      <CerrarCajaDialog
        abierto={cerrando}
        modo={{ tipo: "propia" }}
        efectivoDeclarado={caja.efectivo_declarado}
        onCerrar={() => {
          setCerrando(false);
          // Si se declaró el efectivo y se cerró el diálogo, la próxima vez entra directo al paso 2.
          router.refresh();
        }}
        onCerrada={(resultado) => {
          setCerrando(false);
          toast.success(texto("ui.caja.cerrar.exito", { diferencia: textoDiferenciaEnFrase(resultado.tipo_diferencia, resultado.diferencia) }));
          router.refresh();
        }}
      />
    )}
  </>;
}

/** Ítems de la caja abierta, del más nuevo al más viejo. Solo montos individuales: sin totales (arqueo ciego). */
function TablaItems({ items }: { items: ItemCajaDto[] }) {
  const encabezado = "px-3 py-2 text-xs font-medium uppercase text-muted-foreground";
  return <div className="overflow-x-auto pb-2">
    <table className="w-full min-w-[40rem] text-sm">
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className={`${encabezado} pl-5 text-left`}>{texto("ui.caja.items.hora")}</th>
          <th scope="col" className={`${encabezado} text-left`}>{texto("ui.caja.items.tipo")}</th>
          <th scope="col" className={`${encabezado} text-left`}>{texto("ui.caja.items.detalle")}</th>
          <th scope="col" className={`${encabezado} text-left`}>{texto("ui.caja.items.forma")}</th>
          <th scope="col" className={`${encabezado} pr-5 text-right`}>{texto("ui.caja.items.monto")}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const forma = item.tipo === "MOVIMIENTO" ? texto("ui.caja.item.efectivo") : item.forma_pago.nombre;
          const valor = item.tipo === "MOVIMIENTO" && item.movimiento === "EGRESO" ? `− ${montoConSigno(item.monto)}` : montoConSigno(item.monto);
          return <tr key={`${item.tipo}-${item.id}`} className={`border-b border-border last:border-b-0 ${item.anulado ? "text-muted-foreground" : ""}`}>
            <td className="px-3 py-3 pl-5 font-mono whitespace-nowrap">{fechaHoraCaja(item.momento)}</td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-1">
                <ItemCajaBadge item={item} />
                {item.anulado && <Badge variant="outline" className="border-destructive bg-card text-destructive">{texto("ui.caja.item.anulado")}</Badge>}
              </div>
            </td>
            <td className="px-3 py-3 break-words">{item.detalle}</td>
            <td className="px-3 py-3">{forma}</td>
            <td className={`px-3 py-3 pr-5 text-right font-mono whitespace-nowrap ${item.anulado ? "line-through" : ""}`}>{valor}</td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}
