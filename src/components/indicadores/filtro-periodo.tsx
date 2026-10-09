"use client";
import { useState } from "react";
import { texto } from "@/lib/textos";
import { cantidadMesesInclusivos, desplazarMes } from "@/server/indicadores/indicadores.schema";
import type { RangoIndicador } from "@/components/indicadores/use-indicador";
export function ajustarPeriodo(rango: RangoIndicador, extremo: "desde" | "hasta", valor: string): RangoIndicador {
  const nuevo = { ...rango, [extremo]: valor };
  if (nuevo.desde > nuevo.hasta) nuevo[extremo === "desde" ? "hasta" : "desde"] = valor;
  if (cantidadMesesInclusivos(nuevo.desde, nuevo.hasta) > 24) {
    if (extremo === "desde") nuevo.hasta = desplazarMes(valor, 23);
    else nuevo.desde = desplazarMes(valor, -23);
  }
  return nuevo;
}
export function FiltroPeriodo({ rango, mesActual, onChange }: { rango: RangoIndicador; mesActual: string; onChange: (rango:RangoIndicador) => void }) {
  const [aviso, setAviso] = useState(false);
  const opciones = Array.from({length:27}, (_, i) => desplazarMes(mesActual, i - 23));
  const formato = new Intl.DateTimeFormat("es-AR", {month:"long",year:"numeric",timeZone:"UTC"});
  return <div className="w-full space-y-2 lg:w-auto">
    <div className="grid gap-2 sm:grid-cols-2">
      {(["desde", "hasta"] as const).map(extremo => <div key={extremo} className="flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3">
        <label htmlFor={`indicadores-${extremo}`} className="text-xs text-muted-foreground">{texto(extremo === "desde" ? "ui.indicadores.panel.desde" : "ui.indicadores.panel.hasta")}</label>
        <select id={`indicadores-${extremo}`} value={rango[extremo]} className="h-full min-w-0 flex-1 bg-transparent text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={evento => {const valor=evento.currentTarget.value;const nuevo=ajustarPeriodo(rango,extremo,valor);setAviso(nuevo[extremo === "desde" ? "hasta" : "desde"] !== rango[extremo === "desde" ? "hasta" : "desde"]);onChange(nuevo);}}>
          {opciones.map(mes => <option key={mes} value={mes}>{formato.format(new Date(`${mes}-01T12:00:00Z`))}</option>)}
        </select>
      </div>)}
    </div>
    {aviso && <p role="status" className="text-xs text-muted-foreground">{texto("ui.indicadores.panel.maximo")}</p>}
  </div>;
}
