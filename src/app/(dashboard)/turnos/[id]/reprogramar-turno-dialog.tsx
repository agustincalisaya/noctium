"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { cn } from "@/lib/utils";
import type { TurnoDetalle } from "@/types/turno.types";
import { MENSAJE_RESULTADO_INCIERTO } from "./turno-acciones-mensajes";

type Inicio = { hora_inicio: string; hora_fin: string; actual: boolean };
type Opciones = { fecha: string; duracion_min: number; tope_fecha: string; inicios: Inicio[] };
type Conflicto = { recurso: "PROFESOR" | "AULA" | "ALUMNO"; id: string };

const hoyLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

/** «Profesor Méndez, Laura», «Aula 3», «Alumno Pérez, Juan»: nombres que ya trae el detalle. */
function nombrarConflicto(turno: TurnoDetalle, conflicto: Conflicto) {
  if (conflicto.recurso === "PROFESOR") return `Profesor ${turno.profesor}`;
  if (conflicto.recurso === "AULA") return turno.aula;
  return `Alumno ${turno.alumnos.find((alumno) => alumno.id === conflicto.id)?.nombre ?? conflicto.id}`;
}

/**
 * HU-C-06 (spec_modulo_C.md §2.11, mockup pág. 9): nueva fecha y hora de
 * inicio de un turno confirmado. Las horas salen de
 * `GET …/reprogramacion/opciones` (el cliente no calcula disponibilidad,
 * §3.10); el PATCH revalida todo. La hora vigente se deshabilita solo en su
 * propia fecha (`actual`). Un conflicto se explica dentro del Dialog; ante un
 * resultado incierto (5xx o red) se aplica T-PC.
 */
export function ReprogramarTurnoDialog({ turno, onCerrar, onCambio }: { turno: TurnoDetalle; onCerrar: () => void; onCambio: () => Promise<void> }) {
  const [fecha, setFecha] = useState(turno.fecha);
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [tope, setTope] = useState<string | undefined>(undefined);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [hora, setHora] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [consulta, setConsulta] = useState(0);
  const peticion = useRef<AbortController | null>(null);
  const campoFecha = useRef<HTMLInputElement>(null);
  // Callbacks del padre en refs: son funciones inline y no deben re-disparar la consulta.
  const callbacks = useRef({ onCerrar, onCambio });
  useEffect(() => { callbacks.current = { onCerrar, onCambio }; });

  useEffect(() => {
    peticion.current?.abort();
    const controller = new AbortController();
    peticion.current = controller;
    const cargar = async () => {
      setCargando(true);
      setHora(null);
      try {
        const response = await fetchAutenticado(`/api/turnos/${encodeURIComponent(turno.id)}/reprogramacion/opciones?fecha=${encodeURIComponent(fecha)}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.ok) {
          setOpciones(result.data);
          setTope(result.data.tope_fecha);
          return;
        }
        setOpciones(null);
        if (response.status === 404 || response.status === 409) {
          // El turno dejó de ser reprogramable (cancelado, vencido, etc.).
          toast.error(result?.error?.message ?? "El turno ya no se puede reprogramar");
          callbacks.current.onCerrar();
          await callbacks.current.onCambio();
          return;
        }
        setAviso(response.status === 400 ? result?.error?.message ?? "Elegí una fecha válida" : "No se pudieron consultar los horarios. Intentá nuevamente.");
      } catch {
        if (controller.signal.aborted) return;
        setOpciones(null);
        setAviso("No se pudieron consultar los horarios. Intentá nuevamente.");
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    };
    void cargar();
    return () => controller.abort();
  }, [fecha, consulta, turno.id]);

  const cambiarFecha = (valor: string) => {
    setAviso("");
    if (valor) setFecha(valor);
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enviando || !hora) return;
    setEnviando(true);
    setAviso("");
    let incierto = false;
    try {
      const response = await fetchAutenticado(`/api/turnos/${encodeURIComponent(turno.id)}/reprogramacion`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fecha, hora_inicio: hora }), cache: "no-store",
      });
      const result = await response.json().catch(() => null);
      if (response.ok) {
        onCerrar();
        toast.success("Turno reprogramado correctamente");
        await onCambio();
        return;
      }
      if (response.status >= 500) incierto = true;
      else if (result?.error?.code === "REPROGRAMACION_CONFLICTO") {
        const conflictos: Conflicto[] = result.error.detalles?.conflictos ?? [];
        setAviso(conflictos.length
          ? `No disponible en ese horario: ${conflictos.map((conflicto) => nombrarConflicto(turno, conflicto)).join(" · ")}`
          : result.error.message);
        setConsulta((n) => n + 1);
      } else if (response.status === 400) {
        setAviso(result?.error?.message ?? "Revisá la fecha y la hora elegidas");
      } else {
        toast.error(result?.error?.message ?? "No se pudo reprogramar el turno");
        onCerrar();
        await onCambio();
      }
    } catch {
      incierto = true;
    } finally {
      setEnviando(false);
    }
    if (incierto) {
      onCerrar();
      toast.error(MENSAJE_RESULTADO_INCIERTO);
      await onCambio();
    }
  };

  const duracionHoras = `${(opciones?.duracion_min ?? turno.duracion_minutos) / 60} h`;
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !enviando) onCerrar(); }}>
      <DialogContent initialFocus={campoFecha}>
        <form onSubmit={guardar}>
          <DialogHeader>
            <DialogTitle>Reprogramar turno</DialogTitle>
            <DialogDescription>Cambia fecha y hora de inicio. Profesor ({turno.profesor}), aula y duración se mantienen.</DialogDescription>
          </DialogHeader>
          <fieldset className="mt-4 space-y-4" disabled={enviando}>
            <div className="space-y-1.5">
              <Label htmlFor="reprogramar-fecha">Nueva fecha</Label>
              <Input id="reprogramar-fecha" ref={campoFecha} type="date" value={fecha} min={hoyLocal()} max={tope} onChange={(event) => cambiarFecha(event.target.value)} />
            </div>
            <div className="space-y-2">
              <p id="reprogramar-hora" className="text-sm font-medium">
                Hora de inicio <span className="font-normal text-muted-foreground">(dentro del horario de atención, {duracionHoras})</span>
              </p>
              {cargando ? <p role="status" className="text-sm text-muted-foreground">Buscando horarios</p>
                : !opciones ? null
                  : !opciones.inicios.length ? <p className="text-sm text-muted-foreground">No hay horarios disponibles para esa fecha</p>
                    : <div role="radiogroup" aria-labelledby="reprogramar-hora" className="grid grid-cols-3 gap-2">
                      {opciones.inicios.map((inicio) => (
                        <label key={inicio.hora_inicio} className={cn(
                          "flex items-center justify-center rounded-md border border-border px-2 py-2 text-sm tabular-nums",
                          inicio.actual ? "cursor-not-allowed bg-muted text-muted-foreground line-through" : "cursor-pointer has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground",
                        )}>
                          <input type="radio" name="hora_inicio" value={inicio.hora_inicio} className="sr-only" disabled={inicio.actual}
                            checked={hora === inicio.hora_inicio} onChange={() => { setHora(inicio.hora_inicio); setAviso(""); }}
                            aria-label={`${inicio.hora_inicio}–${inicio.hora_fin}${inicio.actual ? " (horario actual)" : ""}`} />
                          {inicio.hora_inicio}–{inicio.hora_fin}
                        </label>
                      ))}
                    </div>}
              <p className="text-xs text-muted-foreground">Profesor, {turno.aula} y alumnos inscriptos disponibles en ese horario.</p>
            </div>
            {aviso && <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{aviso}
            </p>}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={enviando} onClick={onCerrar}>Cancelar</Button>
            <Button type="submit" disabled={enviando || !hora}>{enviando ? "Reprogramando…" : "Reprogramar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
