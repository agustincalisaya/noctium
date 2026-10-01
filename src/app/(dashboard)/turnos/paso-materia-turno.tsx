import { Button } from "@/components/ui/button";

export type MateriaOpcionTurno = { id: string; nombre: string; codigo: string | null };

/** Paso compartible por el alta individual y la futura generación de varios turnos. */
export function PasoMateriaTurno({ materias, materiaId, profesoresPorMateria, cargandoConteos, errorConteos, onReintentarConteos, onSeleccionar }: {
  materias: MateriaOpcionTurno[];
  materiaId: string;
  profesoresPorMateria: Record<string, number>;
  cargandoConteos: boolean;
  errorConteos: string;
  onReintentarConteos: () => void;
  onSeleccionar: (id: string) => void;
}) {
  return <section aria-labelledby="titulo-paso-materia" className="space-y-5">
    <div className="space-y-1">
      <h2 id="titulo-paso-materia" className="text-xl font-semibold">Elegí la materia</h2>
    </div>
    {cargandoConteos && <p role="status" className="text-sm text-muted-foreground">Cargando cantidad de profesores</p>}
    {errorConteos && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>{errorConteos}</p><Button type="button" variant="outline" onClick={onReintentarConteos}>Reintentar conteos</Button></div>}
    {materias.length === 0 ? <p role="status" className="rounded-md border border-border bg-muted p-4 text-sm">No hay materias activas para configurar turnos.</p> :
      <fieldset className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <legend className="sr-only">Materia</legend>
        {materias.map((materia) => <label key={materia.id} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border bg-card p-3.5 transition-colors focus-within:ring-2 focus-within:ring-ring ${materiaId === materia.id ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}>
          <input type="radio" name="materia_turno" value={materia.id} checked={materiaId === materia.id} onChange={() => onSeleccionar(materia.id)} className="h-4 w-4 accent-primary" />
          <span className="min-w-0"><span className="block font-medium">{materia.nombre}</span><span className="block text-sm text-muted-foreground">{[materia.codigo, profesoresPorMateria[materia.id] === undefined ? "— profesores" : `${profesoresPorMateria[materia.id]} ${profesoresPorMateria[materia.id] === 1 ? "profesor" : "profesores"}`].filter(Boolean).join(" · ")}</span></span>
        </label>)}
      </fieldset>}
  </section>;
}
