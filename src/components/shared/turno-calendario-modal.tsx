"use client";

import Link from "next/link";
import { useEffect, useState, type ReactElement } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { CalendarDays, Clock3, DoorOpen, ExternalLink, Loader2, Search, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import type { TurnoDetalle } from "@/app/(dashboard)/turnos/turno.types";

function fechaLegible(fecha: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${fecha}T12:00:00Z`));
}

export function TurnoCalendarioModal({ turnoId, volverA, children }: { turnoId: string; volverA: string; children: ReactElement }) {
  const [abierto, setAbierto] = useState(false);
  const [turno, setTurno] = useState<TurnoDetalle | null>(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    if (!abierto) return;
    const controller = new AbortController();
    fetchAutenticado(`/api/turnos/${encodeURIComponent(turnoId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (respuesta) => {
        const resultado = await respuesta.json();
        if (!respuesta.ok || !resultado.data) throw new Error(resultado.error?.message ?? "No se pudo cargar el turno");
        if (!controller.signal.aborted) setTurno(resultado.data);
      })
      .catch((fallo: unknown) => {
        if (!controller.signal.aborted) setError(fallo instanceof Error ? fallo.message : "No se pudo cargar el turno");
      });
    return () => controller.abort();
  }, [abierto, turnoId, reintento]);

  const alumnos = turno?.alumnos.filter((alumno) =>
    `${alumno.nombre} ${alumno.dni}`.toLocaleLowerCase("es-AR").includes(busqueda.toLocaleLowerCase("es-AR").trim()),
  ) ?? [];
  const detalleUrl = `/turnos/${encodeURIComponent(turnoId)}?volver=${encodeURIComponent(volverA)}`;

  return (
    <Dialog.Root open={abierto} onOpenChange={(valor) => {
      setAbierto(valor);
      if (valor) { setTurno(null); setError(""); setBusqueda(""); }
    }}>
      <Dialog.Trigger render={children} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/60" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-7 sm:py-6">
            <div className="min-w-0 space-y-2">
              <Dialog.Title className="break-words text-2xl font-semibold leading-tight tracking-tight text-foreground">
                {turno?.materia ?? "Detalle del turno"}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {turno ? <>Profesor <span className="font-semibold text-foreground">{turno.profesor}</span></> : "Cargando información del turno"}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Cerrar detalle" className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </header>

          <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7">
            {error ? (
              <div role="alert" className="space-y-3 py-8 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={() => { setError(""); setReintento((n) => n + 1); }}>Reintentar</Button>
              </div>
            ) : !turno ? (
              <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Cargando turno…</p>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-x-6 gap-y-5 rounded-xl bg-muted/50 px-5 py-5 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground"><CalendarDays className="size-4 text-primary" aria-hidden />Fecha</p>
                    <p className="text-base font-semibold leading-snug text-foreground sm:text-lg">{fechaLegible(turno.fecha)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Clock3 className="size-4 text-primary" aria-hidden />Horario</p>
                    <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">{turno.hora_inicio}–{turno.hora_fin}</p>
                  </div>
                </div>

                <div className="grid gap-4 border-b border-border pb-5 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground"><DoorOpen className="size-4 text-primary" aria-hidden />Aula</p>
                    <p className="break-words text-base font-semibold text-foreground">{turno.aula}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground"><UsersRound className="size-4 text-primary" aria-hidden />Capacidad</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-base font-semibold tabular-nums text-foreground">{turno.alumnos.length} de {turno.cupo_maximo ?? "—"} lugares</p>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${turno.estado === "COMPLETO" ? "bg-destructive/15 text-destructive" : "bg-success text-success-foreground"}`}>{turno.estado === "COMPLETO" ? "Completo" : "Disponible"}</span>
                    </div>
                  </div>
                </div>

                <section aria-label="Alumnos inscriptos" className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-semibold"><UsersRound className="size-4 text-primary" aria-hidden />Alumnos inscriptos <span className="text-sm font-normal tabular-nums text-muted-foreground">({turno.alumnos.length})</span></h3>
                  </div>
                  {turno.alumnos.length > 8 && <label className="flex items-center gap-2 rounded-md border border-input px-3 focus-within:ring-2 focus-within:ring-ring"><Search className="size-4 text-muted-foreground" aria-hidden /><span className="sr-only">Buscar alumno por nombre o DNI</span><input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar por nombre o DNI" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>}
                  {turno.alumnos.length === 0 ? <p className="rounded-lg bg-muted/40 px-4 py-6 text-sm text-muted-foreground">Todavía no hay alumnos inscriptos.</p> : alumnos.length === 0 ? <p className="px-2 py-4 text-sm text-muted-foreground">No hay alumnos que coincidan con la búsqueda.</p> : (
                    <ol className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border" aria-label="Lista de alumnos">
                      {alumnos.map((alumno) => <li key={alumno.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span className="min-w-0 truncate font-medium" title={alumno.nombre}>{alumno.nombre}</span><span className="shrink-0 tabular-nums text-muted-foreground">DNI {alumno.dni}</span></li>)}
                    </ol>
                  )}
                </section>
              </div>
            )}
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-4 sm:px-7">
            <Link href={detalleUrl} prefetch={false} className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Abrir detalle completo <ExternalLink className="size-3.5" aria-hidden /></Link>
            <Button variant="outline" size="sm" onClick={() => setAbierto(false)}>Cerrar</Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
