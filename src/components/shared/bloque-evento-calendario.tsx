import Link from "next/link";
import { CalendarCheck, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { EventoCalendarioBase } from "@/types/calendario.types";

type Estado = EventoCalendarioBase["estado"];

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  DISPONIBLE: "Disponible",
  COMPLETO: "Completo",
};

// El ícono distingue el estado además del texto, sin depender del color
// (HU-J-01 c3, HU-J-02 c2).
export const ICONO_ESTADO: Record<Estado, LucideIcon> = {
  DISPONIBLE: CalendarCheck,
  COMPLETO: Users,
};

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
  lineas,
  descripcion,
  estilo,
  volverA,
}: {
  turnoId: string;
  horaInicio: string;
  horaFin: string;
  estado: Estado;
  /** La primera va destacada; el resto, en texto secundario. */
  lineas: string[];
  /** Descripción completa, sin horario ni estado (se agregan acá). */
  descripcion: string;
  estilo: EstiloEventoEnGrilla;
  /** URL de la vista actual (entidad elegida + semana). */
  volverA: string;
}) {
  const horario = `${horaInicio}–${horaFin}`;
  const etiquetaEstado = ETIQUETA_ESTADO[estado];
  const IconoEstado = ICONO_ESTADO[estado];
  const completa = `${horario} · ${descripcion} · ${etiquetaEstado}`;

  return (
    <Link
      href={`/turnos/${encodeURIComponent(turnoId)}?volver=${encodeURIComponent(volverA)}`}
      prefetch={false}
      title={completa}
      aria-label={`Turno ${completa}. Ver detalle`}
      className="absolute flex flex-col gap-0.5 overflow-hidden rounded-md border border-border border-l-4 border-l-primary bg-background p-1.5 text-xs text-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={estilo}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="font-semibold tabular-nums">{horario}</span>
        <Badge variant="success" className="shrink-0 gap-1 px-1.5 py-0">
          <IconoEstado className="size-3" aria-hidden />
          {etiquetaEstado}
        </Badge>
      </span>
      {lineas.map((linea, i) => (
        <span key={i} className={cn("truncate", i === 0 ? "font-medium" : "text-muted-foreground")}>
          {linea}
        </span>
      ))}
    </Link>
  );
}
