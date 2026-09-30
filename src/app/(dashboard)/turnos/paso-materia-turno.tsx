export type MateriaOpcionTurno = { id: string; nombre: string; codigo: string | null };

/** Paso compartible por el alta individual y la futura generación de varios turnos. */
export function PasoMateriaTurno({ materias, materiaId, onSeleccionar }: {
  materias: MateriaOpcionTurno[];
  materiaId: string;
  onSeleccionar: (id: string) => void;
}) {
  return <section aria-labelledby="titulo-paso-materia" className="space-y-5">
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">Paso 1 de 5</p>
      <h2 id="titulo-paso-materia" className="text-xl font-semibold">Elegí una materia</h2>
      <p className="text-sm text-muted-foreground">Seleccioná la materia para este turno.</p>
    </div>
    {materias.length === 0 ? <p role="status" className="rounded-md border border-border bg-muted p-4 text-sm">No hay materias activas para configurar turnos.</p> :
      <fieldset className="space-y-3">
        <legend className="sr-only">Materia</legend>
        {materias.map((materia) => <label key={materia.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-4 transition-colors focus-within:ring-2 focus-within:ring-ring ${materiaId === materia.id ? "border-primary" : "border-border hover:bg-accent"}`}>
          <input type="radio" name="materia_turno" value={materia.id} checked={materiaId === materia.id} onChange={() => onSeleccionar(materia.id)} className="h-4 w-4 accent-primary" />
          <span className="min-w-0"><span className="block font-medium">{materia.nombre}</span>{materia.codigo && <span className="block text-sm text-muted-foreground">{materia.codigo}</span>}</span>
        </label>)}
      </fieldset>}
  </section>;
}
