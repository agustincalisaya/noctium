"use client";

import { GraficoIndicador } from "@/components/indicadores/grafico-indicador";
import { useIndicador, type RangoIndicador } from "@/components/indicadores/use-indicador";
import type { ClasesMateriasData, ClasesProfesoresData } from "@/types/indicadores.types";
import { texto } from "@/lib/textos";

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const estadoNombre = (activo: boolean, profesor = false) => texto(activo ? profesor ? "ui.indicadores.clases.activo" : "ui.indicadores.clases.activa" : profesor ? "ui.indicadores.clases.inactivo" : "ui.indicadores.clases.inactiva");
export function ClasesIndicadores({ rango }: { rango: RangoIndicador }) {
  const materias = useIndicador<ClasesMateriasData>("/api/indicadores/clases-por-materia", rango);
  const profesores = useIndicador<ClasesProfesoresData>("/api/indicadores/clases-por-profesor", rango);
  return <>
    <GraficoIndicador id="clases-materia" titulo={texto("ui.indicadores.clases.materias")} total={texto("ui.indicadores.clases.total", { cantidad: materias.datos?.total ?? 0 })} leyendaFecha={texto("ui.indicadores.clases.leyendaMateria")}
      datos={(materias.datos?.items ?? []).map(m => ({ categoria: m.materia_id, nombre: `${m.nombre}${m.activa ? "" : ` (${estadoNombre(false)})`}`, estado: estadoNombre(m.activa), clases: m.clases }))}
      series={[{ clave: "clases", etiqueta: texto("ui.indicadores.clases.cantidad"), unidad: texto("ui.indicadores.clases.unidad"), tipo: "barra", color: "var(--chart-1)" }]} claveCategoria="categoria" orientacion="horizontal" formatearCategoria={id => { const m = materias.datos?.items.find(m => m.materia_id === id); return m ? `${m.nombre}${m.activa ? "" : ` (${estadoNombre(false)})`}` : id; }} formatearValor={v => numero.format(v)}
      columnasTabla={[{ clave: "nombre", etiqueta: texto("ui.indicadores.clases.materia") }, { clave: "estado", etiqueta: texto("ui.indicadores.clases.estado") }, { clave: "clases", etiqueta: texto("ui.indicadores.clases.cantidad") }]}
      estado={materias.cargando ? "cargando" : materias.error ? "error" : materias.datos?.total ? "ok" : "vacio"} error={materias.error} onReintentar={materias.reintentar} textoVacio={texto("ui.indicadores.clases.vacio")} />
    <GraficoIndicador id="clases-profesor" titulo={texto("ui.indicadores.clases.profesores")} total={texto("ui.indicadores.clases.totalProfesor", { cantidad: profesores.datos?.total.clases ?? 0, horas: numero.format(profesores.datos?.total.horas ?? 0) })} leyendaFecha={texto("ui.indicadores.clases.leyendaProfesor")}
      datos={(profesores.datos?.items ?? []).map(p => ({ categoria: p.profesor_id, nombre: `${p.nombre}${p.activo ? "" : ` (${estadoNombre(false, true)})`}`, estado: estadoNombre(p.activo, true), clases: p.clases, horas: p.horas }))}
      series={[{ clave: "clases", etiqueta: texto("ui.indicadores.clases.cantidad"), unidad: texto("ui.indicadores.clases.unidad"), tipo: "barra", color: "var(--brand-accent)" }]} claveCategoria="categoria" orientacion="horizontal" formatearCategoria={id => { const p = profesores.datos?.items.find(p => p.profesor_id === id); return p ? `${p.nombre}${p.activo ? "" : ` (${estadoNombre(false, true)})`}` : id; }} formatearValor={v => numero.format(v)} detalleBarra={fila => ` · ${numero.format(Number(fila.horas))} h`}
      columnasTabla={[{ clave: "nombre", etiqueta: texto("ui.indicadores.clases.profesor") }, { clave: "estado", etiqueta: texto("ui.indicadores.clases.estado") }, { clave: "clases", etiqueta: texto("ui.indicadores.clases.cantidad") }, { clave: "horas", etiqueta: texto("ui.indicadores.clases.horas"), formatear: v => numero.format(Number(v)) }]}
      estado={profesores.cargando ? "cargando" : profesores.error ? "error" : profesores.datos?.total.clases ? "ok" : "vacio"} error={profesores.error} onReintentar={profesores.reintentar} textoVacio={texto("ui.indicadores.clases.vacio")} />
  </>;
}
