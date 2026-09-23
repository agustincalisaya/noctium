"use client";

import { Button } from "@/components/ui/button";

/**
 * Boundary de error del segmento `/profesores` (HU-D-05 criterio 5): cubre
 * el listado y el detalle. Nunca muestra el error técnico. `retry()` vuelve
 * a pedir los datos al servidor y re-renderiza el segmento (Next.js 16; a
 * diferencia de `reset()`, que solo re-renderiza sin volver a buscar).
 */
export default function ErrorProfesores({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="m-6 flex flex-col items-center gap-3 rounded-md border border-border bg-card p-12 text-center"
    >
      <p className="text-sm text-destructive">No se pudo cargar la información de profesores</p>
      <Button variant="outline" size="sm" onClick={() => retry()}>
        Reintentar
      </Button>
    </div>
  );
}
