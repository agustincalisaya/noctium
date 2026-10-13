import { Badge } from "@/components/ui/badge";
import { textoDiferencia } from "@/lib/caja";
import type { TipoDiferenciaCaja } from "@/types/caja.types";

/**
 * Diferencia de un cierre de caja (HU-I-12 criterio 7; DESIGN.md §6.6):
 * «La caja cuadra» relleno `success`, «Faltante» contorno `--destructive`
 * sobre `--card` (mismo aspecto que «Cancelado», §6.5) y «Sobrante» `warning`.
 */
export function DiferenciaCajaBadge({ tipo, diferencia }: { tipo: TipoDiferenciaCaja; diferencia: string }) {
  if (tipo === "CUADRA") return <Badge variant="success">{textoDiferencia(tipo, diferencia)}</Badge>;
  if (tipo === "SOBRANTE") return <Badge variant="warning">{textoDiferencia(tipo, diferencia)}</Badge>;
  return <Badge variant="outline" className="border-destructive bg-card text-destructive">{textoDiferencia(tipo, diferencia)}</Badge>;
}
