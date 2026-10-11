import { texto as textoC19 } from "@/lib/textos";
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
    [textoC19("ui.indicadores.presentismo.materiaColumna"), turno.materia],
    [textoC19("ui.turnos.solicitar.profesor"), turno.profesor],
    [textoC19("ui.turnos.resumen.aula"), turno.aula],
    [textoC19("ui.pagos.clases.fecha"), fechaCorta(turno.fecha)],
    [textoC19("ui.clases.interfaz.horaDeInicioFin"), `${turno.hora_inicio}–${turno.hora_fin}`],
    ["Duración", duracion(turno.duracion_minutos)],
    [textoC19("ui.clases.interfaz.cupoMaximoEtiqueta"), turno.cupo_maximo === null ? textoC19("ui.clases.interfaz.sinAsignar") : cupo(turno.cupo_maximo)],
    [textoC19("ui.formasPago.estado"), <EstadoTurnoBadge key="estado" estado={turno.estado} />],
    [textoC19("ui.clases.interfaz.prioridad"), <PrioridadTurnoBadge key="prioridad" prioridad={turno.prioridad} />],
    ["Creado", fechaDeInstante(turno.creado_en)],
    [textoC19("ui.clases.interfaz.creadoPor"), turno.creado_por ?? textoC19("ui.historial.observaciones.sinRegistrar")],
  ];
  return (
    <section aria-labelledby="datos-turno-titulo" className="space-y-3.5 rounded-md border border-border bg-card p-4 text-card-foreground sm:p-[22px]">
      <h2 id="datos-turno-titulo" className="text-sm font-semibold">{textoC19("ui.clases.interfaz.datosDeLaClase")}</h2>
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
