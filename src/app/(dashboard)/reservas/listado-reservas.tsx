"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CampoBusqueda, ESPERA_AVISO_CARGA_MS, ESPERA_BUSQUEDA_MS } from "@/components/shared/campo-busqueda";
import { Pagination } from "@/components/shared/pagination";
import { terminoBusqueda } from "@/lib/busqueda-texto";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { parametrosListadoReservas, type FiltrosReservas, type PestanaReservas, type VencenReservas } from "@/lib/reservas-listado";
import { texto } from "@/lib/textos";
import { cn } from "@/lib/utils";
import type { ListadoReservasPendientes, ListadoReservasVencidas, OpcionMateriaReservas, ReservaPendienteVista } from "@/types/reserva.types";
import { QuitarReservaDialog } from "./quitar-reserva-dialog";
import { TablaPendientes, TablaVencidas } from "./tabla-reservas";

export type ListadoInicial =
  | { tab: "pendientes"; datos: ListadoReservasPendientes }
  | { tab: "vencidas"; datos: ListadoReservasVencidas };

/** Parámetros de `GET /api/reservas/<tab>` (página 1): mismos nombres que la URL, sin `tab`. */
function parametrosApi(tab: PestanaReservas, filtros: FiltrosReservas): string {
  const params = new URLSearchParams({ pagina: "1" });
  if (filtros.alumno) params.set("alumno", filtros.alumno);
  if (filtros.materiaId) params.set("materia_id", filtros.materiaId);
  if (filtros.vencen && tab === "pendientes") params.set("vencen", filtros.vencen);
  return params.toString();
}

/**
 * Pestañas, filtros y tabla de Reservas (HU-C-26 criterios 2 a 6). Misma
 * mecánica que `listado-personal.tsx` (HU-F-03):
 * - El primer render llega del servidor con la pestaña, los filtros y la
 *   página de la URL. Las pestañas son enlaces (`?tab=`): cambiar de pestaña
 *   vuelve a la página 1 sin filtros (task, 0.4 punto 1).
 * - Los filtros (alumno o DNI desde 2 caracteres, materia y, en Pendientes,
 *   «Vencen») se combinan: con debounce se consulta la API en la página 1,
 *   sin recargar, descartando respuestas viejas, y la URL se actualiza con
 *   `replaceState`.
 * - El paginador navega; el servidor manda los datos nuevos (también tras
 *   «Quitar», con `router.refresh()`) y este componente los adopta sin
 *   remontarse.
 */
export function ListadoReservas({ listado, filtrosIniciales, materias }: {
  listado: ListadoInicial;
  filtrosIniciales: FiltrosReservas;
  materias: OpcionMateriaReservas[];
}) {
  const { tab } = listado;
  const [busqueda, setBusqueda] = useState(filtrosIniciales.alumno ?? "");
  const [materiaId, setMateriaId] = useState(filtrosIniciales.materiaId);
  const [vencen, setVencen] = useState(filtrosIniciales.vencen);
  // Los datos en pantalla y los filtros con los que se obtuvieron.
  const [resultado, setResultado] = useState({ filtros: filtrosIniciales, listado });
  const [buscandoLento, setBuscandoLento] = useState(false);
  const [error, setError] = useState(false);
  const [porQuitar, setPorQuitar] = useState<ReservaPendienteVista | null>(null);
  const peticion = useRef<AbortController | null>(null);
  const avisoLento = useRef<number | undefined>(undefined);

  // Datos nuevos del servidor (paginación, pestaña o refresco): se adoptan en
  // el mismo render, sin remontar el componente.
  const [origen, setOrigen] = useState(listado);
  if (origen !== listado) {
    setOrigen(listado);
    setBusqueda(filtrosIniciales.alumno ?? "");
    setMateriaId(filtrosIniciales.materiaId);
    setVencen(filtrosIniciales.vencen);
    setResultado({ filtros: filtrosIniciales, listado });
    setError(false);
  }

  const alumno = terminoBusqueda(busqueda);
  const filtros = useMemo<FiltrosReservas>(() => ({
    ...(alumno ? { alumno } : {}),
    ...(materiaId ? { materiaId } : {}),
    ...(vencen && tab === "pendientes" ? { vencen } : {}),
  }), [alumno, materiaId, vencen, tab]);
  const clave = parametrosListadoReservas({ tab, ...filtros });
  const claveResultado = parametrosListadoReservas({ tab, ...resultado.filtros });

  const terminar = useCallback(() => {
    window.clearTimeout(avisoLento.current);
    setBuscandoLento(false);
  }, []);

  const cargar = useCallback(async (buscados: FiltrosReservas) => {
    peticion.current?.abort();
    const controller = new AbortController();
    peticion.current = controller;
    setError(false);
    window.clearTimeout(avisoLento.current);
    avisoLento.current = window.setTimeout(() => setBuscandoLento(true), ESPERA_AVISO_CARGA_MS);
    try {
      const respuesta = await fetchAutenticado(`/api/reservas/${tab}?${parametrosApi(tab, buscados)}`, { signal: controller.signal, cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !valor?.data || controller.signal.aborted) throw new Error("reservas");
      terminar();
      setResultado({ filtros: buscados, listado: { tab, datos: valor.data } as ListadoInicial });
      window.history.replaceState(null, "", `/reservas${parametrosListadoReservas({ tab, ...buscados })}`);
    } catch {
      // Cancelada por una consulta más nueva: esa maneja el estado.
      if (peticion.current !== controller) return;
      terminar();
      if (!controller.signal.aborted) setError(true);
    }
  }, [tab, terminar]);

  // Cada cambio de los filtros efectivos consulta de nuevo en la página 1.
  useEffect(() => {
    if (clave === claveResultado) return;
    const timer = window.setTimeout(() => void cargar(filtros), ESPERA_BUSQUEDA_MS);
    return () => {
      window.clearTimeout(timer);
      peticion.current?.abort();
    };
  }, [clave, claveResultado, cargar, filtros]);

  useEffect(() => () => window.clearTimeout(avisoLento.current), []);

  const limpiar = () => {
    setBusqueda("");
    setMateriaId(undefined);
    setVencen(undefined);
  };
  const hayFiltros = busqueda.trim() !== "" || Boolean(materiaId) || (tab === "pendientes" && Boolean(vencen));
  const mostrarError = error && clave !== claveResultado;
  const { paginacion } = resultado.listado.datos;
  const campo = "flex items-center gap-2 rounded-md border border-input bg-card px-3 text-sm";

  return (
    <div className="space-y-4">
      <nav aria-label={texto("ui.reservas.tabs.etiqueta")} className="flex gap-6 border-b border-border">
        {(["pendientes", "vencidas"] as const).map((pestana) => (
          <Link
            key={pestana}
            href={`/reservas${parametrosListadoReservas({ tab: pestana })}`}
            aria-current={tab === pestana ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center border-b-2 px-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === pestana ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {pestana === "pendientes" ? texto("ui.reservas.tabs.pendientes") : texto("ui.reservas.tabs.vencidas")}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[16rem] flex-1">
          <CampoBusqueda
            valor={busqueda}
            onCambiar={setBusqueda}
            placeholder={texto("ui.reservas.filtros.alumnoPlaceholder")}
            etiqueta={texto("ui.reservas.filtros.alumnoEtiqueta")}
            buscando={buscandoLento}
            textoBuscando={texto("ui.reservas.filtros.buscando")}
          />
        </div>
        <label className={campo}>
          <span className="text-muted-foreground">{texto("ui.reservas.filtros.materia")}</span>
          <select value={materiaId ?? ""} onChange={(evento) => setMateriaId(evento.target.value || undefined)}
            className="h-9 bg-transparent font-medium outline-none">
            <option value="">{texto("ui.reservas.filtros.materiaTodas")}</option>
            {materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.nombre}</option>)}
          </select>
        </label>
        {tab === "pendientes" && (
          <label className={campo}>
            <span className="text-muted-foreground">{texto("ui.reservas.filtros.vencen")}</span>
            <select value={vencen ?? ""} onChange={(evento) => setVencen((evento.target.value || undefined) as VencenReservas | undefined)}
              className="h-9 bg-transparent font-medium outline-none">
              <option value="">{texto("ui.reservas.filtros.vencenTodas")}</option>
              <option value="en_3_horas">{texto("ui.reservas.filtros.vencenEnTresHoras")}</option>
              <option value="hoy">{texto("ui.reservas.filtros.vencenHoy")}</option>
              <option value="manana">{texto("ui.reservas.filtros.vencenManana")}</option>
            </select>
          </label>
        )}
        {hayFiltros && (
          <Button type="button" variant="ghost" size="sm" className="underline underline-offset-4" onClick={limpiar}>{texto("ui.reservas.filtros.limpiar")}</Button>
        )}
      </div>

      {mostrarError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-destructive">{texto("ui.reservas.error")}</p>
          <Button variant="outline" size="sm" onClick={() => void cargar(filtros)}>{texto("ui.reservas.reintentar")}</Button>
        </div>
      ) : resultado.listado.datos.items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">{textoVacio(resultado.listado.tab, resultado.filtros)}</p>
        </div>
      ) : (
        <div aria-busy={buscandoLento} className="space-y-4">
          {resultado.listado.tab === "pendientes"
            ? <TablaPendientes items={resultado.listado.datos.items} onQuitar={setPorQuitar} />
            : <TablaVencidas items={resultado.listado.datos.items} />}
          <Pagination
            paginaActual={paginacion.pagina_actual}
            totalPaginas={paginacion.total_paginas}
            total={paginacion.total}
            porPagina={paginacion.por_pagina}
            buildHref={(pagina) => `/reservas${parametrosListadoReservas({ tab, ...resultado.filtros, pagina })}`}
          />
        </div>
      )}

      <QuitarReservaDialog reserva={porQuitar} onCerrar={() => setPorQuitar(null)} />
    </div>
  );
}

function textoVacio(tab: PestanaReservas, filtros: FiltrosReservas): string {
  if (filtros.alumno && !filtros.materiaId && !filtros.vencen) return texto("ui.reservas.vacio.conAlumno", { q: filtros.alumno });
  if (filtros.alumno || filtros.materiaId || filtros.vencen) return texto("ui.reservas.vacio.conFiltro");
  return tab === "pendientes" ? texto("ui.reservas.vacio.pendientes") : texto("ui.reservas.vacio.vencidas");
}
