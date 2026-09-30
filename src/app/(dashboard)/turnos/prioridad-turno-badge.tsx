import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ETIQUETA_PRIORIDAD_TURNO, type PrioridadTurno } from "@/types/turno.types";

/**
 * Prioridad del turno como texto, no solo color (DESIGN.md), según el
 * mockup (págs. 3 a 5): «Normal» con contorno; «Alta» y «Urgente» con fondo
 * de advertencia o destructivo y el ícono de bandera.
 */
export function PrioridadTurnoBadge({ prioridad }: { prioridad: PrioridadTurno }) {
  if (prioridad === "NORMAL") return <Badge variant="outline">{ETIQUETA_PRIORIDAD_TURNO[prioridad]}</Badge>;
  const colores = prioridad === "ALTA" ? "bg-warning text-warning-foreground" : "bg-destructive text-card";
  return (
    <Badge variant="outline" className={`gap-1 border-transparent ${colores}`}>
      <Flag aria-hidden="true" className="size-3" />
      {ETIQUETA_PRIORIDAD_TURNO[prioridad]}
    </Badge>
  );
}
