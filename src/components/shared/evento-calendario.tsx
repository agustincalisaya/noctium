import Link from "next/link";
import { CalendarCheck, Users, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EventoCalendario as Evento } from "@/types/calendario.types";

const ETIQUETA_ESTADO: Record<Evento["estado"], string> = {
  DISPONIBLE: "Disponible",
  COMPLETO: "Completo",
};

// El ícono distingue el estado además del texto (c3), sin depender del color.
const ICONO_ESTADO: Record<Evento["estado"], LucideIcon> = {
  DISPONIBLE: CalendarCheck,
  COMPLETO: Users,
};

/**
 * Bloque de un turno en la agenda (HU-J-01 c3): Hora, Alumno, Materia, Aula
 * y Estado, este último con texto e ícono además del color. Abre el detalle
 * del turno con `?volver=` apuntando a la agenda actual (c6). Si el bloque
 * es chico para todos los datos, el texto completo queda en el `title` y en
 * el nombre accesible del link.
 */
export function EventoCalendario({
  evento,
  estilo,
  volverA,
}: {
  evento: Evento;
  estilo: { top: string; height: string; left: string; width: string };
  /** URL de la agenda actual (profesor + semana). */
  volverA: string;
}) {
  const horario = `${evento.hora_inicio}–${evento.hora_fin}`;
  const estado = ETIQUETA_ESTADO[evento.estado];
  const IconoEstado = ICONO_ESTADO[evento.estado];
  const descripcion = `${horario} · ${evento.alumno} · ${evento.materia} · ${evento.aula} · ${estado}`;

  return (
    <Link
      href={`/turnos/${encodeURIComponent(evento.turno_id)}?volver=${encodeURIComponent(volverA)}`}
      prefetch={false}
      title={descripcion}
      aria-label={`Turno ${descripcion}. Ver detalle`}
      className="absolute flex flex-col gap-0.5 overflow-hidden rounded-md border border-border border-l-4 border-l-primary bg-background p-1.5 text-xs text-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={estilo}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="font-semibold tabular-nums">{horario}</span>
        <Badge variant="success" className="shrink-0 gap-1 px-1.5 py-0">
          <IconoEstado className="size-3" aria-hidden />
          {estado}
        </Badge>
      </span>
      <span className="truncate font-medium">{evento.alumno}</span>
      <span className="truncate text-muted-foreground">{evento.materia}</span>
      <span className="truncate text-muted-foreground">{evento.aula}</span>
    </Link>
  );
}
