"use client";

import { Toaster as Sonner } from "sonner";
import { Check, CircleAlert } from "lucide-react";

/** Tiempo visible de cada toast antes de ocultarse solo (docs/DESIGN.md §6.1). */
const DURACION_MS = 4000;

/**
 * Toaster de `sonner` (docs/DESIGN.md §6.1), arriba a la derecha. Escrito a
 * mano sin `next-themes`: el tema oscuro (`.dark`) no está activo en el repo,
 * así que el tema queda fijo en claro. Sin estilos propios de sonner
 * (`unstyled`): los colores salen solo de los tokens del proyecto.
 * Éxito: `--success` / `--success-foreground`. Error: `--destructive` con
 * texto `--card` (blanco), porque `--destructive-foreground` no existe.
 * Se dispara con `toast.success(...)` / `toast.error(...)` de `sonner`.
 */
export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="top-right"
      duration={DURACION_MS}
      icons={{
        success: <Check className="size-4" aria-hidden />,
        error: <CircleAlert className="size-4" aria-hidden />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex w-(--width) items-center gap-3 rounded-md p-3 text-sm font-medium shadow-lg",
          success: "bg-success text-success-foreground",
          error: "bg-destructive text-card",
          icon: "shrink-0",
        },
      }}
    />
  );
}
