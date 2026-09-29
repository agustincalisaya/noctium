export type ProfesorOpcionTurno = { id: string; nombre: string; apellido: string };

/** Recibe opciones por props: el origen real de HU-C-07 se conectará después. */
export function PasoProfesorTurno({ profesores, profesorId, onSeleccionar, consultaDisponible }: {
  profesores: ProfesorOpcionTurno[];
  profesorId: string;
  onSeleccionar: (id: string) => void;
  consultaDisponible: boolean;
}) {
  return <section aria-labelledby="titulo-paso-profesor" className="space-y-5">
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">Paso 2 de 5</p>
      <h2 id="titulo-paso-profesor" className="text-xl font-semibold">Elegí un profesor</h2>
      <p className="text-sm text-muted-foreground">Elegí quién dictará la materia seleccionada.</p>
    </div>
    {!consultaDisponible ? <p role="status" className="rounded-md border border-border bg-muted p-4 text-sm">No es posible consultar profesores en este momento.</p> :
      profesores.length === 0 ? <p role="status" className="rounded-md border border-border bg-muted p-4 text-sm">No hay profesores para elegir.</p> :
        <fieldset className="space-y-3">
          <legend className="sr-only">Profesor</legend>
          {profesores.map((profesor) => <label key={profesor.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-4 transition-colors focus-within:ring-2 focus-within:ring-ring ${profesorId === profesor.id ? "border-primary" : "border-border hover:bg-accent"}`}>
            <input type="radio" name="profesor_turno" value={profesor.id} checked={profesorId === profesor.id} onChange={() => onSeleccionar(profesor.id)} className="h-4 w-4 accent-primary" />
            <span className="font-medium">{profesor.apellido}, {profesor.nombre}</span>
          </label>)}
        </fieldset>}
  </section>;
}
