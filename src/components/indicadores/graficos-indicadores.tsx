"use client";
import { GraficoIndicador } from "@/components/indicadores/grafico-indicador";
import { useIndicador, type RangoIndicador } from "@/components/indicadores/use-indicador";
import type { IngresoMes, OcupacionMes, ResumenOcupacion } from "@/types/indicadores.types";
import { texto } from "@/lib/textos";
export const META_OCUPACION_PORCENTAJE = 80;
const MESES=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
export function etiquetaMesCorta(mes:string,indice=0):string { return `${MESES[Number(mes.slice(5,7))-1]}${indice===0 || mes.endsWith("-01") ? ` ’${mes.slice(2,4)}`:""}`; }
export function etiquetaMesLarga(mes:string):string { return new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${mes}-01T12:00:00Z`)); }
export const formatearMoneda=(v:number)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:2}).format(v);
export const formatearPorcentaje=(v:number)=>`${new Intl.NumberFormat("es-AR",{minimumFractionDigits:1,maximumFractionDigits:1}).format(v)}%`;
export function GraficoIngresos({rango}:{rango:RangoIndicador}) {
  const {datos,cargando,error,reintentar}=useIndicador<IngresoMes[]>("/api/indicadores/ingresos-por-mes",rango);
  return <GraficoIndicador id="indicador-ingresos" titulo={texto("ui.indicadores.panel.ingresos")} total={formatearMoneda((datos??[]).reduce((n,d)=>n+d.total,0))} leyendaFecha={texto("ui.indicadores.panel.leyendaIngresos")} datos={datos??[]} series={[{clave:"total",etiqueta:texto("ui.indicadores.panel.ingresos"),unidad:texto("ui.indicadores.panel.pesos"),tipo:"barra",color:"var(--chart-1)"}]} mensual formatearCategoria={etiquetaMesCorta} formatearValor={formatearMoneda} estado={cargando?"cargando":error?"error":datos?.some(d=>d.total!==0)?"ok":"vacio"} error={error} onReintentar={reintentar}/>;
}
export function GraficoOcupacion({rango}:{rango:RangoIndicador}) {
  // Los dos contratos alimentan la misma tarjeta; reintentar esta tarjeta no toca ingresos.
  const mensual=useIndicador<OcupacionMes[]>("/api/indicadores/ocupacion-por-mes",rango);
  const resumen=useIndicador<ResumenOcupacion>("/api/indicadores/ocupacion-resumen",rango);
  const error=mensual.error||resumen.error;
  return <GraficoIndicador id="indicador-ocupacion" titulo={texto("ui.indicadores.panel.ocupacion")} total={formatearPorcentaje(resumen.datos?.ocupacion_promedio??0)} leyendaFecha={texto("ui.indicadores.panel.leyendaOcupacion")} datos={mensual.datos??[]} series={[{clave:"ocupacion_promedio",etiqueta:texto("ui.indicadores.panel.ocupacion"),unidad:texto("ui.indicadores.panel.porcentaje"),tipo:"barra",color:"var(--brand-accent)"}]} mensual formatearCategoria={etiquetaMesCorta} formatearValor={formatearPorcentaje} estado={error?"error":mensual.cargando||resumen.cargando?"cargando":resumen.datos?.turnos?"ok":"vacio"} error={error} onReintentar={()=>{mensual.reintentar();resumen.reintentar();}}/>;
}
