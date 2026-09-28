"use client";

import { CalendarCheck, Users, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TurnoCalendarioModal } from "@/components/shared/turno-calendario-modal";
import type { EventoCalendarioBase } from "@/types/calendario.types";

type Estado = EventoCalendarioBase["estado"];

export type EstiloEventoEnGrilla = { top: string; height: string; left: string; width: string };

/**
 * Bloque de un turno en una grilla del calendario, compartido por la agenda
 * por profesor (HU-J-01) y por materia (HU-J-02): horario, estado con texto
 * e ícono, y las líneas de datos que decide cada vista. Abre el detalle del
 * turno con `?volver=` apuntando a la vista actual. Si el bloque es chico
 * para todos los datos, el texto completo queda en el `title` y en el
 * nombre accesible del link (`descripcion`).
 */
export function BloqueEventoCalendario({
  turnoId,
  horaInicio,
  horaFin,
  estado,
  inscriptos,
  cupo,
  lineas,
  descripcion,
  estilo,
  volverA,
}: {
  turnoId: string;
  horaInicio: string;
  horaFin: string;
  estado: Estado;
  inscriptos: number;
  cupo: number;
  /** La primera va destacada; el resto, en texto secundario. */
  lineas: string[];
  /** Descripción completa, sin horario ni estado (se agregan acá). */
  descripcion: string;
  estilo: EstiloEventoEnGrilla;
  /** URL de la vista actual (entidad elegida + semana). */
  volverA: string;
}) {
  const horario = `${horaInicio}–${horaFin}`;
  const completo = estado === "COMPLETO" || (cupo > 0 && inscriptos >= cupo);
  const casiCompleto = !completo && cupo > 0 && inscriptos / cupo >= 0.75;
  const etiquetaEstado = completo ? "Completo" : casiCompleto ? "Pocos lugares" : "Disponible";
  const IconoEstado = completo ? Users : casiCompleto ? TriangleAlert : CalendarCheck;
  const color = completo
    ? "border-destructive/30 bg-destructive/10 hover:bg-destructive/15"
    : casiCompleto
      ? "border-warning-foreground/25 bg-warning/65 hover:bg-warning"
      : "border-success-foreground/20 bg-success/65 hover:bg-success";
  const colorInsignia = completo
    ? "bg-destructive/15 text-destructive"
    : casiCompleto
      ? "bg-warning text-warning-foreground"
      : "bg-success text-success-foreground";
  const completa = `${horario} · ${descripcion} · ${etiquetaEstado}`;

  return (
    <TurnoCalendarioModal turnoId={turnoId} volverA={volverA}>
    <button
      type="button"
      title={completa}
      aria-label={`Turno ${completa}. Ver detalle`}
      className={cn("absolute flex flex-col gap-0.5 overflow-hidden rounded-md border p-1.5 text-left text-xs text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", color)}
      style={estilo}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="font-semibold tabular-nums">{horario}</span>
        <Badge className={cn("shrink-0 gap-1 border-transparent px-1.5 py-0", colorInsignia)}>
          <IconoEstado className="size-3" aria-hidden />
          {etiquetaEstado}
        </Badge>
      </span>
      {lineas.map((linea, i) => (
        <span key={i} className={cn("truncate", i === 0 ? "font-medium" : "text-muted-foreground")}>
          {linea}
        </span>
      ))}
    </button>
    </TurnoCalendarioModal>
  );
}
