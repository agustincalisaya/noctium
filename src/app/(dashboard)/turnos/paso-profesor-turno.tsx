import { Button } from "@/components/ui/button";

export type ProfesorOpcionTurno = { id: string; nombre: string; apellido: string };

/** Paso compartible: recibe la lista del contrato público de Turnos por props. */
export function PasoProfesorTurno({ profesores, profesorId, onSeleccionar, cargando, error, mensajeVacio, onReintentar }: {
  profesores: ProfesorOpcionTurno[];
  profesorId: string;
  onSeleccionar: (id: string) => void;
  cargando: boolean;
  error: string;
  mensajeVacio: string;
  onReintentar: () => void;
}) {
  return <section aria-labelledby="titulo-paso-profesor" className="space-y-5">
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">Paso 2 de 5</p>
      <h2 id="titulo-paso-profesor" className="text-xl font-semibold">Elegí un profesor</h2>
      <p className="text-sm text-muted-foreground">Elegí quién dictará la materia seleccionada.</p>
    </div>
    {cargando ? <p role="status">Cargando profesores</p> :
      error ? <div role="alert" className="space-y-3"><p>{error}</p><Button type="button" variant="outline" onClick={onReintentar}>Reintentar</Button></div> :
      profesores.length === 0 ? <p role="status" className="rounded-md border border-border bg-muted p-4 text-sm">{mensajeVacio}</p> :
        <fieldset className="space-y-3">
          <legend className="sr-only">Profesor</legend>
          {profesores.map((profesor) => <label key={profesor.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-4 transition-colors focus-within:ring-2 focus-within:ring-ring ${profesorId === profesor.id ? "border-primary" : "border-border hover:bg-accent"}`}>
            <input type="radio" name="profesor_turno" value={profesor.id} checked={profesorId === profesor.id} onChange={() => onSeleccionar(profesor.id)} className="h-4 w-4 accent-primary" />
            <span className="font-medium">{profesor.apellido}, {profesor.nombre}</span>
          </label>)}
        </fieldset>}
  </section>;
}
