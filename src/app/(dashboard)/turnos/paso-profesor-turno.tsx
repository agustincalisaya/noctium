import { Button } from "@/components/ui/button";

export type ProfesorOpcionTurno = {
  id: string;
  nombre: string;
  apellido: string;
  horarios: { horario_id: string; dia_semana: string; hora_inicio: string; hora_fin: string }[];
};

const DIAS: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles", JUEVES: "Jueves",
  VIERNES: "Viernes", SABADO: "Sábado", DOMINGO: "Domingo",
};

/** Paso compartible: recibe la lista del contrato público de Turnos por props. */
export function PasoProfesorTurno({ profesores, profesorId, materiaNombre, onSeleccionar, cargando, error, mensajeVacio, onReintentar }: {
  profesores: ProfesorOpcionTurno[];
  profesorId: string;
  materiaNombre: string;
  onSeleccionar: (id: string) => void;
  cargando: boolean;
  error: string;
  mensajeVacio: string;
  onReintentar: () => void;
}) {
  return <section aria-labelledby="titulo-paso-profesor" className="space-y-5">
    <div className="space-y-1">
      <h2 id="titulo-paso-profesor" className="text-xl font-semibold">Elegí el profesor</h2>
      <p className="text-sm text-muted-foreground">Profesores que dictan {materiaNombre}. Se muestra el horario de atención de cada uno.</p>
    </div>
    {cargando ? <p role="status">Cargando profesores</p> :
      error ? <div role="alert" className="space-y-3"><p>{error}</p><Button type="button" variant="outline" onClick={onReintentar}>Reintentar</Button></div> :
      profesores.length === 0 ? <p role="status" className="rounded-md border border-border bg-muted p-4 text-sm">{mensajeVacio}</p> :
        <fieldset className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="sr-only">Profesor</legend>
          {profesores.map((profesor) => <label key={profesor.id} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border bg-card p-3.5 transition-colors focus-within:ring-2 focus-within:ring-ring ${profesorId === profesor.id ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}>
            <input type="radio" name="profesor_turno" value={profesor.id} checked={profesorId === profesor.id} onChange={() => onSeleccionar(profesor.id)} className="h-4 w-4 accent-primary" />
            <span className="min-w-0"><span className="block font-medium">{profesor.nombre} {profesor.apellido}</span><span className="block text-sm text-muted-foreground">{profesor.horarios.map((horario) => `${DIAS[horario.dia_semana] ?? horario.dia_semana} ${horario.hora_inicio}–${horario.hora_fin}`).join(" · ")}</span></span>
          </label>)}
        </fieldset>}
  </section>;
}
