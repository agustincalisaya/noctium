"use client";

import { Button } from "@/components/ui/button";

/**
 * Aviso de error del listado de alumnos con "Reintentar" (HU-B-04 criterio
 * 6). Lo usan el boundary `error.tsx` y la búsqueda del listado (HU-B-05)
 * cuando falla la red, para que ambos casos se vean igual.
 */
export function AvisoErrorAlumnos({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card p-12 text-center">
      <p className="text-sm text-destructive">No se pudo cargar la información de alumnos</p>
      <Button variant="outline" size="sm" onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  );
}
