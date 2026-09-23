"use client";

import { Button } from "@/components/ui/button";

/**
 * Boundary de error de la agenda por profesor (HU-J-01 c7). Nunca muestra el
 * error técnico. `retry()` vuelve a pedir los datos al servidor y
 * re-renderiza el segmento (Next.js 16, mismo criterio que
 * `profesores/error.tsx` de HU-D-05).
 */
export default function ErrorAgendaProfesor({
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
      <p className="text-sm text-destructive">No se pudo cargar la agenda</p>
      <Button variant="outline" size="sm" onClick={() => retry()}>
        Reintentar
      </Button>
    </div>
  );
}
