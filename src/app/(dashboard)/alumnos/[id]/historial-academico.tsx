"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import type { HistorialAcademicoData } from "@/types/historial.types";
import { texto } from "@/lib/textos";
import { fechaHoraDeInstante } from "@/lib/turno-detalle";
import { RegistrarResultadoExamenDialog } from "./registrar-resultado-examen-dialog";
import { RegistrarIndicacionDialog } from "./registrar-indicacion-dialog";

function fechaCorta(fecha: string) {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

export function HistorialAcademico({
  alumnoId,
  puedeRegistrarExamen,
  puedeRegistrarIndicacion,
  mostrarNombre,
  materiaInicial = "",
}: {
  alumnoId: string;
  puedeRegistrarExamen: boolean;
  puedeRegistrarIndicacion: boolean;
  mostrarNombre: boolean;
  materiaInicial?: string;
}) {
  const [datos, setDatos] = useState<HistorialAcademicoData | null>(null);
  const [pagina, setPagina] = useState(1);
  const [materiaId, setMateriaId] = useState(materiaInicial);
  const [actualizacion, setActualizacion] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    const query = new URLSearchParams({ pagina: String(pagina), por_pagina: "10" });
    if (materiaId) query.set("materia_id", materiaId);
    try {
      const respuesta = await fetchAutenticado(`/api/alumnos/${encodeURIComponent(alumnoId)}/historial?${query}`, { cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok) throw new Error(valor?.error?.message ?? "No se pudo consultar el historial académico");
      if (!valor?.data) throw new Error("No se pudo consultar el historial académico");
      setDatos(valor.data);
    } catch (fallo) {
      setError(fallo instanceof Error && fallo.message !== "Failed to fetch"
        ? fallo.message
        : "No se pudo consultar el historial académico. Intentá nuevamente.");
    } finally {
      setCargando(false);
    }
  }, [alumnoId, materiaId, pagina]);

  useEffect(() => {
    const inicial = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(inicial);
  }, [actualizacion, cargar]);

  const alRegistrar = () => {
    setPagina(1);
    setActualizacion((version) => version + 1);
  };

  return (
    <section className="space-y-4" aria-label="Historial académico">
      {mostrarNombre && datos && <h1 className="text-2xl font-semibold">{datos.alumno.nombre_completo}</h1>}
      {datos && datos.asistencia_por_materia?.length > 0 && <section aria-label={texto("ui.historial.asistencia.resumen")} className="space-y-2 rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{texto("ui.historial.asistencia.resumen")}</h2>
        <ul className="space-y-2">{datos.asistencia_por_materia.map((resumen) => <li key={resumen.materia_id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <span>{datos.materias_disponibles.find(({ id }) => id === resumen.materia_id)?.nombre ?? resumen.materia_id}</span>
          <span className="font-medium tabular-nums">{resumen.porcentaje === null ? texto("ui.historial.asistencia.soloSinControl") : texto("ui.historial.asistencia.porcentaje", resumen)}</span>
          {resumen.sin_control > 0 && <span className="w-full text-xs text-muted-foreground">{texto("ui.historial.asistencia.excluidas", { cantidad: resumen.sin_control })}</span>}
        </li>)}</ul>
      </section>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {datos?.puede_registrar_indicacion === undefined ? <>
            <label htmlFor="materia-historial" className="sr-only">Filtrar historial por materia</label>
            <select
              id="materia-historial"
              className="h-10 min-w-36 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={materiaId}
              onChange={(evento) => { setMateriaId(evento.target.value); setPagina(1); }}
              disabled={!datos || cargando}
            >
              <option value="">Materia: Todas</option>
              {datos?.materias_disponibles.map((materia) => <option key={materia.id} value={materia.id}>{materia.nombre}</option>)}
            </select>
          </> : <p className="text-sm font-medium">{datos.indicaciones_opciones?.materias[0]?.nombre ?? datos.materias_disponibles.find(({ id }) => id === materiaId)?.nombre}</p>}
          <span className="text-sm text-muted-foreground">
            {datos ? `${datos.paginacion.total} ${datos.paginacion.total === 1 ? "registro" : "registros"}` : "Cargando historial"}
          </span>
        </div>
        {puedeRegistrarExamen && datos && (
          <RegistrarResultadoExamenDialog
            alumnoId={alumnoId}
            nombreAlumno={datos.alumno.nombre_completo}
            onRegistrado={alRegistrar}
          />
        )}
        {puedeRegistrarIndicacion && datos && (
          <RegistrarIndicacionDialog
            alumnoId={alumnoId}
            nombreAlumno={datos.alumno.nombre_completo}
            materias={datos.indicaciones_opciones?.materias ?? []}
            clases={datos.indicaciones_opciones?.clases ?? []}
            materiaInicial={materiaId}
            materiaFija={datos.puede_registrar_indicacion !== undefined}
            deshabilitado={datos.puede_registrar_indicacion === false}
            leyendaDeshabilitado={datos.puede_registrar_indicacion === false ? texto("ui.historial.indicacion.deshabilitada") : undefined}
            onRegistrado={alRegistrar}
          />
        )}
      </div>

      {cargando && <p role="status" className="text-sm text-muted-foreground">Cargando historial académico…</p>}
      {error && <div role="alert" className="space-y-3 rounded-md border border-border bg-card p-4 text-sm"><p>{error}</p><Button type="button" variant="outline" onClick={() => void cargar()}>Reintentar</Button></div>}
      {!cargando && !error && datos && datos.items.length === 0 && (
        <div className="rounded-md border border-border bg-card p-5 text-sm text-muted-foreground">
          {datos.paginacion.total === 0 && !materiaId
            ? "Este alumno todavía no tiene historial académico."
            : materiaId ? "No hay registros para esta materia." : "No hay más registros en esta página."}
        </div>
      )}
      {!cargando && !error && datos && datos.items.length > 0 && (
        <div className="rounded-md border border-border bg-card px-4 text-card-foreground">
          <ol className="divide-y divide-border" aria-label="Registros del historial académico">
            {datos.items.map((item) => (
              <li key={item.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-3 py-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:gap-4">
                <time dateTime={item.fecha} className="pt-1 font-mono text-xs text-muted-foreground">{fechaCorta(item.fecha)}</time>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span aria-hidden="true" className={`size-2 rounded-full ${item.tipo === "CLASE_DICTADA" ? "bg-muted-foreground" : "bg-primary"}`} />
                    <span className="text-sm font-semibold">{item.materia.nombre}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.tipo === "CLASE_DICTADA" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                      {item.tipo === "CLASE_DICTADA" ? "Clase dictada" : item.tipo === "EXAMEN" ? "Examen" : texto("ui.historial.indicacion.etiqueta")}
                    </span>
                  </div>
                  {item.tipo === "CLASE_DICTADA" && <><p className="pl-4 text-xs text-muted-foreground">{item.profesor}</p><span className={`ml-4 inline-block rounded-md px-2 py-1 text-xs font-medium ${item.asistencia === "PRESENTE" ? "bg-success text-success-foreground" : item.asistencia === "AUSENTE" ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-muted text-muted-foreground"}`}>{texto(item.asistencia === "PRESENTE" ? "ui.historial.asistencia.asistio" : item.asistencia === "AUSENTE" ? "ui.historial.asistencia.ausente" : "ui.historial.asistencia.sinControl")}</span>
                    {item.observacion && <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-3">
                      <h3 className="text-xs font-semibold">{texto("ui.historial.observaciones.temasEnClase")}</h3>
                      <p className="whitespace-pre-wrap text-sm">{item.observacion.temas_vistos}</p>
                      {item.observacion.observaciones_internas && <div className="space-y-1 border-t border-border pt-2">
                        <h4 className="text-xs font-semibold">{texto("ui.historial.observaciones.internasEnClase")}</h4>
                        <p className="whitespace-pre-wrap text-sm">{item.observacion.observaciones_internas}</p>
                      </div>}
                      <p className="text-xs text-muted-foreground">{texto("ui.historial.observaciones.registradaPor", {
                        fechaHora: fechaHoraDeInstante(item.observacion.registrada_en),
                        usuario: item.observacion.registrada_por ?? texto("ui.historial.observaciones.sinRegistrar"),
                      })}</p>
                    </div>}
                  </>}
                  {item.tipo === "EXAMEN" && item.observaciones && <p className="pl-4 text-xs text-muted-foreground">{item.observaciones}</p>}
                  {item.tipo === "INDICACION" && <div className="space-y-1 pl-4 text-xs text-muted-foreground">
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{item.indicacion}</p>
                    <p>{texto("ui.historial.indicacion.registradaEn", { fecha: fechaHoraDeInstante(item.registrada_en) })}</p>
                    {item.registrada_por && <p>{texto("ui.historial.indicacion.registradaPor", { autor: item.registrada_por })}</p>}
                    {item.clase_dictada_id && <p>{texto("ui.historial.indicacion.claseRelacionada", {
                      fecha: fechaCorta(datos.indicaciones_opciones?.clases.find(({ id }) => id === item.clase_dictada_id)?.fecha ?? item.fecha),
                    })}</p>}
                  </div>}
                </div>
                {item.tipo === "EXAMEN" && <span className="whitespace-nowrap pt-1 text-sm font-semibold">{item.nota.replace(".", ",")} / 10</span>}
              </li>
            ))}
          </ol>
          <Pagination
            paginaActual={datos.paginacion.pagina_actual}
            totalPaginas={datos.paginacion.total_paginas}
            total={datos.paginacion.total}
            porPagina={datos.paginacion.por_pagina}
            buildHref={() => "#"}
            mostrarRango
            mostrarNumeros
            onPageChange={setPagina}
          />
        </div>
      )}
    </section>
  );
}
