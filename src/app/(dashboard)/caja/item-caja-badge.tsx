import { Badge } from "@/components/ui/badge";
import { texto } from "@/lib/textos";
import type { ItemCajaDto } from "@/types/caja.types";

/** Etiqueta del tipo de cada ítem de la caja abierta (HU-I-12 criterio 5): cobro, ingreso o egreso manual, ajuste. */
export function ItemCajaBadge({ item }: { item: ItemCajaDto }) {
  if (item.tipo === "COBRO") return <Badge variant="outline">{texto("ui.caja.item.cobro")}</Badge>;
  if (item.tipo === "MOVIMIENTO") {
    return <Badge variant="muted">
      {texto(item.movimiento === "INGRESO" ? "ui.caja.item.movimiento.ingreso" : "ui.caja.item.movimiento.egreso")}
    </Badge>;
  }
  return <Badge variant="accent">
    {texto(item.origen === "ANULACION" ? "ui.caja.item.ajuste.anulacion" : "ui.caja.item.ajuste.correccion")}
  </Badge>;
}
