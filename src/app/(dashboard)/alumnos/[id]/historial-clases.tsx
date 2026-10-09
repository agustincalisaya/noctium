"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";
import { cn } from "@/lib/utils";
import type { ClasesAlumnoData, ResultadoClaseAlumno } from "@/types/clases-alumno.types";
const ETIQUETAS = {
  PROXIMA: "ui.historial.clasesAlumno.PROXIMA", ASISTIO: "ui.historial.clasesAlumno.ASISTIO", AUSENTE: "ui.historial.clasesAlumno.AUSENTE",
  SIN_REGISTRAR_COMO_DICTADA: "ui.historial.clasesAlumno.SIN_REGISTRAR_COMO_DICTADA", CANCELADA_CENTRO: "ui.historial.clasesAlumno.CANCELADA_CENTRO",
  CANCELADA_ALUMNO: "ui.historial.clasesAlumno.CANCELADA_ALUMNO", RESERVA_VENCIDA: "ui.historial.clasesAlumno.RESERVA_VENCIDA", BAJA_ALUMNO: "ui.historial.clasesAlumno.BAJA_ALUMNO", QUITADA_CENTRO: "ui.historial.clasesAlumno.QUITADA_CENTRO",
} as const;
const RESULTADOS = Object.keys(ETIQUETAS) as ResultadoClaseAlumno[];
export function HistorialClases({ alumnoId }: { alumnoId: string }) {
  const [filtros, setFiltros] = useState({ resultado: "", desde: "", hasta: "", pagina: 1 });
  const [data, setData] = useState<ClasesAlumnoData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [reintento, setReintento] = useState(0);
  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);
  const hayFiltros = Boolean(filtros.resultado || filtros.desde || filtros.hasta);
  const limpiar = () => setFiltros({ resultado: "", desde: "", hasta: "", pagina: 1 });
  useEffect(() => {
    const controller = new AbortController();
    async function cargar() {
      setCargando(true); setError("");
      if (rangoInvalido) { setCargando(false); return; }
      const params = new URLSearchParams({ pagina: String(filtros.pagina), por_pagina: "10" });
      for (const key of ["resultado", "desde", "hasta"] as const) if (filtros[key]) params.set(key, filtros[key]);
      try {
        const response = await fetchAutenticado(`/api/alumnos/${encodeURIComponent(alumnoId)}/clases?${params}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error?.message ?? texto("ui.historial.clasesAlumno.error"));
        if (!controller.signal.aborted) setData(result.data);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : texto("ui.historial.clasesAlumno.error")); }
      finally { if (!controller.signal.aborted) setCargando(false); }
    }
    void cargar(); return () => controller.abort();
  }, [alumnoId, filtros, reintento, rangoInvalido]);
  function cambiar(key: "resultado" | "desde" | "hasta", value: string) { setFiltros(f => ({ ...f, [key]: value, pagina: 1 })); }
  const inputClass = "min-h-9 min-w-0 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return <section className="space-y-[18px]" aria-busy={cargando} aria-label={texto("ui.historial.clasesAlumno.tab")}>
    <div className="flex flex-wrap items-center gap-3">
      <label className={cn(inputClass, "flex max-w-full items-center gap-2 text-muted-foreground")}>{texto("ui.historial.clasesAlumno.resultado")}<select aria-label={texto("ui.historial.clasesAlumno.resultado")} value={filtros.resultado} onChange={e => cambiar("resultado",e.target.value)} className="min-w-0 max-w-64 bg-card text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">{texto("ui.historial.clasesAlumno.todos")}</option>{RESULTADOS.map(r => <option key={r} value={r}>{texto(ETIQUETAS[r])}</option>)}</select></label>
      {(["desde", "hasta"] as const).map(key => <label key={key} className={cn(inputClass, "flex max-w-full items-center gap-2 text-muted-foreground")}>{texto(key === "desde" ? "ui.historial.clasesAlumno.desde" : "ui.historial.clasesAlumno.hasta")}<input type="date" aria-label={texto(key === "desde" ? "ui.historial.clasesAlumno.desde" : "ui.historial.clasesAlumno.hasta")} aria-invalid={rangoInvalido} value={filtros[key]} onChange={e => cambiar(key,e.target.value)} className="min-w-0 bg-card text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>)}
      {hayFiltros && <Button variant="ghost" size="sm" onClick={limpiar}>{texto("ui.historial.clasesAlumno.limpiar")}</Button>}
    </div>
    {rangoInvalido ? <p role="alert" className="text-sm text-destructive">{texto("ui.historial.clasesAlumno.rangoInvalido")}</p>
      : cargando ? <p role="status" className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">{texto("ui.historial.clasesAlumno.cargando")}</p>
      : error ? <div role="alert" className="rounded-lg border border-border bg-card p-5"><p className="text-sm text-destructive">{error}</p><Button variant="outline" className="mt-3" onClick={() => setReintento(n => n + 1)}>{texto("ui.historial.clasesAlumno.reintentar")}</Button></div>
      : data && <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{RESULTADOS.map(r => <div key={r} className="rounded-lg border border-border bg-card px-3 py-3"><p className="text-xs text-muted-foreground">{texto(ETIQUETAS[r])}</p><p className="mt-1 text-xl font-semibold tabular-nums">{data.resumen.por_resultado[r]}</p></div>)}<div className="rounded-lg border border-border bg-card px-3 py-3"><p className="text-xs text-muted-foreground">{texto("ui.historial.clasesAlumno.porcentaje")}</p><p className="mt-1 text-xl font-semibold tabular-nums">{data.resumen.porcentaje_asistencia === null ? texto("ui.historial.clasesAlumno.sinDato") : `${data.resumen.porcentaje_asistencia}%`}</p><p className="mt-1 text-[10px] text-muted-foreground">{texto("ui.historial.clasesAlumno.denominador", { presentes: data.resumen.por_resultado.ASISTIO - data.resumen.asistio_sin_control, total: data.resumen.clases_con_control })}</p></div></div>
        {data.items.length ? <><div className="overflow-x-auto rounded-lg border border-border bg-card" role="region" aria-label={texto("ui.historial.clasesAlumno.tabla")} tabIndex={0}><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-border">{[texto("ui.historial.clasesAlumno.fecha"),texto("ui.historial.clasesAlumno.hora"),texto("ui.historial.clasesAlumno.materia"),texto("ui.historial.clasesAlumno.profesor"),texto("ui.historial.clasesAlumno.aula"),texto("ui.historial.clasesAlumno.resultado")].map(label => <th key={label} className="px-3 py-3 text-[10px] font-normal uppercase text-muted-foreground">{label}</th>)}</tr></thead><tbody>{data.items.map(i => <tr key={i.inscripcion_id} className="border-b border-border last:border-0"><td className="px-3 py-3 font-mono text-xs tabular-nums"><Link href={`/turnos/${encodeURIComponent(i.turno_id)}`} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{fecha(i.fecha)}</Link></td><td className="px-3 py-3 font-mono text-xs whitespace-nowrap tabular-nums">{i.hora_inicio}–{i.hora_fin}</td><td className="px-3 py-3">{i.materia.nombre}</td><td className="px-3 py-3">{i.profesor ?? texto("ui.historial.clasesAlumno.sinDato")}</td><td className="px-3 py-3">{i.aula ?? texto("ui.historial.clasesAlumno.sinDato")}</td><td className="px-3 py-3"><Badge variant={i.resultado === "ASISTIO" ? "success" : "outline"} className={cn("text-[10px] whitespace-nowrap", i.resultado === "AUSENTE" && "border-transparent bg-destructive-soft text-destructive-soft-foreground")}>{i.sin_control_asistencia ? texto("ui.historial.clasesAlumno.sinControl") : etiquetaResultado(i.resultado)}</Badge></td></tr>)}</tbody></table></div><Pagination paginaActual={filtros.pagina} totalPaginas={data.paginacion.total_paginas} total={data.paginacion.total} mostrarRango onPageChange={pagina => setFiltros(f => ({ ...f, pagina }))} buildHref={p => `?pagina=${p}`} /></>
          : <div role="status" className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground"><p>{texto(data.paginacion.total > 0 ? "ui.historial.clasesAlumno.sinPagina" : hayFiltros ? "ui.historial.clasesAlumno.sinCoincidencias" : "ui.historial.clasesAlumno.vacio")}</p>{data.paginacion.total > 0 && <Button variant="outline" className="mt-3" onClick={() => setFiltros(f => ({ ...f,pagina: 1 }))}>{texto("ui.historial.clasesAlumno.primera")}</Button>}{hayFiltros && <Button variant="outline" className="mt-3" onClick={limpiar}>{texto("ui.historial.clasesAlumno.limpiar")}</Button>}</div>}
      </>}
  </section>;
}
function fecha(value: string) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "short",day: "2-digit",month: "2-digit",year: "2-digit",timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function etiquetaResultado(resultado: ResultadoClaseAlumno) {
  switch (resultado) {
    case "PROXIMA": return texto("ui.historial.clasesAlumno.PROXIMA");
    case "ASISTIO": return texto("ui.historial.clasesAlumno.ASISTIO");
    case "AUSENTE": return texto("ui.historial.clasesAlumno.AUSENTE");
    case "SIN_REGISTRAR_COMO_DICTADA": return texto("ui.historial.clasesAlumno.SIN_REGISTRAR_COMO_DICTADA");
    case "CANCELADA_CENTRO": return texto("ui.historial.clasesAlumno.CANCELADA_CENTRO");
    case "CANCELADA_ALUMNO": return texto("ui.historial.clasesAlumno.CANCELADA_ALUMNO");
    case "RESERVA_VENCIDA": return texto("ui.historial.clasesAlumno.RESERVA_VENCIDA");
    case "BAJA_ALUMNO": return texto("ui.historial.clasesAlumno.BAJA_ALUMNO");
    case "QUITADA_CENTRO": return texto("ui.historial.clasesAlumno.QUITADA_CENTRO");
  }
}
