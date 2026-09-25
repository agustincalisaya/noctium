import { cn } from "@/lib/utils";

const PASOS = ["Datos", "Materias", "Horario"] as const;

/**
 * Progreso del alta de profesor (wizard lineal: datos → materias → horario).
 * Los pasos 2 y 3 son las mismas pantallas que se usan desde la ficha; solo
 * muestran este indicador cuando se entra con `?alta=1`.
 */
export function StepperAltaProfesor({ paso }: { paso: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Progreso del alta de profesor" className="space-y-2">
      <p className="text-sm font-medium">
        Paso {paso} de {PASOS.length}: {PASOS[paso - 1]}
      </p>
      <ol className="grid grid-cols-3 gap-2">
        {PASOS.map((nombre, indice) => {
          const numero = indice + 1;
          return (
            <li
              key={nombre}
              aria-current={numero === paso ? "step" : undefined}
              className={cn(
                "space-y-1 text-xs",
                numero <= paso ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn("block h-1.5 rounded-full", numero <= paso ? "bg-primary" : "bg-muted")}
              />
              <span className={numero === paso ? "font-medium" : undefined}>{nombre}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
