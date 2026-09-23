"use client";

import { Button } from "@/components/ui/button";

/**
 * Boundary de error del segmento `/aulas` (criterio de aceptación 4,
 * HU-K-02): cubre tanto el listado como el detalle (`/aulas/[id]`), ya que
 * ambos cuelgan de este mismo segmento. `reset()` es la API nativa de
 * Next.js para reintentar el render del segmento sin recargar la página
 * completa — mismo patrón que `materias/error.tsx`.
 */
export default function ErrorAulas({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card p-12 text-center">
      <p className="text-sm text-destructive">No se pudo cargar la información de aulas</p>
      <Button variant="outline" size="sm" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
