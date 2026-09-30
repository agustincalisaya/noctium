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

function agruparHorarios(horarios: ProfesorOpcionTurno["horarios"]) {
  const grupos = new Map<string, ProfesorOpcionTurno["horarios"]>();
  for (const horario of horarios) {
    const grupo = grupos.get(horario.dia_semana) ?? [];
    grupo.push(horario);
    grupos.set(horario.dia_semana, grupo);
  }
  const orden = Object.keys(DIAS);
  return [...grupos].sort(([diaA], [diaB]) => {
    const indiceA = orden.indexOf(diaA);
    const indiceB = orden.indexOf(diaB);
    return (indiceA < 0 ? orden.length : indiceA) - (indiceB < 0 ? orden.length : indiceB) || diaA.localeCompare(diaB);
  }).map(([dia, franjas]) => ({
    dia: DIAS[dia] ?? dia,
    intervalos: [...franjas].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio) || a.hora_fin.localeCompare(b.hora_fin))
      .map(({ hora_inicio, hora_fin }) => `${hora_inicio}–${hora_fin}`),
  }));
}

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
          {profesores.map((profesor) => <label key={profesor.id} className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border bg-card p-3.5 transition-colors focus-within:ring-2 focus-within:ring-ring ${profesorId === profesor.id ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}>
            <input type="radio" name="profesor_turno" value={profesor.id} checked={profesorId === profesor.id} onChange={() => onSeleccionar(profesor.id)} className="mt-1 h-4 w-4 accent-primary" />
            <span className="min-w-0"><span className="block font-medium">{profesor.nombre} {profesor.apellido}</span><span className="mt-1 block space-y-1 text-sm text-muted-foreground">{agruparHorarios(profesor.horarios).map(({ dia, intervalos }) => <span key={dia} className="block"><span className="font-medium">{dia}:</span>{intervalos.map((intervalo, indice) => <span key={`${intervalo}-${indice}`} className="inline-block whitespace-nowrap tabular-nums">{"\u00a0"}{intervalo}</span>)}</span>)}</span></span>
          </label>)}
        </fieldset>}
  </section>;
}
