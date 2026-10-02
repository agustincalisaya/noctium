"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GraficoIngresos, GraficoOcupacion } from "@/components/indicadores/graficos-indicadores";
import type { IngresoMes, OcupacionMes } from "@/types/indicadores.types";

type RangoSeleccionado = { desde: string; hasta: string };
type Respuesta<T> = { data?: T[] | null; error?: { message?: string } | null };
type Datos = { ingresos: IngresoMes[]; ocupacion: OcupacionMes[] };
type OpcionMes = { valor: string; etiqueta: string };

const MENSAJE_ERROR = "No se pudieron cargar los indicadores. Intentá nuevamente.";

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

async function pedir<T>(ruta: string, query: string, signal: AbortSignal): Promise<T[]> {
  const respuesta = await fetch(`${ruta}${query}`, { cache: "no-store", signal });
  const cuerpo = (await respuesta.json().catch(() => null)) as Respuesta<T> | null;
  if (!respuesta.ok || !cuerpo?.data) throw new Error(cuerpo?.error?.message ?? MENSAJE_ERROR);
  return cuerpo.data;
}

/** Pantalla "Indicadores" (spec_modulo_H.md §2.2 y §2.3): un rango compartido para los dos gráficos. */
export function IndicadoresClient() {
  const [rango, setRango] = useState<RangoSeleccionado | null>(null);
  const [mesActual, setMesActual] = useState<string | null>(null);
  const [datos, setDatos] = useState<Datos | null>(null);
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
        const [ingresos, ocupacion] = await Promise.all([
          pedir<IngresoMes>("/api/indicadores/ingresos-por-mes", query, controlador.signal),
          pedir<OcupacionMes>("/api/indicadores/ocupacion-por-mes", query, controlador.signal),
        ]);
        setDatos({ ingresos, ocupacion });
        // Sin rango elegido todavía: la respuesta trae el rango por defecto
        // resuelto en el servidor (primer y último mes) para precargar los selectores.
        if (!rango && ingresos.length) {
          const desde = ingresos[0]!.mes;
          const hasta = ingresos[ingresos.length - 1]!.mes;
          setMesActual(hasta);
          omitirConsultaInicialRef.current = true;
          setRango({ desde, hasta });
        }
      } catch (fallo) {
        if (fallo instanceof Error && fallo.name === "AbortError") return;
        setError(fallo instanceof Error && fallo.message ? fallo.message : MENSAJE_ERROR);
      } finally {
        if (!controlador.signal.aborted) setCargando(false);
      }
    };

    void cargar();
    return () => controlador.abort();
  }, [errorDeRango, rango, reintento]);

  const opcionesMes = useMemo(() => crearOpcionesMes(mesActual), [mesActual]);
  const periodoSinDatos = !cargando && datos !== null
    && datos.ingresos.every(({ total }) => total === 0)
    && datos.ocupacion.every(({ ocupacion_promedio }) => ocupacion_promedio === 0);
  const mostrarGraficos = !error && !errorDeRango && (cargando || (datos !== null && !periodoSinDatos));

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
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive bg-destructive-soft p-4 text-sm text-destructive-soft-foreground sm:flex-row sm:items-center sm:justify-between">
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

      {periodoSinDatos && !error && !errorDeRango && (
        <p role="status" className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay suficientes datos para este período
        </p>
      )}

      {mostrarGraficos && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GraficoIngresos datos={datos?.ingresos ?? []} cargando={cargando} />
          <GraficoOcupacion datos={datos?.ocupacion ?? []} cargando={cargando} />
        </div>
      )}
    </div>
  );
}
