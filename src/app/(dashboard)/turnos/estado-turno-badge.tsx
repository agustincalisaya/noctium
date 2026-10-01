import { Badge } from "@/components/ui/badge";
import { ETIQUETA_ESTADO_TURNO, type Turno } from "@/types/turno.types";

export function EstadoTurnoBadge({ estado }: { estado: Turno["estado"] }) {
  if (estado === "PENDIENTE") {
    return <Badge variant="outline" className="border-transparent bg-warning text-warning-foreground">{ETIQUETA_ESTADO_TURNO[estado]}</Badge>;
  }
  // DESIGN.md §6.5: «Cancelado» es un contorno — borde y texto destructivos sobre la tarjeta.
  if (estado === "CANCELADO") {
    return <Badge variant="outline" className="border-destructive bg-card text-destructive">{ETIQUETA_ESTADO_TURNO[estado]}</Badge>;
  }
  return <Badge variant={estado === "DISPONIBLE" ? "success" : "default"}>{ETIQUETA_ESTADO_TURNO[estado]}</Badge>;
}
