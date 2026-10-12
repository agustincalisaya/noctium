"use client";

import { Button } from "@/components/ui/button";
import { texto } from "@/lib/textos";

/**
 * Boundary de error del segmento `/gerentes` (HU-G-01): cubre el listado, la
 * ficha, el alta y la edición. Nunca muestra el error técnico. `retry()` vuelve
 * a pedir los datos al servidor (mismo patrón que `/personal`).
 */
export default function ErrorGerentes({
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
      <p className="text-sm text-destructive">{texto("ui.gerentes.error.cargar")}</p>
      <Button variant="outline" size="sm" onClick={() => retry()}>
        {texto("ui.gerentes.error.reintentar")}
      </Button>
    </div>
  );
}
