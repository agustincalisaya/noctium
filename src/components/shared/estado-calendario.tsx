import type { ReactNode } from "react";
import { CalendarX, Loader2 } from "lucide-react";

/**
 * Estados de las vistas semanales del calendario (HU-J-01 c7, HU-J-02 c5),
 * con el texto de cada vista por prop. El error técnico con Reintentar está
 * en `error-calendario.tsx` (componente cliente).
 */

/** Indicador de carga de la grilla (fallback del `<Suspense>`). */
export function CargandoCalendario({ texto }: { texto: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {texto}
    </div>
  );
}

/** Aviso en lugar de la grilla: falta elegir, o un error de negocio esperable. */
export function AvisoCalendario({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-card py-12 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

/** Semana sin turnos: se muestra sobre la grilla vacía. */
export function CalendarioVacio({ texto }: { texto: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 rounded-md border border-border bg-card py-4 text-sm text-muted-foreground"
    >
      <CalendarX className="size-4" aria-hidden />
      {texto}
    </div>
  );
}
