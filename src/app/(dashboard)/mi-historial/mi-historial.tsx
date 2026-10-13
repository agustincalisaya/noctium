"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";
import { fechaHoraDeInstante } from "@/lib/turno-detalle";
import { cn } from "@/lib/utils";
import type { ItemMiHistorial, MiHistorialData } from "@/types/historial.types";

export function MiHistorial() {
  const [materia, setMateria] = useState("");
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<MiHistorialData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [reintento, setReintento] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ pagina: String(pagina), por_pagina: "10" });
    if (materia) params.set("materia_id", materia);
    async function cargar() {
      setCargando(true); setError("");
      try {
        const response = await fetchAutenticado(`/api/mi-historial?${params}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error?.message ?? texto("ui.historial.propio.error"));
        if (!controller.signal.aborted) setData(result.data);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : texto("ui.historial.propio.error"));
      } finally { if (!controller.signal.aborted) setCargando(false); }
    }
    void cargar();
    return () => controller.abort();
  }, [materia, pagina, reintento]);
  return <section className="mx-auto w-full max-w-6xl space-y-[18px]" aria-busy={cargando}>
    <header><h1 className="text-2xl font-semibold">{texto("ui.historial.propio.titulo")}</h1><p className="mt-1 text-sm text-muted-foreground">{texto("ui.historial.propio.subtitulo")}</p></header>
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-h-10 max-w-full min-w-0 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground">{texto("ui.historial.propio.materia")}<select aria-label={texto("ui.historial.propio.materia")} value={materia} onChange={e => { setMateria(e.target.value); setPagina(1); }} className="min-w-0 max-w-60 bg-card text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">{texto("ui.historial.propio.todas")}</option>{data?.materias_disponibles.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label>
      {data && !cargando && !error && <p className="text-xs text-muted-foreground">{texto("ui.historial.propio.desglose", data.desglose)}</p>}
    </div>
    {data && !cargando && !error && data.asistencia_por_materia.length > 0 && <section aria-label={texto("ui.historial.propio.asistencia")} className="flex flex-wrap gap-x-6 gap-y-2 text-sm">{data.asistencia_por_materia.map(a => <p key={a.materia_id}><span className="font-medium">{data.materias_disponibles.find(m => m.id === a.materia_id)?.nombre}</span><span className="ml-2 text-muted-foreground">{a.porcentaje === null ? texto("ui.historial.propio.sinControlPorcentaje") : texto("ui.historial.propio.porcentaje", { porcentaje: a.porcentaje })}</span></p>)}</section>}
    {cargando ? <p role="status" className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">{texto("ui.historial.propio.cargando")}</p>
      : error ? <div role="alert" className="rounded-lg border border-border bg-card p-6"><p className="text-sm text-destructive">{error}</p><Button variant="outline" className="mt-3" onClick={() => setReintento(n => n + 1)}>{texto("ui.historial.propio.reintentar")}</Button></div>
      : data && data.items.length > 0 ? <><ol aria-label={texto("ui.historial.propio.timeline")} className="rounded-lg border border-border bg-card px-5 sm:px-6">{data.items.map(item => <Registro key={`${item.tipo}-${item.id}`} item={item} />)}</ol><Pagination paginaActual={pagina} totalPaginas={data.paginacion.total_paginas} total={data.paginacion.total} mostrarRango onPageChange={setPagina} buildHref={p => `?pagina=${p}`} /></>
      : <p role="status" className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">{texto(materia ? "ui.historial.propio.sinCoincidencias" : data && data.paginacion.total > 0 ? "ui.historial.propio.sinPagina" : "ui.historial.propio.vacio")}</p>}
    <Link href="/alumno" className="inline-flex text-sm text-primary underline underline-offset-4">{texto("ui.historial.propio.volver")}</Link>
  </section>;
}
function Registro({ item }: { item: ItemMiHistorial }) {
  const tipo = item.tipo === "EXAMEN" ? "ui.historial.propio.examen" : item.tipo === "INDICACION" ? "ui.historial.propio.indicacion" : "ui.historial.propio.clase";
  return <li className="grid grid-cols-[4.5rem_0.5rem_minmax(0,1fr)] gap-x-2 border-b border-border py-4 last:border-0 sm:grid-cols-[5.5rem_0.5rem_minmax(0,1fr)]">
    <time dateTime={item.fecha} className="pt-0.5 text-xs tabular-nums text-muted-foreground">{item.fecha.split("-").reverse().join("/")}</time>
    <span aria-hidden className={cn("mt-1.5 size-2 rounded-full", item.tipo === "EXAMEN" ? "bg-primary" : item.tipo === "INDICACION" ? "bg-warning-foreground" : "bg-border")} />
    <div className="relative min-w-0 space-y-1.5 [overflow-wrap:anywhere]"><div className="flex flex-wrap items-center gap-2 sm:pr-16"><h2 className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{item.materia.nombre}</h2><Badge variant={item.tipo === "EXAMEN" ? "default" : item.tipo === "INDICACION" ? "warning" : "muted"} className="text-[10px]">{texto(tipo)}</Badge>{item.tipo === "EXAMEN" && <p className="w-full text-sm font-semibold tabular-nums sm:absolute sm:top-0 sm:right-0 sm:w-auto">{item.nota}<span className="ml-2 text-xs font-normal text-muted-foreground">/ 10</span></p>}</div>
      {item.tipo === "EXAMEN" && <>
        {item.descripcion_publica && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed sm:pr-16">{item.descripcion_publica}</p>}
        {item.registrado_por && <p className="text-xs text-muted-foreground">{texto("ui.historial.propio.autorExamen", { autor: item.registrado_por })}</p>}
      </>}
      {item.tipo === "INDICACION" && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.indicacion}</p>}
      {item.tipo === "INDICACION" && <p className="text-xs text-muted-foreground">{[item.registrada_por, item.registrada_en ? texto("ui.historial.indicacion.registradaEn", { fecha: fechaHoraDeInstante(item.registrada_en) }) : null].filter(Boolean).join(" · ")}</p>}
      {item.tipo === "CLASE_DICTADA" && <>{[item.profesor, item.aula, item.hora_inicio && item.hora_fin ? `${item.hora_inicio}–${item.hora_fin}` : null].some(Boolean) && <p className="text-xs text-muted-foreground">{[item.profesor, item.aula, item.hora_inicio && item.hora_fin ? `${item.hora_inicio}–${item.hora_fin}` : null].filter(Boolean).join(" · ")}</p>}<Badge variant={item.asistencia === null || item.asistencia === "AUSENTE" ? "muted" : "success"} className={cn("text-[10px]", item.asistencia === "AUSENTE" && "bg-destructive-soft text-destructive-soft-foreground")}>{texto(item.asistencia === "AUSENTE" ? "ui.historial.propio.ausente" : item.asistencia === null ? "ui.historial.propio.sinControl" : "ui.historial.propio.presente")}</Badge>{item.temas_vistos && <p className="whitespace-pre-wrap break-words text-xs leading-relaxed"><span className="mr-1 uppercase text-muted-foreground">{texto("ui.historial.propio.temas")}</span>{item.temas_vistos}</p>}</>}
    </div>
  </li>;
}
