import { Breadcrumb } from "@/components/shared/breadcrumb";
import { diaMes, fechaLarga } from "@/lib/turno-detalle";
import type { TurnoDetalle } from "@/types/turno.types";
import { EstadoTurnoBadge } from "../estado-turno-badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Flag } from "lucide-react";

const CLASE_DESTRUCTIVA = "border-destructive bg-card text-destructive hover:bg-destructive-soft hover:text-destructive-soft-foreground";

/**
 * Migas, título y subtítulo del detalle (mockup pág. 5). Acciones arriba a la
 * derecha, en el orden del mockup: cada botón aparece solo si su clave está en
 * `acciones_habilitadas` y existen su endpoint y su modal (C-10, C-05).
 */
export function TurnoDetalleEncabezado({ turno, retorno, onReprogramar, onAsignarPrioridad, onCancelar }: {
  turno: TurnoDetalle | null;
  retorno: string;
  onReprogramar: () => void;
  onAsignarPrioridad: () => void;
  onCancelar: (modo: "cancelar" | "descartar") => void;
}) {
  const tramos = [{ etiqueta: "Turnos", href: retorno }, ...(turno ? [{ etiqueta: `${turno.materia} · ${diaMes(turno.fecha)}` }] : [])];
  return (
    <header className="space-y-2">
      <Breadcrumb tramos={tramos} />
      {turno ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{turno.materia}</h1>
              <EstadoTurnoBadge estado={turno.estado} />
            </div>
            <div className="flex flex-wrap gap-2">
              {turno.acciones_habilitadas.includes("reprogramar") && <Button type="button" variant="outline" onClick={onReprogramar}>
                <CalendarDays className="size-4" aria-hidden />Reprogramar
              </Button>}
              {turno.acciones_habilitadas.includes("prioridad") && <Button type="button" variant="outline" onClick={onAsignarPrioridad}>
                <Flag className="size-4" aria-hidden />Asignar prioridad
              </Button>}
              {turno.acciones_habilitadas.includes("cancelar") && <Button type="button" variant="outline" className={CLASE_DESTRUCTIVA} onClick={() => onCancelar("cancelar")}>
                Cancelar turno
              </Button>}
              {turno.acciones_habilitadas.includes("descartar") && <Button type="button" variant="outline" className={CLASE_DESTRUCTIVA} onClick={() => onCancelar("descartar")}>
                Descartar
              </Button>}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {[
              fechaLarga(turno.fecha),
              `${turno.hora_inicio}–${turno.hora_fin}`,
              turno.aula,
              turno.profesor,
            ].join(" · ")}
          </p>
        </>
      ) : (
        <h1 className="text-2xl font-semibold">Detalle del turno</h1>
      )}
    </header>
  );
}
