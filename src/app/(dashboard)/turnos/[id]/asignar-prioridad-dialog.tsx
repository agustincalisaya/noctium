"use client";

import { texto as textoC19 } from "@/lib/textos";

import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { ETIQUETA_PRIORIDAD_TURNO, type PrioridadTurno } from "@/types/turno.types";

const PRIORIDADES: PrioridadTurno[] = ["NORMAL", "ALTA", "URGENTE"];

export function AsignarPrioridadDialog({ turnoId, prioridadActual, onCerrar, onCambio }: {
  turnoId: string;
  prioridadActual: PrioridadTurno;
  onCerrar: () => void;
  onCambio: () => Promise<void>;
}) {
  const [prioridad, setPrioridad] = useState(prioridadActual);
  const [enviando, setEnviando] = useState(false);
  const primeraOpcion = useRef<HTMLInputElement>(null);

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      const response = await fetchAutenticado(`/api/turnos/${encodeURIComponent(turnoId)}/prioridad`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prioridad }), cache: "no-store",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(result?.error?.message ?? textoC19("ui.clases.interfaz.noSePudoActualizarLaPrioridadIntentaNuevamente"));
        if (response.status === 409) await onCambio();
        return;
      }
      onCerrar();
      toast.success(textoC19("ui.clases.interfaz.prioridadActualizada"));
      await onCambio();
    } catch {
      toast.error(textoC19("ui.clases.interfaz.noSePudoActualizarLaPrioridadIntentaNuevamente"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !enviando) onCerrar(); }}>
      <DialogContent initialFocus={primeraOpcion}>
        <form onSubmit={guardar}>
          <DialogHeader>
            <DialogTitle>{textoC19("ui.clases.interfaz.asignarPrioridad")}</DialogTitle>
            <DialogDescription>{textoC19("ui.clases.interfaz.altaYUrgenteSeMarcanEnElListadoYEnElCalendario")}</DialogDescription>
          </DialogHeader>
          <fieldset className="mt-4 space-y-2" disabled={enviando}>
            <legend className="sr-only">{textoC19("ui.clases.interfaz.prioridadDeLaClase")}</legend>
            {PRIORIDADES.map((opcion, index) => (
              <label key={opcion} className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent">
                <input ref={index === 0 ? primeraOpcion : undefined} type="radio" name="prioridad" value={opcion} checked={prioridad === opcion} onChange={() => setPrioridad(opcion)} className="accent-primary" />
                {ETIQUETA_PRIORIDAD_TURNO[opcion]}
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={enviando} onClick={onCerrar}>{textoC19("ui.formasPago.cancelar")}</Button>
            <Button type="submit" disabled={enviando}>{enviando ? "Guardando…" : textoC19("ui.formasPago.guardar")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
