"use client";

import { ErrorCalendario } from "@/components/shared/error-calendario";

/**
 * Boundary de error del calendario por materia (HU-J-02 c5). Nunca muestra
 * el error técnico; `retry()` vuelve a pedir los datos al servidor.
 */
export default function ErrorCalendarioMateria({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorCalendario texto="No se pudo cargar el calendario de la materia" retry={retry} />;
}
