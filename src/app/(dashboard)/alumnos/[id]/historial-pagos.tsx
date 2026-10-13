"use client";

import { useEffect, useState } from "react";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";
import { formatearDineroHistorial } from "@/lib/pagos-historial-listado";
import { Pagination } from "@/components/shared/pagination";
import { filtrosInicialesHistorialPagos, filtrosVaciosHistorialPagos, parametrosHistorialPagos, type FiltrosHistorialPagos } from "@/lib/pagos-historial-listado";
import type { HistorialPagosData, OpcionesHistorialPagos } from "@/types/pago.types";
import { TablaHistorialPagos } from "./tabla-historial-pagos";

const opcionesVacias: OpcionesHistorialPagos = { formas_pago: [], materias: [] };

export function HistorialPagos({ alumnoId, alumnoNombre, puedeRegistrarPago, iniciales }: {
  alumnoId: string;
  /** «Nombre Apellido», para los diálogos de corregir y anular (HU-I-06). */
  alumnoNombre: string;
  puedeRegistrarPago: boolean;
  iniciales: Record<string, string | undefined>;
}) {
  const [filtros, setFiltros] = useState<FiltrosHistorialPagos>(() => filtrosInicialesHistorialPagos(iniciales));
  const [opciones, setOpciones] = useState<OpcionesHistorialPagos>(opcionesVacias);
  const [errorOpciones, setErrorOpciones] = useState(false);
  const [intentoOpciones, setIntentoOpciones] = useState(0);
  const [data, setData] = useState<HistorialPagosData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const modoEstado = Boolean(filtros.estado_pago);
  const query = parametrosHistorialPagos(filtros, alumnoId).toString();

  useEffect(() => {
    const controller = new AbortController();
    fetchAutenticado(`/api/pagos/historial/opciones?alumno_id=${encodeURIComponent(alumnoId)}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("opciones");
        const result = await r.json();
        if (!controller.signal.aborted) { setOpciones(result.data); setErrorOpciones(false); }
      })
      .catch(() => { if (!controller.signal.aborted) setErrorOpciones(true); });
    return () => controller.abort();
  }, [alumnoId, intentoOpciones]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAutenticado(`/api/pagos/historial?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("historial");
        const result: { data: HistorialPagosData } = await r.json();
        if (controller.signal.aborted) return;
        setData(result.data);
        setCargando(false);
        if (result.data.paginacion.pagina_actual !== filtros.pagina) {
          setCargando(true);
          setFiltros((actual) => ({ ...actual, pagina: result.data.paginacion.pagina_actual }));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) { setError(true); setCargando(false); }
      });
    return () => controller.abort();
  }, [query, intento, filtros.pagina]);

  useEffect(() => {
    const params = parametrosHistorialPagos(filtros);
    const ruta = window.location.pathname;
    if (!ruta.endsWith("/pagos")) params.set("tab", "pagos");
    const cadena = params.toString();
    window.history.replaceState(window.history.state, "", `${ruta}${cadena ? `?${cadena}` : ""}`);
  }, [filtros]);

  function iniciarCarga() {
    setCargando(true);
    setError(false);
    setData(null);
  }

  function cambiar<K extends keyof FiltrosHistorialPagos>(clave: K, valor: FiltrosHistorialPagos[K]) {
    iniciarCarga();
    setFiltros((actual) => {
      const nuevo = { ...actual, [clave]: valor, pagina: 1 };
      if (clave === "estado_pago" && valor) {
        nuevo.forma_pago_id = "";
        nuevo.materia_id = "";
      }
      return nuevo;
    });
  }

  return (
    <section aria-label={texto("ui.pagos.historial.titulo")} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{texto(modoEstado ? "ui.pagos.historial.desdeClase" : "ui.pagos.historial.desdePago")}</span>
          <input aria-label={texto(modoEstado ? "ui.pagos.historial.desdeClase" : "ui.pagos.historial.desdePago")} type="date" value={filtros.desde} onChange={(e) => cambiar("desde", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{texto(modoEstado ? "ui.pagos.historial.hastaClase" : "ui.pagos.historial.hastaPago")}</span>
          <input aria-label={texto(modoEstado ? "ui.pagos.historial.hastaClase" : "ui.pagos.historial.hastaPago")} type="date" value={filtros.hasta} onChange={(e) => cambiar("hasta", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{texto("ui.pagos.historial.forma")}</span>
          <select value={filtros.forma_pago_id} disabled={modoEstado} onChange={(e) => cambiar("forma_pago_id", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 disabled:opacity-50">
            <option value="">{texto("ui.pagos.historial.todas")}</option>
            {opciones.formas_pago.map((f) => <option value={f.id} key={f.id}>{f.nombre}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{texto("ui.pagos.historial.materia")}</span>
          <select value={filtros.materia_id} disabled={modoEstado} onChange={(e) => cambiar("materia_id", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 disabled:opacity-50">
            <option value="">{texto("ui.pagos.historial.todas")}</option>
            {opciones.materias.map((m) => <option value={m.id} key={m.id}>{m.nombre}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{texto("ui.pagos.historial.estado")}</span>
          <select value={filtros.estado_pago} onChange={(e) => cambiar("estado_pago", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2">
            <option value="">{texto("ui.pagos.historial.todos")}</option>
            <option value="PAGADA">{texto("ui.pagos.historial.pagada")}</option>
            <option value="RESERVADA">{texto("ui.pagos.historial.reservada")}</option>
            <option value="PAGO_SIN_REGISTRAR">{texto("ui.pagos.historial.sinRegistrar")}</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-1 lg:col-span-3">
          <button type="button" className="text-sm text-primary underline underline-offset-4" onClick={() => { iniciarCarga(); setFiltros(filtrosVaciosHistorialPagos); }}>{texto("ui.pagos.historial.limpiar")}</button>
        </div>
        {modoEstado && <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">{texto("ui.pagos.historial.leyendaEstado")}</p>}
      </div>

      {errorOpciones && <p role="alert" className="text-sm text-destructive">{texto("ui.pagos.historial.errorOpciones")} <button type="button" className="text-primary underline" onClick={() => { setErrorOpciones(false); setIntentoOpciones((n) => n + 1); }}>{texto("ui.pagos.historial.reintentar")}</button></p>}
      {cargando && <p role="status" className="py-8 text-center text-sm text-muted-foreground">{texto("ui.pagos.historial.cargando")}</p>}
      {error && <div role="alert" className="rounded-lg border border-destructive/50 p-5 text-sm">
        <p>{texto("ui.pagos.historial.error")}</p>
        <button type="button" className="mt-2 text-primary underline" onClick={() => { iniciarCarga(); setIntento((n) => n + 1); }}>{texto("ui.pagos.historial.reintentar")}</button>
      </div>}
      {data && !cargando && !error && (
        <>
          {data.items.length > 0 ? <TablaHistorialPagos data={data} alumnoId={alumnoId} alumnoNombre={alumnoNombre} puedeRegistrarPago={puedeRegistrarPago}
            onActualizado={() => { iniciarCarga(); setIntento((n) => n + 1); }} /> :
            <div className="rounded-lg border border-border bg-card">
              {!modoEstado && <div className="flex items-center justify-between border-b border-border px-4 py-4 text-sm"><strong>{texto("ui.pagos.historial.titulo")}</strong><span>{texto("ui.pagos.historial.total")} <strong>{data.modo === "HISTORIAL" && formatearDineroHistorial(data.total_pagado)}</strong></span></div>}
              <p className="py-12 text-center text-sm text-muted-foreground">
              {modoEstado ? texto("ui.pagos.historial.sinClases") :
                filtros.desde || filtros.hasta || filtros.forma_pago_id || filtros.materia_id
                  ? texto("ui.pagos.historial.sinFiltros") : texto("ui.pagos.historial.sinPagos")}
              </p>
            </div>}
          <Pagination paginaActual={data.paginacion.pagina_actual} totalPaginas={data.paginacion.total_paginas}
            total={data.paginacion.total} porPagina={10} mostrarRango siempreVisible mostrarNumeros
            buildHref={(pagina) => `?${parametrosHistorialPagos({ ...filtros, pagina })}`}
            onPageChange={(pagina) => { iniciarCarga(); setFiltros((actual) => ({ ...actual, pagina })); }} />
        </>
      )}
    </section>
  );
}
