"use client";

import { Button } from "@/components/ui/button";

/**
 * Cuerpo de los `error.tsx` de las vistas del calendario (HU-J-01 c7,
 * HU-J-02 c5). Nunca muestra el error técnico. `retry()` vuelve a pedir los
 * datos al servidor y re-renderiza el segmento (Next.js 16).
 */
export function ErrorCalendario({ texto, retry }: { texto: string; retry: () => void }) {
  return (
    <div
      role="alert"
      className="m-6 flex flex-col items-center gap-3 rounded-md border border-border bg-card p-12 text-center"
    >
      <p className="text-sm text-destructive">{texto}</p>
      <Button variant="outline" size="sm" onClick={() => retry()}>
        Reintentar
      </Button>
    </div>
  );
}
