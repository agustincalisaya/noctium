"use client";

import { Button } from "@/components/ui/button";

export type AulaOpcion = { id: string; nombre: string; capacidad: number };

type Props = {
  aulas: AulaOpcion[];
  aulaId: string;
  /** Aula ya guardada en el turno: una vez asignada no se puede quitar, solo reemplazar. */
  aulaIdGuardada: string;
  /** El aula guardada dejó de figurar entre las opciones (inactiva o sin capacidad). */
  aulaGuardadaNoDisponible: boolean;
  habilitada: boolean;
  sinAulas: boolean;
  error: string;
  onCambiar: (aulaId: string) => void;
  onReintentar: () => void;
  modoWizard?: boolean;
  onVolverHorario?: () => void;
  mensajeVacio?: string;
};

/**
 * HU-C-15 §2.3 (Revisión 3) dentro de la configuración del turno: el aula es
 * opcional al guardar y su capacidad fija el cupo máximo.
 */
export function SeccionAulaTurno({ aulas, aulaId, aulaIdGuardada, aulaGuardadaNoDisponible, habilitada, sinAulas, error, onCambiar, onReintentar, modoWizard = false, onVolverHorario, mensajeVacio = "No hay aulas disponibles para este horario" }: Props) {
  const capacidad = aulas.find((aula) => aula.id === aulaId)?.capacidad;
  return <fieldset disabled={!habilitada} aria-describedby={modoWizard ? undefined : "aula-ayuda"} className={`space-y-3 disabled:opacity-60 ${modoWizard ? "" : "border-t border-border pt-5"}`}>
    <legend className="sr-only">Aula</legend>
    {aulaGuardadaNoDisponible && !sinAulas && <p role="status" className="rounded-md bg-warning p-3 text-sm text-warning-foreground">El aula asignada ya no está disponible para este turno. Elegí otra aula.</p>}
    <div className="space-y-1">
      {!modoWizard && <label htmlFor="aula" className="text-sm font-medium">Aula</label>}
      {sinAulas ? <div className="space-y-2"><p role="status" className="text-sm">{modoWizard ? "No hay aulas activas registradas." : "No hay aulas activas registradas. Podés guardar el turno sin aula y asignarla más tarde."}</p><Button type="button" variant="outline" onClick={onReintentar}>Reintentar</Button></div>
        : aulas.length === 0 ? <div className="space-y-2"><p role="status" className="text-sm">{mensajeVacio}</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={onReintentar}>Reintentar</Button>{onVolverHorario && <Button type="button" variant="outline" onClick={onVolverHorario}>Volver a fecha y horario</Button>}</div></div>
          : modoWizard ? <div role="radiogroup" aria-label="Aula" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{aulas.map((aula) => <button key={aula.id} type="button" role="radio" aria-checked={aula.id === aulaId} disabled={!habilitada} onClick={() => onCambiar(aula.id)} className={`flex min-h-20 items-center gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${aula.id === aulaId ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/60"}`}><span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${aula.id === aulaId ? "border-primary" : "border-muted-foreground"}`}>{aula.id === aulaId && <span className="size-2 rounded-full bg-primary" />}</span><span><span className="block text-sm font-medium">{aula.nombre}</span><span className="block text-xs text-muted-foreground">Capacidad {aula.capacidad} {aula.capacidad === 1 ? "alumno" : "alumnos"}</span></span></button>)}</div>
            : <select id="aula" value={aulaId} onChange={(event) => onCambiar(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "aula-error" : "aula-ayuda"} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"><option value="" disabled={Boolean(aulaIdGuardada)}>{aulaIdGuardada ? "Seleccioná un aula" : "Sin aula por ahora"}</option>{aulas.map((aula) => <option key={aula.id} value={aula.id}>{aula.nombre} · Capacidad {aula.capacidad}</option>)}</select>}
      {!modoWizard && <p id="aula-ayuda" className="text-sm text-muted-foreground">{habilitada ? "Podés asignarla ahora o más tarde. Sin aula, el turno queda Pendiente y no se pueden cargar profesor ni alumnos." : "Completá fecha, duración, hora y materia para elegir el aula."}</p>}
      {error && <p id="aula-error" role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
    {!modoWizard && <p className="text-sm">Cupo máximo: <strong aria-live="polite">{capacidad === undefined ? "—" : `${capacidad} alumnos`}</strong> <span className="text-muted-foreground">(capacidad del aula elegida)</span></p>}
  </fieldset>;
}
