"use client";

import Link from "next/link";
import { useState } from "react";
import { GraficoIndicador } from "@/components/indicadores/grafico-indicador";
import { useIndicador } from "@/components/indicadores/use-indicador";
import { Pagination } from "@/components/shared/pagination";
import { texto } from "@/lib/textos";
import type { PresentismoMensualData, PresentismoMateriasData, PresentismoBajoData, ResumenPresentismo } from "@/types/indicadores.types";

type Rango = { desde: string; hasta: string };
const formato = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const mes = (valor: string, indice: number) => new Intl.DateTimeFormat("es-AR", { month: "short", ...(indice === 0 || valor.endsWith("-01") ? { year: "2-digit" as const } : {}), timeZone: "UTC" }).format(new Date(`${valor}-01T12:00:00Z`));
const valorGrafico = (valor: number, clave: string) => `${formato.format(valor)}${clave === "indice" ? " %" : ""}`;
function total(r: ResumenPresentismo | undefined) { return r ? `${formato.format(r.presentes)} de ${formato.format(r.inscriptos)} · ${r.indice === null ? "—" : `${formato.format(r.indice)} %`}` : "—"; }
function estado(q: { cargando: boolean; error: string | null }, vacio: boolean): "cargando" | "error" | "vacio" | "ok" { return q.cargando ? "cargando" : q.error ? "error" : vacio ? "vacio" : "ok"; }
const series = [
  { clave: "inscriptos", etiqueta: texto("ui.indicadores.presentismo.inscriptos"), unidad: texto("ui.indicadores.presentismo.inscripcionesUnidad"), tipo: "barra" as const, color: "var(--chart-1)" },
  { clave: "presentes", etiqueta: texto("ui.indicadores.presentismo.presentes"), unidad: texto("ui.indicadores.presentismo.presenciasUnidad"), tipo: "barra" as const, color: "var(--chart-2)" },
];

export function PresentismoIndicadores({ rango }: { rango: Rango }) {
  const periodo = `${rango.desde}/${rango.hasta}`;
  const [seleccion, setSeleccion] = useState({ periodo, pagina: 1 });
  const pagina = seleccion.periodo === periodo ? seleccion.pagina : 1;
  const mensual = useIndicador<PresentismoMensualData>("/api/indicadores/presentismo-por-mes", rango);
  const materias = useIndicador<PresentismoMateriasData>("/api/indicadores/presentismo-por-materia", rango);
  const alumnos = useIndicador<PresentismoBajoData>(`/api/indicadores/alumnos-presentismo-bajo?pagina=${pagina}`, rango);
  const datosMateria = (materias.datos?.items ?? []).map(m => ({ ...m, categoria: `${m.nombre}${m.activa ? "" : ` (${texto("ui.indicadores.presentismo.inactiva")})`} · ${formato.format(m.indice ?? 0)} % · ${m.ausentes} ${texto("ui.indicadores.presentismo.ausentes")}` }));
  const clasesSinControl = mensual.datos?.clases_sin_control ?? materias.datos?.clases_sin_control;
  const doceMeses = (Number(rango.hasta.slice(0, 4)) - Number(rango.desde.slice(0, 4))) * 12 + Number(rango.hasta.slice(5)) - Number(rango.desde.slice(5)) + 1 > 12;

  return <div className="space-y-6">
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <div className={doceMeses ? "min-w-0 lg:col-span-2" : "min-w-0"}>
        <GraficoIndicador id="presentismo-mes" titulo={texto("ui.indicadores.presentismo.mensual")} total={total(mensual.datos?.resumen)} leyendaFecha={texto("ui.indicadores.presentismo.leyenda")} datos={(mensual.datos?.meses ?? []).map(m => ({ ...m }))} series={[...series, { clave: "indice", etiqueta: texto("ui.indicadores.presentismo.titulo"), unidad: "%", tipo: "linea", color: "var(--chart-3)", ejePorcentaje: true }]} claveCategoria="mes" formatearCategoria={mes} formatearValor={valorGrafico} estado={estado(mensual, !mensual.datos?.resumen.inscriptos)} onReintentar={mensual.reintentar} error={mensual.error ?? undefined} textoVacio={texto("ui.indicadores.presentismo.vacio")} mensual diferenciaClave="ausentes" />
      </div>
      <GraficoIndicador id="presentismo-materia" titulo={texto("ui.indicadores.presentismo.materia")} total={total(materias.datos?.resumen)} leyendaFecha={texto("ui.indicadores.presentismo.ordenMateria")} datos={datosMateria.map(m => ({ categoria: m.categoria, inscriptos: m.inscriptos, presentes: m.presentes, ausentes: m.ausentes, indice: m.indice }))} series={series} claveCategoria="categoria" orientacion="horizontal" formatearValor={valorGrafico} estado={estado(materias, !materias.datos?.items.length)} onReintentar={materias.reintentar} error={materias.error ?? undefined} textoVacio={texto("ui.indicadores.presentismo.vacio")} />
    </div>
    {clasesSinControl !== undefined && <p role="status" className="text-sm text-muted-foreground">{texto("ui.indicadores.presentismo.sinControl", { cantidad: clasesSinControl })}</p>}
    <section aria-labelledby="presentismo-bajo-titulo" className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 id="presentismo-bajo-titulo" className="text-base font-semibold">{texto("ui.indicadores.presentismo.tabla")}</h2>
      {alumnos.datos && <p className="mt-1 text-sm text-muted-foreground">{texto("ui.indicadores.presentismo.umbral", { umbral: alumnos.datos.umbral, minimo: alumnos.datos.minimo_clases })}</p>}
      {alumnos.cargando ? <p role="status" className="py-8 text-sm text-muted-foreground">{texto("ui.indicadores.presentismo.cargando")}</p> : alumnos.error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-destructive"><p>{texto("ui.indicadores.presentismo.error")}</p><button type="button" onClick={alumnos.reintentar} className="rounded-md border border-current px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{texto("ui.indicadores.presentismo.reintentar")}</button></div> : !alumnos.datos?.items.length ? <p role="status" className="py-8 text-sm text-muted-foreground">{texto("ui.indicadores.presentismo.tablaVacia")}</p> : <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <caption className="sr-only">{texto("ui.indicadores.presentismo.tabla")}</caption>
          <thead className="border-b border-border text-xs text-muted-foreground"><tr>{["alumno", "materiaColumna", "clases", "ausencias", "titulo", "historial"].map(clave => <th scope="col" key={clave} className="whitespace-nowrap px-3 py-3 font-medium">{texto(`ui.indicadores.presentismo.${clave}` as Parameters<typeof texto>[0])}</th>)}</tr></thead>
          <tbody>{alumnos.datos.items.map(a => <tr key={`${a.alumno_id}/${a.materia_id}`} className="border-b border-border last:border-0"><td className="px-3 py-4 font-medium">{a.nombre_completo}</td><td className="px-3 py-4">{a.materia}</td><td className="px-3 py-4">{a.clases_dictadas}</td><td className="px-3 py-4">{a.ausencias}</td><td className="whitespace-nowrap px-3 py-4">{formato.format(a.porcentaje)} %</td><td className="px-3 py-4"><Link className="whitespace-nowrap rounded-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/alumnos/${encodeURIComponent(a.alumno_id)}?tab=historial&materia_id=${encodeURIComponent(a.materia_id)}`}>{texto("ui.indicadores.presentismo.historial")}</Link></td></tr>)}</tbody>
        </table>
      </div>}
      {!alumnos.cargando && !alumnos.error && alumnos.datos && alumnos.datos.total > 0 && <div className="mt-4"><Pagination paginaActual={pagina} totalPaginas={Math.ceil(alumnos.datos.total / alumnos.datos.por_pagina)} total={alumnos.datos.total} porPagina={alumnos.datos.por_pagina} mostrarRango siempreVisible buildHref={p => `?pagina=${p}`} onPageChange={p => setSeleccion({ periodo, pagina: p })} /></div>}
    </section>
  </div>;
}
