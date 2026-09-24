import { Badge } from "@/components/ui/badge";
import { ETIQUETA_ESTADO_TURNO, type Turno } from "./turno.types";

export function EstadoTurnoBadge({ estado }: { estado: Turno["estado"] }) {
  if (estado === "PENDIENTE") {
    return <Badge variant="outline" className="border-transparent bg-warning text-warning-foreground">{ETIQUETA_ESTADO_TURNO[estado]}</Badge>;
  }
  return <Badge variant={estado === "DISPONIBLE" ? "success" : "default"}>{ETIQUETA_ESTADO_TURNO[estado]}</Badge>;
}
