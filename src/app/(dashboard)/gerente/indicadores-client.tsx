"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GraficoMensual } from "@/components/indicadores/grafico-mensual";
import type { IndicadoresMensuales } from "@/types/indicadores.types";

type RangoSeleccionado = { desde: string; hasta: string };
type RespuestaIndicadores = {
  data?: IndicadoresMensuales | null;
  error?: { message?: string } | null;
};

type OpcionMes = { valor: string; etiqueta: string };

function sumarMeses(mes: string, cantidad: number): string {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio!, numeroMes! - 1 + cantidad, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

function crearOpcionesMes(mesActual: string | null): OpcionMes[] {
  if (!mesActual) return [];

  const mesLargo = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" });
  const anioLargo = new Intl.DateTimeFormat("es-AR", { year: "numeric", timeZone: "UTC" });
  return Array.from({ length: 24 }, (_, indice) => {
    const valor = sumarMeses(mesActual, indice - 23);
    const fecha = new Date(`${valor}-01T12:00:00.000Z`);
    const mes = mesLargo.format(fecha);
    const etiqueta = `${mes.charAt(0).toLocaleUpperCase("es-AR")}${mes.slice(1)} ${anioLargo.format(fecha)}`;
    return { valor, etiqueta };
  });
}

const CLASE_CONTROL_FECHA = "flex h-10 w-full items-center gap-1 rounded-md border border-input bg-card px-3 shadow-xs transition-colors focus-within:ring-[3px] focus-within:ring-ring/50";
const CLASE_SELECT_MES = "h-full min-w-0 flex-1 border-0 bg-transparent px-1 py-0 text-sm font-medium text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60";

function validarRango(rango: RangoSeleccionado): string | null {
  if (rango.desde > rango.hasta) return "El mes desde no puede ser posterior al mes hasta";
  const [anioDesde, mesDesde] = rango.desde.split("-").map(Number);
  const [anioHasta, mesHasta] = rango.hasta.split("-").map(Number);
  const cantidad = (anioHasta! - anioDesde!) * 12 + (mesHasta! - mesDesde!) + 1;
  if (cantidad > 24) return "El rango máximo es de 24 meses";
  return null;
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "No se pudieron cargar los indicadores. Intentá nuevamente.";
}

export function IndicadoresClient() {
  const [rango, setRango] = useState<RangoSeleccionado | null>(null);
  const [mesActual, setMesActual] = useState<string | null>(null);
  const [datos, setDatos] = useState<IndicadoresMensuales | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const omitirConsultaInicialRef = useRef(false);
  const errorDeRango = useMemo(() => (rango ? validarRango(rango) : null), [rango]);

  useEffect(() => {
    if (rango && omitirConsultaInicialRef.current) {
      omitirConsultaInicialRef.current = false;
      return;
    }

    const controlador = new AbortController();
    const cargar = async () => {
      if (rango && errorDeRango) {
        setCargando(false);
        setError(null);
        return;
      }

      setCargando(true);
      setError(null);
      const query = rango
        ? `?desde=${encodeURIComponent(rango.desde)}&hasta=${encodeURIComponent(rango.hasta)}`
        : "";

      try {
        const respuesta = await fetch(`/api/indicadores${query}`, {
          cache: "no-store",
          signal: controlador.signal,
        });
        const cuerpo = (await respuesta.json().catch(() => null)) as RespuestaIndicadores | null;
        if (!respuesta.ok || !cuerpo?.data) {
          throw new Error(cuerpo?.error?.message ?? "No se pudieron cargar los indicadores. Intentá nuevamente.");
        }

        setDatos(cuerpo.data);
        if (!rango) {
          setMesActual(cuerpo.data.rango.hasta);
          omitirConsultaInicialRef.current = true;
          setRango({ desde: cuerpo.data.rango.desde, hasta: cuerpo.data.rango.hasta });
        }
      } catch (fallo) {
        if (fallo instanceof Error && fallo.name === "AbortError") return;
        setError(mensajeDeError(fallo));
      } finally {
        if (!controlador.signal.aborted) setCargando(false);
      }
    };

    void cargar();
    return () => controlador.abort();
  }, [errorDeRango, rango, reintento]);

  const cantidadTotalTurnos = datos?.meses.reduce((total, mes) => total + mes.turnos, 0) ?? 0;
  const cantidadTotalAlumnos = datos?.meses.reduce((total, mes) => total + mes.alumnos_nuevos, 0) ?? 0;
  const periodoSinDatos = Boolean(datos?.meses.length) && datos!.meses.every((mes) => mes.turnos === 0 && mes.alumnos_nuevos === 0);
  const opcionesMes = useMemo(() => crearOpcionesMes(mesActual), [mesActual]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">Indicadores</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Por defecto, los últimos 6 meses incluido el actual. El mismo rango aplica a los dos indicadores.
          </p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[25.5rem]">
          <div className={CLASE_CONTROL_FECHA}>
            <label htmlFor="indicadores-desde" className="shrink-0 text-sm text-muted-foreground">Desde</label>
            <select
              id="indicadores-desde"
              value={rango?.desde ?? ""}
              disabled={!rango || (cargando && !datos)}
              onChange={(evento) => {
                const desde = evento.currentTarget.value;
                setRango((actual) => actual ? { ...actual, desde } : actual);
              }}
              className={CLASE_SELECT_MES}
            >
              {opcionesMes.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
            </select>
          </div>
          <div className={CLASE_CONTROL_FECHA}>
            <label htmlFor="indicadores-hasta" className="shrink-0 text-sm text-muted-foreground">Hasta</label>
            <select
              id="indicadores-hasta"
              value={rango?.hasta ?? ""}
              disabled={!rango || (cargando && !datos)}
              onChange={(evento) => {
                const hasta = evento.currentTarget.value;
                setRango((actual) => actual ? { ...actual, hasta } : actual);
              }}
              className={CLASE_SELECT_MES}
            >
              {opcionesMes.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
            </select>
          </div>
        </div>
      </div>

      {errorDeRango && <p role="alert" className="text-sm font-medium text-destructive">{errorDeRango}</p>}
      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive-soft-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReintento((valor) => valor + 1)}
            className="rounded-md border border-current px-3 py-2 font-medium transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reintentar
          </button>
        </div>
      )}

      {cargando && !datos ? (
        <div className="space-y-4" aria-label="Cargando indicadores" role="status">
          <GraficoSkeleton />
          <GraficoSkeleton />
        </div>
      ) : datos ? (
        <div className="space-y-4" aria-busy={cargando}>
          {cargando && <p role="status" className="text-sm text-muted-foreground">Actualizando indicadores…</p>}
          {periodoSinDatos && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              No hay datos para el período seleccionado.
            </p>
          )}
          <GraficoMensual
            titulo="Turnos por mes"
            descripcion="Por fecha del turno; Disponible, Completo y Cancelado (sin Pendiente)."
            etiquetaValor="Turnos"
            color="chart-1"
            total={cantidadTotalTurnos}
            datos={datos.meses.map(({ mes, turnos }) => ({ mes, cantidad: turnos }))}
          />
          <GraficoMensual
            titulo="Alumnos nuevos por mes"
            descripcion="Por fecha de alta de la ficha."
            etiquetaValor="Alumnos nuevos"
            color="chart-2"
            total={cantidadTotalAlumnos}
            datos={datos.meses.map(({ mes, alumnos_nuevos }) => ({ mes, cantidad: alumnos_nuevos }))}
          />
        </div>
      ) : null}
    </div>
  );
}

function GraficoSkeleton() {
  return (
    <section aria-hidden="true" className="rounded-xl border border-border bg-card p-5">
      <div className="animate-pulse">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-3 w-72 max-w-full rounded bg-muted" />
          </div>
          <div className="h-8 w-14 rounded bg-muted" />
        </div>
        <div className="mt-7 flex h-48 items-end justify-around gap-4 border-b border-border px-4">
          {[54, 82, 66, 38, 96, 73].map((alto, indice) => (
            <div key={indice} className="w-10 rounded-t bg-muted" style={{ height: `${alto}%` }} />
          ))}
        </div>
      </div>
    </section>
  );
}
