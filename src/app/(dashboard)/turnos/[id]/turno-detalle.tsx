"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import type { TurnoDetalle } from "@/types/turno.types";
import { TurnoAlumnosCard } from "./turno-alumnos-card";
import { TurnoDatosCard } from "./turno-datos-card";
import { TurnoDetalleEncabezado } from "./turno-detalle-encabezado";
import { TurnoPagoCard } from "./turno-pago-card";

/**
 * Detalle de turno (HU-C-09, mockup pág. 5): contenedor que consulta
 * `GET /api/turnos/[id]` y reparte los datos en subcomponentes, uno por zona,
 * para que C-05, C-06, C-10, I-01 y E-01 se enganchen sin pisarse.
 */
export function TurnoDetalleVista({ id, retorno, puedeConfigurar, puedeGestionarAlumnos }: { id: string; retorno: string; puedeConfigurar: boolean; puedeGestionarAlumnos: boolean }) {
  const [turno, setTurno] = useState<TurnoDetalle | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const cargar = useCallback(async (recarga = false) => {
    if (!recarga) setCargando(true);
    setError("");
    try {
      const response = await fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message ?? "No se pudo consultar el turno");
      if (!result?.data) throw new Error("No se pudo consultar el turno");
      setTurno(result.data);
    } catch (err) { setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "No se pudo consultar el turno. Intentá nuevamente."); }
    finally { setCargando(false); }
  }, [id]);
  useEffect(() => { const inicial = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(inicial); }, [cargar]);
  const turnoActual = cargando || error || turno?.id !== id ? null : turno;
  const gestionable = puedeGestionarAlumnos && (turnoActual?.estado === "DISPONIBLE" || turnoActual?.estado === "COMPLETO");

  return <main className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-6">
    <TurnoDetalleEncabezado turno={turnoActual} retorno={retorno} />
    {turnoActual?.estado === "PENDIENTE" && (puedeConfigurar || (puedeGestionarAlumnos && turnoActual.aula_id)) && <div className="flex flex-wrap gap-3">{puedeConfigurar && <Link className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(id)}/configuracion?volver=${encodeURIComponent(retorno)}`} prefetch={false}>{turnoActual.aula_id ? "Modificar configuración o aula" : "Modificar configuración y asignar aula"}</Link>}{puedeGestionarAlumnos && turnoActual.aula_id && <Link className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(id)}/participantes?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Asignar profesor y alumnos</Link>}</div>}
    {cargando ? <p role="status">Cargando turno</p> : error ? <div role="alert" className="space-y-3 rounded-md border border-border bg-card p-4"><p>{error}</p><Button variant="outline" onClick={() => void cargar()}>Reintentar</Button></div> : turnoActual && (
      // Mockup pág. 5: columna flexible con datos y alumnos; columna fija a la derecha
      // con «Pago» (hito 2: también «Clase»). Sin tarjetas laterales, una sola columna.
      <div className={`grid gap-5 ${turnoActual.pagos ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
        <div className="min-w-0 space-y-5">
          <TurnoDatosCard turno={turnoActual} />
          <TurnoAlumnosCard turno={turnoActual} gestionable={gestionable} onCambio={() => cargar(true)} />
        </div>
        {turnoActual.pagos && <aside aria-label="Pago y clase" className="min-w-0 space-y-5"><TurnoPagoCard pagos={turnoActual.pagos} /></aside>}
      </div>
    )}
  </main>;
}
