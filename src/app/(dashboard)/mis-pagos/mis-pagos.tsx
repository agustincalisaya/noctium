"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import {
  filtrosInicialesMisPagos, filtrosVaciosMisPagos, hayFiltrosMisPagos, parametrosMisPagos, type FiltrosMisPagos,
} from "@/lib/mis-pagos-listado";
import { texto } from "@/lib/textos";
import { monto } from "@/lib/turno-detalle";
import type { MisPagosData, OpcionesMisPagos } from "@/types/pago.types";
import { TablaMisPagos } from "./tabla-mis-pagos";

const CAMPO = "flex min-h-10 max-w-full min-w-0 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring";
const CONTROL = "min-w-0 bg-card text-foreground outline-none";

/**
 * «Mis pagos» (HU-I-05, spec_modulo_I.md §2.15): consulta propia, sin
 * acciones de escritura. Los filtros y la página viven en la URL
 * (`replaceState`), así al volver del comprobante se conservan; cada cambio
 * vuelve a la página 1 y las respuestas viejas se descartan. Las opciones de
 * materia se piden aparte y no dependen de los filtros.
 */
export function MisPagos() {
  const searchParams = useSearchParams();
  const [filtros, setFiltros] = useState<FiltrosMisPagos>(() => filtrosInicialesMisPagos(Object.fromEntries(searchParams)));
  const [opciones, setOpciones] = useState<OpcionesMisPagos | null>(null);
  const [errorOpciones, setErrorOpciones] = useState(false);
  const [intentoOpciones, setIntentoOpciones] = useState(0);
  const [data, setData] = useState<MisPagosData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);
  const query = parametrosMisPagos(filtros).toString();

  useEffect(() => {
    const controller = new AbortController();
    fetchAutenticado("/api/mis-pagos/opciones", { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("opciones");
        const result: { data: OpcionesMisPagos } = await r.json();
        if (controller.signal.aborted) return;
        setOpciones(result.data);
        setErrorOpciones(false);
        // Una materia de la URL que no es de sus clases pagadas se descarta (normalización inicial).
        setFiltros((actual) => actual.materia_id && !result.data.materias.some((m) => m.id === actual.materia_id)
          ? { ...actual, materia_id: "", pagina: 1 } : actual);
      })
      .catch(() => { if (!controller.signal.aborted) setErrorOpciones(true); });
    return () => controller.abort();
  }, [intentoOpciones]);

  useEffect(() => {
    if (rangoInvalido) return;
    const controller = new AbortController();
    fetchAutenticado(`/api/mis-pagos${query ? `?${query}` : ""}`, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        const result = await r.json().catch(() => null);
        if (!r.ok) throw new Error(result?.error?.message ?? "");
        if (controller.signal.aborted) return;
        const recibida: MisPagosData = result.data;
        if (recibida.paginacion.pagina_actual !== filtros.pagina) {
          // Página fuera de rango: el servidor la llevó a la última; se pide esa.
          setFiltros((actual) => ({ ...actual, pagina: recibida.paginacion.pagina_actual }));
          return;
        }
        setData(recibida);
        setCargando(false);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error && e.message ? e.message : texto("ui.pagos.propios.error"));
        setCargando(false);
      });
    return () => controller.abort();
  }, [query, intento, rangoInvalido, filtros.pagina]);

  useEffect(() => {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [query]);

  function iniciarCarga() {
    setCargando(true);
    setError(null);
  }

  function cambiar(clave: "desde" | "hasta" | "materia_id", valor: string) {
    iniciarCarga();
    setFiltros((actual) => ({ ...actual, [clave]: valor, pagina: 1 }));
  }

  const listo = data !== null && !cargando && !error && !rangoInvalido;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5" aria-busy={cargando && !rangoInvalido}>
      <header>
        <h1 className="text-2xl font-semibold">{texto("ui.pagos.propios.titulo")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{texto("ui.pagos.propios.descripcion")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className={CAMPO}>
          <span>{texto("ui.pagos.propios.desde")}</span>
          <input type="date" value={filtros.desde} max={filtros.hasta || undefined}
            onChange={(e) => cambiar("desde", e.target.value)} className={CONTROL} />
        </label>
        <label className={CAMPO}>
          <span>{texto("ui.pagos.propios.hasta")}</span>
          <input type="date" value={filtros.hasta} min={filtros.desde || undefined}
            onChange={(e) => cambiar("hasta", e.target.value)} className={CONTROL} />
        </label>
        <label className={CAMPO}>
          <span>{texto("ui.pagos.propios.materia")}</span>
          <select value={filtros.materia_id} onChange={(e) => cambiar("materia_id", e.target.value)} className={`${CONTROL} max-w-56 font-medium`}>
            <option value="">{texto("ui.pagos.propios.todas")}</option>
            {opciones?.materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>
        {hayFiltrosMisPagos(filtros) && (
          <button type="button" className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => { iniciarCarga(); setFiltros(filtrosVaciosMisPagos); }}>
            {texto("ui.pagos.propios.limpiar")}
          </button>
        )}
        {listo && (
          <p className="w-full text-sm text-muted-foreground sm:ml-auto sm:w-auto" aria-live="polite">
            {texto("ui.pagos.propios.total")}{" "}
            <strong className="font-mono tabular-nums text-foreground">{monto(data.total_pagado)}</strong>
          </p>
        )}
      </div>

      {rangoInvalido && <p role="alert" className="text-sm text-destructive">{texto("ui.pagos.propios.rangoInvalido")}</p>}
      {errorOpciones && (
        <p role="alert" className="text-sm text-destructive">
          {texto("ui.pagos.propios.errorOpciones")}{" "}
          <button type="button" className="text-primary underline underline-offset-4"
            onClick={() => { setErrorOpciones(false); setIntentoOpciones((n) => n + 1); }}>
            {texto("ui.pagos.propios.reintentar")}
          </button>
        </p>
      )}

      {!rangoInvalido && (
        <div className="rounded-lg border border-border bg-card">
          {cargando ? (
            <p role="status" className="p-6 text-center text-sm text-muted-foreground">{texto("ui.pagos.propios.cargando")}</p>
          ) : error ? (
            <div role="alert" className="space-y-3 p-6">
              <p className="text-sm text-destructive">{error}</p>
              <Button type="button" variant="outline" onClick={() => { iniciarCarga(); setIntento((n) => n + 1); }}>
                {texto("ui.pagos.propios.reintentar")}
              </Button>
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <TablaMisPagos items={data.items} />
              {data.paginacion.total_paginas > 1 && (
                <div className="border-t border-border px-4 pb-3">
                  <Pagination paginaActual={data.paginacion.pagina_actual} totalPaginas={data.paginacion.total_paginas}
                    total={data.paginacion.total} porPagina={data.paginacion.por_pagina} mostrarRango mostrarNumeros
                    buildHref={(pagina) => `/mis-pagos?${parametrosMisPagos({ ...filtros, pagina })}`}
                    onPageChange={(pagina) => { iniciarCarga(); setFiltros((actual) => ({ ...actual, pagina })); }} />
                </div>
              )}
            </>
          ) : (
            <p role="status" className="p-10 text-center text-sm text-muted-foreground">
              {texto(hayFiltrosMisPagos(filtros) ? "ui.pagos.historial.sinFiltros" : "ui.pagos.propios.sinPagos")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
