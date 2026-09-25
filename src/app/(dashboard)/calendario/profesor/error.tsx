"use client";

import { ErrorCalendario } from "@/components/shared/error-calendario";

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
  return <ErrorCalendario texto="No se pudo cargar la agenda" retry={retry} />;
}
