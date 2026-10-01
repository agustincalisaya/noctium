"use client";

import { AvisoErrorAlumnos } from "./aviso-error-alumnos";

/**
 * Boundary de error del segmento `/alumnos` (criterio de aceptación 6,
 * HU-B-04): cubre tanto el listado como el detalle (`/alumnos/[id]`), ya
 * que ambos cuelgan de este mismo segmento. `reset()` es la API nativa de
 * Next.js para reintentar el render del segmento sin recargar la página
 * completa — mismo patrón que `materias/error.tsx` (HU-L-02).
 */
export default function ErrorAlumnos({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AvisoErrorAlumnos onReintentar={reset} />;
}
