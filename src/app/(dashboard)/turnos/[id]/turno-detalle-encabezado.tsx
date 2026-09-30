import { Breadcrumb } from "@/components/shared/breadcrumb";
import { diaMes, fechaLarga } from "@/lib/turno-detalle";
import type { TurnoDetalle } from "@/types/turno.types";
import { EstadoTurnoBadge } from "../estado-turno-badge";

/**
 * Migas, título y subtítulo del detalle (mockup pág. 5). El área de acciones
 * (arriba a la derecha) se completa en el hito 3: cada botón aparece solo si
 * su clave está en `acciones_habilitadas` y existen su endpoint y su modal.
 */
export function TurnoDetalleEncabezado({ turno, retorno }: { turno: TurnoDetalle | null; retorno: string }) {
  const tramos = [{ etiqueta: "Turnos", href: retorno }, ...(turno ? [{ etiqueta: `${turno.materia} · ${diaMes(turno.fecha)}` }] : [])];
  return (
    <header className="space-y-2">
      <Breadcrumb tramos={tramos} />
      {turno ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{turno.materia}</h1>
            <EstadoTurnoBadge estado={turno.estado} />
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
