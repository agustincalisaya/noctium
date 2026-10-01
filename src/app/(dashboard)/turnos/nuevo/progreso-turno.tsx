import { cn } from "@/lib/utils";

export const PASOS_TURNO = ["Materia", "Profesor", "Fecha y horario", "Aula", "Alumnos"] as const;
export const PASOS_TURNO_RECURRENTES = ["Materia", "Profesor", "Franja y horario", "Aula y rango", "Vista previa"] as const;
export type PasoTurno = 1 | 2 | 3 | 4 | 5;

export function ProgresoTurno({ paso, pasoMaximoHabilitado, onPasoSeleccionado, nombres = PASOS_TURNO }: { paso: PasoTurno; pasoMaximoHabilitado: PasoTurno; onPasoSeleccionado: (paso: PasoTurno) => void; nombres?: readonly string[] }) {
  return <nav aria-label="Progreso del nuevo turno">
    <div className="overflow-x-auto pb-1">
      <ol className="grid min-w-[38rem] grid-cols-5 gap-2">
        {nombres.map((nombre, indice) => {
          const numero = indice + 1;
          const estado = numero < paso ? "completado" : numero === paso ? "actual" : "futuro";
          const contenido = <>
            <span aria-hidden="true" className={cn("mb-2 block h-1 rounded-full", estado === "actual" ? "bg-primary" : estado === "completado" ? "bg-primary/70" : "bg-muted")} />
            <span className="block">Paso {numero}</span>
            <span className={cn("block text-sm", estado === "actual" && "font-semibold")}>{nombre}</span>
          </>;
          return <li key={nombre} aria-current={numero === paso ? "step" : undefined} data-estado={estado} className={cn("text-xs", numero <= paso ? "text-foreground" : "text-muted-foreground")}>
            {numero !== paso && numero <= pasoMaximoHabilitado ? <button type="button" className="block w-full rounded-sm text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => onPasoSeleccionado(numero as PasoTurno)}>{contenido}</button> : <div>{contenido}</div>}
          </li>;
        })}
      </ol>
    </div>
  </nav>;
}
