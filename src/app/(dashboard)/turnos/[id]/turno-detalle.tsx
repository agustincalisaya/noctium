"use client";

import { texto as textoC19 } from "@/lib/textos";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import type { TurnoDetalle } from "@/types/turno.types";
import { TurnoAlumnosCard } from "./turno-alumnos-card";
import { TurnoDatosCard } from "./turno-datos-card";
import { TurnoDetalleEncabezado } from "./turno-detalle-encabezado";
import { TurnoPagoCard } from "./turno-pago-card";
import { AsignarPrioridadDialog } from "./asignar-prioridad-dialog";
import { CancelarTurnoDialog } from "./cancelar-turno-dialog";
import { ReprogramarTurnoDialog } from "./reprogramar-turno-dialog";
import { diaAbreviadoYFecha } from "@/lib/turno-detalle";

/**
 * Detalle de turno (HU-C-09, mockup pág. 5): contenedor que consulta
 * `GET /api/turnos/[id]` y reparte los datos en subcomponentes, uno por zona,
 * para que C-05, C-06, C-10 y E-01 se enganchen sin pisarse.
 */
export function TurnoDetalleVista({ id, retorno, puedeConfigurar, puedeGestionarAlumnos, puedeRegistrarClase = false, puedeRegistrarIndicacion = false, esProfesor = false }: { id: string; retorno: string; puedeConfigurar: boolean; puedeGestionarAlumnos: boolean; puedeRegistrarClase?: boolean; puedeRegistrarIndicacion?: boolean; esProfesor?: boolean }) {
  const [turno, setTurno] = useState<TurnoDetalle | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [prioridadAbierta, setPrioridadAbierta] = useState(false);
  const [reprogramacionAbierta, setReprogramacionAbierta] = useState(false);
  const [cancelacion, setCancelacion] = useState<"cancelar" | "descartar" | null>(null);
  const cargar = useCallback(async (recarga = false) => {
    if (!recarga) setCargando(true);
    setError("");
    try {
      const response = await fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message ?? textoC19("ui.clases.interfaz.noSePudoConsultarLaClase"));
      if (!result?.data) throw new Error(textoC19("ui.clases.interfaz.noSePudoConsultarLaClase"));
      setTurno(result.data);
    } catch (err) { setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : textoC19("ui.clases.interfaz.noSePudoConsultarLaClaseIntentaNuevamente")); }
    finally { setCargando(false); }
  }, [id]);
  useEffect(() => { const inicial = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(inicial); }, [cargar]);
  const turnoActual = cargando || error || turno?.id !== id ? null : turno;
  const gestionable = puedeGestionarAlumnos && (turnoActual?.estado === "DISPONIBLE" || turnoActual?.estado === "COMPLETO");

  return <main className="mx-auto w-full min-w-0 max-w-6xl space-y-[18px]">
    <TurnoDetalleEncabezado turno={turnoActual} retorno={retorno} onReprogramar={() => setReprogramacionAbierta(true)} onAsignarPrioridad={() => setPrioridadAbierta(true)} onCancelar={setCancelacion} />
    {reprogramacionAbierta && turnoActual?.acciones_habilitadas.includes("reprogramar") && <ReprogramarTurnoDialog
      turno={turnoActual} onCerrar={() => setReprogramacionAbierta(false)} onCambio={() => cargar(true)}
    />}
    {prioridadAbierta && turnoActual?.acciones_habilitadas.includes("prioridad") && <AsignarPrioridadDialog
      turnoId={turnoActual.id} prioridadActual={turnoActual.prioridad} onCerrar={() => setPrioridadAbierta(false)} onCambio={() => cargar(true)}
    />}
    {cancelacion && turnoActual?.acciones_habilitadas.includes(cancelacion) && <CancelarTurnoDialog
      turnoId={turnoActual.id} modo={cancelacion}
      resumen={cancelacion === "cancelar" ? resumenCancelacion(turnoActual) : undefined}
      cantidadPagos={turnoActual.pagos?.length}
      onCerrar={() => setCancelacion(null)} onCambio={() => cargar(true)}
    />}
    {turnoActual?.estado === "PENDIENTE" && (puedeConfigurar || (puedeGestionarAlumnos && turnoActual.aula_id)) && <div className="flex flex-wrap gap-3">{puedeConfigurar && <Link className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(id)}/configuracion?volver=${encodeURIComponent(retorno)}`} prefetch={false}>{turnoActual.aula_id ? textoC19("ui.clases.interfaz.modificarConfiguracionOAula") : textoC19("ui.clases.interfaz.modificarConfiguracionYAsignarAula")}</Link>}{puedeGestionarAlumnos && turnoActual.aula_id && <Link className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(id)}/participantes?volver=${encodeURIComponent(retorno)}`} prefetch={false}>{textoC19("ui.clases.interfaz.asignarProfesorYAlumnos")}</Link>}</div>}
    {cargando ? <p role="status">{textoC19("ui.clases.interfaz.cargandoClase")}</p> : error ? <div role="alert" className="space-y-3 rounded-md border border-border bg-card p-4"><p>{error}</p><Button variant="outline" onClick={() => void cargar()}>{textoC19("ui.formasPago.reintentar")}</Button></div> : turnoActual && (
      // Mockup pág. 5: columnas proporcionales 2:1 con datos y alumnos; a la derecha
      // con «Pago» para quienes pueden consultar pagos, como en el mockup.
      <div className={`grid gap-[18px] ${turnoActual.pagos ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}>
        <div className="min-w-0 space-y-[18px]">
          <TurnoDatosCard turno={turnoActual} />
          <TurnoAlumnosCard turno={turnoActual} gestionable={gestionable} puedeRegistrarClase={puedeRegistrarClase} puedeRegistrarIndicacion={puedeRegistrarIndicacion} esProfesor={esProfesor} onCambio={() => cargar(true)} />
        </div>
        {(turnoActual.pagos) && <aside aria-label={textoC19("ui.clases.interfaz.pagoYClase")} className="min-w-0 space-y-[18px]">
          <TurnoPagoCard pagos={turnoActual.pagos} />
        </aside>}
      </div>
    )}
  </main>;
}

/** Mockup pág. 8: «Matemática III · Mar 06/10, 16:00–17:00 · Aula 3 · 3 alumnos inscriptos». */
function resumenCancelacion(turno: TurnoDetalle) {
  const alumnos = `${turno.alumnos.length} ${turno.alumnos.length === 1 ? textoC19("ui.clases.interfaz.alumnoInscripto") : textoC19("ui.clases.interfaz.alumnosInscriptosNumeroDos")}`;
  return [turno.materia, `${diaAbreviadoYFecha(turno.fecha)}, ${turno.hora_inicio}–${turno.hora_fin}`, turno.aula, alumnos].join(" · ");
}
