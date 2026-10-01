import type { ReactNode } from "react";
import { cupo, duracion, fechaCorta, fechaDeInstante } from "@/lib/turno-detalle";
import type { TurnoDetalle } from "@/types/turno.types";
import { EstadoTurnoBadge } from "../estado-turno-badge";
import { PrioridadTurnoBadge } from "../prioridad-turno-badge";

/**
 * Tarjeta «Datos del turno» (mockup pág. 5): grilla de 3 columnas con las
 * etiquetas en mayúsculas. Los datos no asignados de un PENDIENTE (profesor,
 * aula, cupo) se muestran «Sin asignar»; el creador nulo, «Sin registrar».
 */
export function TurnoDatosCard({ turno }: { turno: TurnoDetalle }) {
  const campos: [string, ReactNode][] = [
    ["Materia", turno.materia],
    ["Profesor", turno.profesor],
    ["Aula", turno.aula],
    ["Fecha", fechaCorta(turno.fecha)],
    ["Hora de inicio–fin", `${turno.hora_inicio}–${turno.hora_fin}`],
    ["Duración", duracion(turno.duracion_minutos)],
    ["Cupo máximo", turno.cupo_maximo === null ? "Sin asignar" : cupo(turno.cupo_maximo)],
    ["Estado", <EstadoTurnoBadge key="estado" estado={turno.estado} />],
    ["Prioridad", <PrioridadTurnoBadge key="prioridad" prioridad={turno.prioridad} />],
    ["Creado", fechaDeInstante(turno.creado_en)],
    ["Creado por", turno.creado_por ?? "Sin registrar"],
  ];
  return (
    <section aria-labelledby="datos-turno-titulo" className="space-y-3.5 rounded-md border border-border bg-card p-4 text-card-foreground sm:p-[22px]">
      <h2 id="datos-turno-titulo" className="text-sm font-semibold">Datos del turno</h2>
      <dl className="grid grid-cols-2 gap-[18px] lg:grid-cols-3">
        {campos.map(([etiqueta, valor]) => (
          <div className={`min-w-0 ${etiqueta === "Creado por" ? "col-span-2 lg:col-span-1" : ""}`} key={etiqueta}>
            <dt className="text-[10px] leading-4 uppercase text-muted-foreground">{etiqueta}</dt>
            <dd className={`break-words text-sm leading-5 ${["Fecha", "Hora de inicio–fin", "Creado"].includes(etiqueta) ? "font-mono" : ""}`}>{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
