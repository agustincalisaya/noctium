"use client";
import { useState } from "react";
import { GraficoIngresos, GraficoOcupacion } from "@/components/indicadores/graficos-indicadores";
import { PanelPresentismo } from "@/components/indicadores/presentismo-panel";
import { FiltroPeriodo } from "@/components/indicadores/filtro-periodo";
import { mesActualBuenosAires, desplazarMes } from "@/server/indicadores/indicadores.schema";
import { texto } from "@/lib/textos";
const PESTANAS=["actividad","presentismo","cancelaciones"] as const;
/** Un único período para el panel; las pestañas pendientes tienen extensión en sus propias HU. */
export function IndicadoresClient() {
  const [mesActual]=useState(()=>mesActualBuenosAires());
  const [rango,setRango]=useState(()=>({desde:desplazarMes(mesActual,-5),hasta:mesActual}));
  const [pestana,setPestana]=useState<typeof PESTANAS[number]>("actividad");
  return <div className="space-y-5">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div className="space-y-1"><h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">{texto("indicadores.titulo")}</h1><p className="max-w-2xl text-sm text-muted-foreground">{texto("indicadores.periodo")}</p></div>
      <FiltroPeriodo rango={rango} mesActual={mesActual} onChange={setRango}/>
    </div>
    <div role="tablist" aria-label={texto("indicadores.titulo")} className="flex gap-1 overflow-x-auto border-b border-border">
      {PESTANAS.map((nombre,i)=><button key={nombre} type="button" role="tab" id={`tab-${nombre}`} aria-controls={`panel-${nombre}`} aria-selected={pestana===nombre} tabIndex={pestana===nombre?0:-1} onClick={()=>setPestana(nombre)} onKeyDown={e=>{if (["ArrowRight","ArrowLeft","Home","End"].includes(e.key)){e.preventDefault();const siguiente=e.key==="Home"?0:e.key==="End"?2:(i+(e.key==="ArrowRight"?1:2))%3;setPestana(PESTANAS[siguiente]!);document.getElementById(`tab-${PESTANAS[siguiente]}`)?.focus();}}} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${pestana===nombre?"border-primary text-foreground":"border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"}`}>{texto(`indicadores.${nombre}`)}</button>)}
    </div>
    {PESTANAS.map(nombre=><section key={nombre} id={`panel-${nombre}`} role="tabpanel" aria-labelledby={`tab-${nombre}`} hidden={pestana!==nombre} tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {nombre==="actividad" && pestana===nombre && <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><GraficoIngresos rango={rango}/><GraficoOcupacion rango={rango}/></div>}
      {nombre==="presentismo" && pestana===nombre && <PanelPresentismo rango={rango}/>}
    </section>)}
  </div>;
}
