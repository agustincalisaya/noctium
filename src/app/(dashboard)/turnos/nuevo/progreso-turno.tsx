import { cn } from "@/lib/utils";

export const PASOS_TURNO = ["Materia", "Profesor", "Fecha y horario", "Aula", "Alumnos"] as const;
export type PasoTurno = 1 | 2 | 3 | 4 | 5;

export function ProgresoTurno({ paso }: { paso: PasoTurno }) {
  return <nav aria-label="Progreso del nuevo turno" className="space-y-3">
    <p className="text-sm font-medium">Paso {paso} de 5: {PASOS_TURNO[paso - 1]}</p>
    <div className="overflow-x-auto pb-1">
      <ol className="grid min-w-[38rem] grid-cols-5 gap-2">
        {PASOS_TURNO.map((nombre, indice) => {
          const numero = indice + 1;
          const estado = numero < paso ? "completado" : numero === paso ? "actual" : "futuro";
          return <li key={nombre} aria-current={numero === paso ? "step" : undefined} data-estado={estado} className={cn("space-y-2 text-xs", numero <= paso ? "text-foreground" : "text-muted-foreground")}>
            <span aria-hidden="true" className={cn("block h-1.5 rounded-full", numero <= paso ? "bg-primary" : "bg-muted")} />
            <span className="flex items-center gap-1.5"><span className="font-semibold">{numero}.</span><span className={numero === paso ? "font-semibold" : undefined}>{nombre}</span></span>
          </li>;
        })}
      </ol>
    </div>
  </nav>;
}
