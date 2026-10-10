import { texto } from "@/lib/textos";
import { cn } from "@/lib/utils";

export type PasoRegistrarPago = 1 | 2 | 3;

/** Stepper de 3 pasos de «Registrar pago» (HU-I-10), con el aspecto del wizard de turno. */
export function ProgresoRegistrarPago({ paso }: { paso: PasoRegistrarPago }) {
  const nombres = [texto("ui.pagos.pasos.alumno"), texto("ui.pagos.pasos.clases"), texto("ui.pagos.pasos.confirmacion")];
  return <nav aria-label={texto("ui.pagos.progreso.nombre")}>
    <ol className="grid grid-cols-3 gap-2">
      {nombres.map((nombre, indice) => {
        const numero = indice + 1;
        const estado = numero < paso ? "completado" : numero === paso ? "actual" : "futuro";
        return <li key={nombre} aria-current={numero === paso ? "step" : undefined} data-estado={estado}
          className={cn("text-xs", numero <= paso ? "text-foreground" : "text-muted-foreground")}>
          <span aria-hidden="true" className={cn("mb-2 block h-1 rounded-full", estado === "actual" ? "bg-primary" : estado === "completado" ? "bg-brand-accent" : "bg-muted")} />
          <span className="block">{texto("ui.pagos.progreso.paso", { numero })}</span>
          <span className={cn("block text-sm", estado === "actual" && "font-semibold")}>{nombre}</span>
        </li>;
      })}
    </ol>
  </nav>;
}
