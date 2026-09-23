"use client";

import { Button } from "@/components/ui/button";

/**
 * Boundary de error del segmento `/materias` (criterio de aceptación 4,
 * HU-L-02): cubre tanto el listado como el detalle (`/materias/[id]`), ya
 * que ambos cuelgan de este mismo segmento. `reset()` es la API nativa de
 * Next.js para reintentar el render del segmento sin recargar la página
 * completa — no hace falta manejar el fetch a mano.
 */
export default function ErrorMaterias({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card p-12 text-center">
      <p className="text-sm text-destructive">No se pudo cargar la información de materias</p>
      <Button variant="outline" size="sm" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
