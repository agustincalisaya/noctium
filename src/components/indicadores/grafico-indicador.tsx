"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { texto } from "@/lib/textos";

export type DatoIndicador = Record<string, string | number | null>;
export type SerieIndicador = { clave: string; etiqueta: string; unidad: string; tipo: "barra" | "linea"; color: string; ejePorcentaje?: boolean };
export type ColumnaIndicador = { clave: string; etiqueta: string; formatear?: (valor: string | number | null) => string };
export type GraficoIndicadorProps = {
  id: string; titulo: string; total: string; leyendaFecha: string; datos: DatoIndicador[]; series: SerieIndicador[];
  claveCategoria?: string; anchoCategoria?: number; orientacion?: "vertical" | "horizontal";
  formatearValor?: (valor: number, clave: string) => string;
  formatearCategoria?: (valor: string, indice: number) => string;
  estado: "cargando" | "error" | "vacio" | "ok"; onReintentar?: () => void; textoVacio?: string; error?: string | null;
  mensual?: boolean; diferenciaClave?: string; diferenciaEtiqueta?: string;
  totalDetalle?: string; columnasTabla?: ColumnaIndicador[]; detalleBarra?: (fila: DatoIndicador, clave: string) => string;
  referencia?: { valor: number; etiqueta: string };
};
const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
export function valorCompacto(valor: number): string {
  if (Math.abs(valor) >= 1_000_000) return `${numero.format(valor / 1_000_000)} M`;
  if (Math.abs(valor) >= 1_000) return `${numero.format(valor / 1_000)} mil`;
  return numero.format(valor);
}

export function GraficoIndicador({ id, titulo, total, leyendaFecha, datos, series, claveCategoria = "mes", anchoCategoria = 132,
  orientacion = "vertical", formatearValor = v => String(v), formatearCategoria = v => v, estado, onReintentar, textoVacio, error,
  mensual = false, diferenciaClave, diferenciaEtiqueta = texto("ui.indicadores.panel.ausentes"), totalDetalle, columnasTabla, detalleBarra }: GraficoIndicadorProps) {
  const [tabla, setTabla] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const [desborda, setDesborda] = useState(false);
  const horizontal = orientacion === "horizontal";
  const largo = mensual && datos.length > 12;
  const barras = series.filter(s => s.tipo === "barra");
  const porcentaje = series.every(s => s.unidad === "%");
  const anchoMinimo = mensual ? datos.length * (barras.length > 2 ? barras.length * 14 + 28 : barras.length > 1 ? 60 : 44) + 64 : 0;
  const config = Object.fromEntries(series.map(s => [s.clave, { label: s.etiqueta, color: s.color }])) as ChartConfig;
  useEffect(() => {
    const elemento = scroll.current;
    if (!elemento) return;
    const medir = () => { setDesborda(elemento.scrollWidth > elemento.clientWidth + 1); elemento.scrollLeft = elemento.scrollWidth; };
    medir(); const observer = new ResizeObserver(medir); observer.observe(elemento);
    return () => observer.disconnect();
  }, [datos, tabla, estado]);
  const categoriaExacta = (valor: string, indice: number) => mensual && /^\d{4}-\d{2}$/.test(valor)
    ? new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${valor}-01T12:00:00Z`))
    : formatearCategoria(valor, indice);
  const etiquetaValor = (v: number, s: SerieIndicador) => s.unidad === "%" ? `${numero.format(v)}%` : s.unidad === "pesos" ? valorCompacto(v) : formatearValor(v, s.clave);
  const columnas = columnasTabla ?? [
    { clave: claveCategoria, etiqueta: mensual ? texto("ui.indicadores.panel.mes") : titulo, formatear: (v: string | number | null) => categoriaExacta(String(v), datos.findIndex(d => d[claveCategoria] === v)) },
    ...series.map(s => ({ clave: s.clave, etiqueta: `${s.etiqueta} (${s.unidad})`, formatear: (v: string | number | null) => v == null ? "—" : formatearValor(Number(v), s.clave) })),
    ...(diferenciaClave && !series.some(s => s.clave === diferenciaClave) ? [{ clave: diferenciaClave, etiqueta: diferenciaEtiqueta }] : []),
  ];
  return <Card aria-labelledby={`${id}-titulo`} aria-busy={estado === "cargando"} role="region" className={`gap-0 rounded-lg py-0 shadow-none ${largo ? "min-w-0 lg:col-span-2" : "min-w-0"}`}>
    <CardHeader className="block px-4 pt-4 pb-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0"><CardTitle id={`${id}-titulo`} className="text-sm leading-5 font-semibold">{titulo}</CardTitle><CardDescription className="mt-0.5 text-xs leading-4">{leyendaFecha}</CardDescription></div>
        {largo && <p className="ml-auto text-right text-lg leading-5 font-semibold tabular-nums">{estado === "ok" ? total : "—"}<span className="block text-[10px] font-normal text-muted-foreground">{totalDetalle || texto("ui.indicadores.panel.totalPeriodo")}</span></p>}
        {largo && <button type="button" aria-pressed={tabla} onClick={() => setTabla(v => !v)} className="rounded-sm py-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{texto("ui.indicadores.panel.tabla")}</button>}
      </div>
      {!largo && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1"><p className="text-lg leading-5 font-semibold tabular-nums">{estado === "ok" ? total : "—"}<span className="block text-[10px] font-normal text-muted-foreground">{totalDetalle || texto("ui.indicadores.panel.totalPeriodo")}</span></p><button type="button" aria-pressed={tabla} onClick={() => setTabla(v => !v)} className="rounded-sm py-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{texto("ui.indicadores.panel.tabla")}</button></div>}
    </CardHeader>
    <CardContent className="px-4 pt-3 pb-4">
      {estado === "cargando" && <div role="status" aria-label={texto("ui.indicadores.panel.cargando", { titulo })}><Skeleton className="h-48 w-full" /></div>}
      {estado === "error" && <div role="alert" className="space-y-3 rounded-md bg-destructive-soft p-4 text-sm text-destructive-soft-foreground"><p>{error || texto("ui.indicadores.panel.error")}</p><button type="button" onClick={onReintentar} className="rounded-md border border-current px-3 py-2 font-medium focus-visible:ring-2 focus-visible:ring-ring">{texto("ui.indicadores.panel.reintentar")}</button></div>}
      {estado === "vacio" && <p role="status" className="py-16 text-center text-sm text-muted-foreground">{textoVacio || texto("ui.indicadores.panel.vacio")}</p>}
      {estado === "ok" && <>
        {!tabla && series.length > 1 && <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] leading-4 text-muted-foreground">{series.map(s => <span key={s.clave} className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />{s.etiqueta}{s.unidad !== "%" ? ` (${s.unidad})` : ""}</span>)}</div>}
        {!tabla && <div ref={scroll} className="overflow-x-auto overscroll-x-contain" tabIndex={desborda ? 0 : undefined} aria-label={desborda ? titulo : undefined}>
          <div style={{ minWidth: anchoMinimo || undefined }}>
            <ChartContainer config={config} className="aspect-auto w-full text-[10px]" style={{ height: horizontal ? Math.max(80, datos.length * (barras.length > 1 ? 36 : 27) + 16) : 200 }}>
              <ComposedChart accessibilityLayer data={datos} layout={horizontal ? "vertical" : "horizontal"} barGap={3} barCategoryGap={horizontal ? "25%" : "24%"} margin={{ top: horizontal ? 4 : 22, right: horizontal ? (detalleBarra ? 102 : 42) : series.some(s => s.ejePorcentaje) ? 4 : 8, left: 0, bottom: 0 }}>
                {!horizontal && <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} />}
                {horizontal ? <><XAxis type="number" hide domain={[0, "dataMax"]} /><YAxis type="category" dataKey={claveCategoria} width={anchoCategoria} tickLine={false} axisLine={false} tick={({ x, y, payload }) => { const nombre = formatearCategoria(String(payload.value), datos.findIndex(d => d[claveCategoria] === payload.value)); return <text x={x} y={y} dy={3} textAnchor="end" fill="var(--muted-foreground)" fontSize={10}><title>{nombre}</title>{nombre.length > 25 ? `${nombre.slice(0, 24)}…` : nombre}</text>; }} /></> : <><XAxis dataKey={claveCategoria} tickLine={false} axisLine={false} tickMargin={7} interval={0} height={26} tickFormatter={v => formatearCategoria(String(v), datos.findIndex(d => d[claveCategoria] === v))} /><YAxis yAxisId="cantidad" tickLine={false} axisLine={false} width={42} tickCount={4} tickFormatter={v => porcentaje ? `${v}%` : series[0]?.unidad === "pesos" ? `$ ${valorCompacto(Number(v))}` : valorCompacto(Number(v))} domain={porcentaje ? [0, (max: number) => Math.max(80, Math.ceil(max / 20) * 20)] : [0, "auto"]} /></>}
                {!horizontal && series.some(s => s.ejePorcentaje) && <YAxis yAxisId="porcentaje" orientation="right" domain={[0, 100]} ticks={[0, 50, 100]} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} width={34} tick={{ fill: "var(--chart-attendance-index)" }} />}
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => categoriaExacta(String(payload?.[0]?.payload?.[claveCategoria] ?? ""), datos.findIndex(d => d[claveCategoria] === payload?.[0]?.payload?.[claveCategoria]))} formatter={(v, name) => <span className="flex w-full justify-between gap-4"><span>{series.find(s => s.clave === name)?.etiqueta}</span><span className="font-medium tabular-nums">{v == null ? "—" : formatearValor(Number(v), String(name))}</span></span>} />} />
                {series.map(s => s.tipo === "barra" ? <Bar key={s.clave} dataKey={s.clave} name={s.clave} yAxisId={horizontal ? undefined : "cantidad"} fill={s.color} maxBarSize={horizontal ? barras.length > 1 ? 8 : 12 : barras.length > 2 ? 13 : barras.length > 1 ? 22 : 38} radius={horizontal ? [0, 1, 1, 0] : [2, 2, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey={(fila: DatoIndicador) => String(fila[claveCategoria])} content={props => { const fila = datos.find(d => String(d[claveCategoria]) === String(props.value)); const value = fila?.[s.clave]; if (!fila || value == null || mensual && Number(value) === 0 && !barras.some(b => Number(fila[b.clave]) > 0)) return null; const x = Number(props.x), y = Number(props.y), width = Number(props.width), height = Number(props.height); return <text x={horizontal ? x + width + 4 : x + width / 2} y={horizontal ? y + height / 2 : y - 5} dominantBaseline={horizontal ? "central" : undefined} textAnchor={horizontal ? "start" : "middle"} fill="var(--foreground)" fontSize={9}>{etiquetaValor(Number(value), s)}{horizontal && detalleBarra ? detalleBarra(fila, s.clave) : ""}</text>; }} />
                  {diferenciaClave && s.clave === barras[0]?.clave && <LabelList dataKey={(fila: DatoIndicador) => String(fila[claveCategoria])} content={props => { const fila = datos.find(d => String(d[claveCategoria]) === String(props.value)); const v = fila?.[diferenciaClave]; if (!fila || v == null || !Number(fila[barras[0].clave])) return null; return <text x={Number(props.x) + Number(props.width) + 2} y={Number(props.y) - 19} textAnchor="middle" fill="var(--destructive)" fontSize={9}><title>{diferenciaEtiqueta}: {v}</title>−{v}</text>; }} />}
                </Bar> : <Line key={s.clave} dataKey={s.clave} name={s.clave} yAxisId={horizontal ? undefined : s.ejePorcentaje ? "porcentaje" : "cantidad"} type="linear" stroke={s.color} strokeWidth={1.5} dot={{ r: 2.5, fill: "var(--card)", stroke: s.color }} connectNulls={false} isAnimationActive={false} />)}
              </ComposedChart>
            </ChartContainer>
          </div>
        </div>}
        {!tabla && desborda && <p className="mt-3 text-xs text-muted-foreground">{texto("ui.indicadores.panel.scroll")}</p>}
      </>}
      <div className={tabla ? "overflow-x-auto" : "sr-only"}>
        <table className="w-full text-left text-sm tabular-nums"><caption className="sr-only">{titulo}</caption><thead className="border-b border-border"><tr>{columnas.map(c => <th scope="col" key={c.clave} className="px-3 py-2">{c.etiqueta}</th>)}</tr></thead><tbody>{estado === "ok" && datos.map(fila => <tr key={String(fila[claveCategoria])} className="border-b border-border">{columnas.map((c, i) => { const v = fila[c.clave]; const contenido = c.formatear ? c.formatear(v) : v == null ? "—" : String(v); return i === 0 ? <th scope="row" key={c.clave} className="px-3 py-2 font-medium">{contenido}</th> : <td key={c.clave} className="px-3 py-2">{contenido}</td>; })}</tr>)}</tbody></table>
      </div>
    </CardContent>
  </Card>;
}
