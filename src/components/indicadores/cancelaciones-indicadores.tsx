"use client";
import { GraficoIndicador, type SerieIndicador } from "./grafico-indicador";
import { etiquetaMesCorta } from "./graficos-indicadores";
import { useIndicador, type RangoIndicador } from "./use-indicador";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { texto } from "@/lib/textos";
import type { CancelacionesMesData, CancelacionesMateriaData } from "@/types/indicadores.types";

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const series: SerieIndicador[] = [
  { clave: "clases_canceladas_centro", etiqueta: texto("ui.indicadores.cancelaciones.centro"), unidad: texto("ui.indicadores.clases.unidad"), tipo: "barra", color: "var(--destructive)" },
  { clave: "inscripciones_canceladas_alumno", etiqueta: texto("ui.indicadores.cancelaciones.alumno"), unidad: texto("ui.indicadores.cancelaciones.inscripciones"), tipo: "barra", color: "var(--chart-1)" },
  { clave: "reservas_vencidas", etiqueta: texto("ui.indicadores.cancelaciones.reservas"), unidad: texto("ui.indicadores.cancelaciones.inscripciones"), tipo: "barra", color: "var(--chart-expired)" },
  { clave: "bajas", etiqueta: texto("ui.indicadores.cancelaciones.bajas"), unidad: texto("ui.indicadores.cancelaciones.inscripciones"), tipo: "barra", color: "var(--chart-withdrawal)" },
];
export function CancelacionesIndicadores({ rango }: { rango: RangoIndicador }) {
  const mensual = useIndicador<CancelacionesMesData>("/api/indicadores/cancelaciones-por-mes", rango);
  const materias = useIndicador<CancelacionesMateriaData>("/api/indicadores/cancelaciones-por-materia", rango);
  const datosMateria = (materias.datos?.items ?? []).map(m => ({ ...m, activa: m.activa ? texto("ui.indicadores.clases.activa") : texto("ui.indicadores.clases.inactiva"), nombre: `${m.nombre}${m.activa ? "" : ` (${texto("ui.indicadores.clases.inactiva")})`}` }));
  const haySeries = mensual.datos && Object.values(mensual.datos.totales).some(v => v > 0);
  return <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
    <GraficoIndicador id="cancelaciones-mes" titulo={texto("ui.indicadores.cancelaciones.mes")} leyendaFecha={texto("ui.indicadores.cancelaciones.leyendaMes")} mensual
      total={<span className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-normal leading-4">{series.map(s => <span key={s.clave}>{s.etiqueta}: <strong>{numero.format(mensual.datos?.totales[s.clave as keyof CancelacionesMesData["totales"]] ?? 0)} {s.unidad}</strong></span>)}</span>}
      datos={mensual.datos?.meses ?? []} series={series} formatearCategoria={etiquetaMesCorta} formatearValor={v => numero.format(v)} estado={mensual.cargando ? "cargando" : mensual.error ? "error" : haySeries ? "ok" : "vacio"} error={mensual.error} onReintentar={mensual.reintentar}/>
    <GraficoIndicador id="cancelaciones-materia" titulo={texto("ui.indicadores.cancelaciones.materia")} leyendaFecha={texto("ui.indicadores.cancelaciones.leyendaMateria")}
      total={<span className="flex flex-wrap gap-x-3 text-[10px] font-normal leading-4">{series.slice(0, 2).map(s => <span key={s.clave}>{s.etiqueta}: <strong>{numero.format(datosMateria.reduce((total, m) => total + Number(m[s.clave as "clases_canceladas_centro" | "inscripciones_canceladas_alumno"]), 0))} {s.unidad}</strong></span>)}</span>}
      datos={datosMateria} series={series.slice(0, 2).map((s, i) => ({ ...s, etiqueta: texto(i ? "ui.indicadores.cancelaciones.alumnoMateria" : "ui.indicadores.cancelaciones.centroMateria") }))} claveCategoria="materia_id" orientacion="horizontal" formatearCategoria={id => datosMateria.find(m => m.materia_id === id)?.nombre ?? id} formatearValor={v => numero.format(v)}
      columnasTabla={[{ clave: "nombre", etiqueta: texto("ui.indicadores.clases.materia") }, { clave: "activa", etiqueta: texto("ui.indicadores.clases.estado") }, ...series.slice(0, 2).map(s => ({ clave: s.clave, etiqueta: `${s.etiqueta} (${s.unidad})` }))]}
      estado={materias.cargando ? "cargando" : materias.error ? "error" : datosMateria.length ? "ok" : "vacio"} error={materias.error} onReintentar={materias.reintentar}/>
    <div className="grid grid-cols-1 gap-4 lg:col-span-2 lg:grid-cols-2">
      {(["clases", "inscripciones"] as const).map(tipo => {
        const tasa = mensual.datos?.tasas[tipo];
        const canceladas = tipo === "clases" ? mensual.datos?.tasas.clases.canceladas : mensual.datos?.tasas.inscripciones.canceladas_alumno;
        const titulo = texto(tipo === "clases" ? "ui.indicadores.cancelaciones.tasaClases" : "ui.indicadores.cancelaciones.tasaInscripciones");
        return <Card key={tipo} role="region" aria-label={titulo} aria-busy={mensual.cargando} className="gap-0 rounded-lg py-0 shadow-none"><CardContent className="p-3">
          <h2 className="text-xs text-muted-foreground">{titulo}</h2>
          {mensual.cargando ? <Skeleton className="mt-2 h-9 w-24"/> : <><p className="mt-1 text-lg leading-5 font-semibold tabular-nums">{mensual.error || tasa?.tasa == null ? "—" : `${numero.format(tasa.tasa)} %`}</p>{!mensual.error && tasa && <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{texto(tipo === "clases" ? "ui.indicadores.cancelaciones.fraccionClases" : "ui.indicadores.cancelaciones.fraccionInscripciones", { canceladas: canceladas ?? 0, totales: tasa.totales })}</p>}</>}
        </CardContent></Card>;
      })}
    </div>
  </div>;
}
