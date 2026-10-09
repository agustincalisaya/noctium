"use client";
import { useEffect, useRef, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { texto } from "@/lib/textos";
export type DatoIndicador = Record<string, string | number | null>;
export type SerieIndicador = { clave: string; etiqueta: string; unidad: string; tipo: "barra" | "linea"; color: string; ejePorcentaje?: boolean };
export type GraficoIndicadorProps = {
  id: string; titulo: string; total: string; leyendaFecha: string; datos: DatoIndicador[]; series: SerieIndicador[];
  claveCategoria?: string; anchoCategoria?: number; orientacion?: "vertical" | "horizontal"; formatearValor?: (valor:number,clave:string)=>string;
  formatearCategoria?: (valor:string,indice:number)=>string; estado: "cargando" | "error" | "vacio" | "ok";
  onReintentar?: ()=>void; textoVacio?:string; error?:string|null; mensual?:boolean; diferenciaClave?:string; diferenciaEtiqueta?:string;
  referencia?: {valor:number;etiqueta:string};
};
const compacto = new Intl.NumberFormat("es-AR", {notation:"compact",maximumFractionDigits:1});
export function GraficoIndicador({id,titulo,total,leyendaFecha,datos,series,claveCategoria="mes",anchoCategoria=150,orientacion="vertical",formatearValor=(v)=>String(v),formatearCategoria=(v)=>v,estado,onReintentar,textoVacio,error,mensual=false,diferenciaClave,diferenciaEtiqueta=texto("indicadores.panel.ausentes"),referencia}:GraficoIndicadorProps) {
  const [tabla,setTabla] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const [desborda,setDesborda] = useState(false);
  const horizontal = orientacion === "horizontal";
  const largo = mensual && datos.length > 12;
  const anchoMinimo = mensual ? datos.length * Math.max(64, series.filter(s=>s.tipo==="barra").length * 26 + 24) : 0;
  const config = Object.fromEntries(series.map(s=>[s.clave,{label:s.etiqueta,color:s.color}])) as ChartConfig;
  useEffect(()=>{
    const elemento=scroll.current;
    if (!elemento) return;
    const medir=()=>{const excede=elemento.scrollWidth>elemento.clientWidth+1;setDesborda(excede);elemento.scrollLeft=elemento.scrollWidth;};
    medir(); const observer=new ResizeObserver(medir); observer.observe(elemento);return ()=>observer.disconnect();
  },[datos,tabla,estado]);
  const etiquetas = (valor: unknown, clave:string) => valor == null ? "" : largo || (series.find(s=>s.clave===clave)?.unidad === "pesos" && Math.abs(Number(valor)) >= 10_000) ? (series.find(s=>s.clave===clave)?.ejePorcentaje || series.find(s=>s.clave===clave)?.unidad === "%" ? `${Math.round(Number(valor))}%` : compacto.format(Number(valor))) : formatearValor(Number(valor),clave);
  const categoriaExacta=(valor:string,indice:number)=>mensual && /^\d{4}-\d{2}$/.test(valor) ? new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${valor}-01T12:00:00Z`)) : formatearCategoria(valor,indice);
  const barras=series.filter(s=>s.tipo==="barra");
  return <Card aria-labelledby={`${id}-titulo`} aria-busy={estado==="cargando"} role="region" className={largo?"min-w-0 lg:col-span-2":"min-w-0"}>
    <CardHeader className="gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle id={`${id}-titulo`} className="text-lg font-semibold">{titulo}</CardTitle><p className="mt-1 text-xl font-semibold tabular-nums">{estado==="ok" ? total : "—"}</p></div>
        <button type="button" aria-pressed={tabla} onClick={()=>setTabla(v=>!v)} className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{texto("indicadores.panel.tabla")}</button>
      </div><CardDescription>{leyendaFecha}</CardDescription>
    </CardHeader>
    <CardContent>
      {estado==="cargando" && <div role="status" aria-label={texto("indicadores.panel.cargando",{titulo})}><Skeleton className="h-64 w-full" /></div>}
      {estado==="error" && <div role="alert" className="space-y-3 rounded-md bg-destructive-soft p-4 text-sm text-destructive-soft-foreground"><p>{error || texto("indicadores.panel.error")}</p><button type="button" onClick={onReintentar} className="rounded-md border border-current px-3 py-2 font-medium focus-visible:ring-2 focus-visible:ring-ring">{texto("indicadores.panel.reintentar")}</button></div>}
      {estado==="vacio" && <p role="status" className="py-16 text-center text-sm text-muted-foreground">{textoVacio || texto("indicadores.panel.vacio")}</p>}
      {estado==="ok" && <>
        <div ref={scroll} className={tabla?"hidden":"overflow-x-auto overscroll-x-contain"} tabIndex={desborda?0:undefined} aria-label={desborda?titulo:undefined}>
          <div style={{minWidth:anchoMinimo || undefined}}>
            <ChartContainer config={config} className="aspect-auto w-full" style={{height:horizontal?Math.max(260,datos.length*68):280}}>
              <ComposedChart accessibilityLayer data={datos} layout={horizontal?"vertical":"horizontal"} margin={{top:30,right:horizontal?80:24,left:8,bottom:4}}>
                <CartesianGrid vertical={horizontal} horizontal={!horizontal}/>
                {horizontal ? <><XAxis type="number" tickLine={false} axisLine={false}/><YAxis type="category" dataKey={claveCategoria} width={anchoCategoria} tickLine={false} axisLine={false} tick={(props)=>{const valor=String(props.payload?.value??"");const etiqueta=formatearCategoria(valor,datos.findIndex(d=>d[claveCategoria]===valor));const lineas=etiqueta.split(" · ").flatMap(parte=>parte.match(/.{1,24}(?:\s|$)|\S{1,24}/g)??[parte]);return <text x={props.x} y={props.y} textAnchor="end" fill="var(--foreground)" fontSize={11}>{lineas.map((linea,i)=><tspan x={props.x} dy={i===0 ? -((lineas.length-1)*7) : 14} key={i}>{linea.trim()}</tspan>)}</text>;}}/></> : <><XAxis dataKey={claveCategoria} tickLine={false} axisLine={false} tickMargin={10} interval={0} tickFormatter={(v)=>formatearCategoria(String(v),datos.findIndex(d=>d[claveCategoria]===v))}/><YAxis yAxisId="cantidad" tickLine={false} axisLine={false} width={60} tickFormatter={v=>series.every(s=>s.unidad==="%")?`${v}%`:compacto.format(Number(v))} domain={series.every(s=>s.unidad==="%")?[0,100]:undefined}/></>}
                {!horizontal && series.some(s=>s.ejePorcentaje) && <YAxis yAxisId="porcentaje" orientation="right" domain={[0,100]} ticks={[0,25,50,75,100]} tickFormatter={v=>`${v}%`} width={44}/>}
                {referencia && <ReferenceLine y={referencia.valor} yAxisId={horizontal?undefined:"cantidad"} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{value:referencia.etiqueta,position:"insideTopRight",fill:"var(--muted-foreground)",fontSize:12}}/>}
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_,payload)=>categoriaExacta(String(payload?.[0]?.payload?.[claveCategoria]??""),datos.findIndex(d=>d[claveCategoria]===payload?.[0]?.payload?.[claveCategoria]))} formatter={(v,name)=><span className="flex w-full justify-between gap-4"><span>{series.find(s=>s.clave===name)?.etiqueta}</span><span className="font-medium tabular-nums">{v==null?"—":formatearValor(Number(v),String(name))}</span></span>}/>} />
                {series.map(s=>s.tipo==="barra" ? <Bar key={s.clave} dataKey={s.clave} name={s.clave} yAxisId={horizontal?undefined:"cantidad"} fill={s.color} maxBarSize={26} radius={horizontal?[0,3,3,0]:[3,3,0,0]}>
                  <LabelList dataKey={(fila: DatoIndicador)=>mensual && Number(fila[s.clave])===0 && !series.some(serie=>serie.unidad!=="%" && Number(fila[serie.clave])>0) ? null : fila[s.clave]} position={horizontal?"right":"top"} formatter={v=>etiquetas(v,s.clave)} fill="var(--foreground)" fontSize={11}/>
                  {diferenciaClave && s.clave===barras[0]?.clave && <LabelList dataKey={diferenciaClave} position={horizontal?"right":"top"} offset={24} formatter={v=>v==null?"":`${diferenciaEtiqueta}: ${v}`} fill="var(--muted-foreground)" fontSize={11}/>}
                </Bar> : <Line key={s.clave} dataKey={s.clave} name={s.clave} yAxisId={horizontal?undefined:s.ejePorcentaje?"porcentaje":"cantidad"} type="linear" stroke={s.color} strokeWidth={2} dot={{r:3}} connectNulls={false}>
                  <LabelList dataKey={(fila: DatoIndicador)=>mensual && Number(fila[s.clave])===0 && !series.some(serie=>serie.unidad!=="%" && Number(fila[serie.clave])>0) ? null : fila[s.clave]} position="top" formatter={v=>etiquetas(v,s.clave)} fill="var(--foreground)" fontSize={11}/>
                </Line>)}
              </ComposedChart>
            </ChartContainer>
          </div>
        </div>
        {!tabla && <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">{series.map(s=><span key={s.clave} className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{background:s.color}}/>{s.etiqueta} ({s.unidad})</span>)}</div>}
        {!tabla && desborda && <p className="mt-3 text-xs text-muted-foreground">{texto("indicadores.panel.scroll")}</p>}
      </>}
      <div className={tabla?"overflow-x-auto":"sr-only"}>
        <table className="w-full text-left text-sm tabular-nums"><caption className="sr-only">{titulo}</caption><thead className="border-b border-border"><tr><th scope="col" className="px-3 py-2">{mensual?texto("indicadores.panel.mes"):titulo}</th>{series.map(s=><th scope="col" key={s.clave} className="px-3 py-2">{s.etiqueta} ({s.unidad})</th>)}{diferenciaClave && !series.some(s=>s.clave===diferenciaClave) && <th scope="col" className="px-3 py-2">{diferenciaEtiqueta}</th>}</tr></thead><tbody>{estado==="ok" && datos.map((fila,i)=><tr key={String(fila[claveCategoria])} className="border-b border-border"><th scope="row" className="px-3 py-2 font-medium">{categoriaExacta(String(fila[claveCategoria]),i)}</th>{series.map(s=><td key={s.clave} className="px-3 py-2">{fila[s.clave]==null?"—":formatearValor(Number(fila[s.clave]),s.clave)}</td>)}{diferenciaClave && !series.some(s=>s.clave===diferenciaClave) && <td className="px-3 py-2">{fila[diferenciaClave]}</td>}</tr>)}</tbody></table>
      </div>
    </CardContent>
  </Card>;
}
