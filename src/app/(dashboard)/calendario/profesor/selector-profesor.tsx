"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { construirUrlCalendarioProfesor } from "@/lib/calendario-semana";
import type { OpcionProfesor } from "@/types/profesor.types";

// Mismo estilo de <select> nativo que registrar-horario-form.tsx (HU-D-04).
const CLASE_SELECT = cn(
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none",
  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/**
 * Selector de profesor de la agenda (HU-J-01 c1), solo para Mesa de Entrada
 * y Gerente: el rol Profesor no lo recibe (c2). Cambiar de profesor
 * conserva la semana consultada; el profesor queda en la URL.
 */
export function SelectorProfesor({
  opciones,
  profesorId,
  semana,
}: {
  opciones: OpcionProfesor[];
  profesorId: string | undefined;
  semana: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  if (opciones.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay profesores activos</p>;
  }

  return (
    <div className="w-full max-w-sm space-y-1.5">
      <Label htmlFor="profesor">Profesor</Label>
      <select
        key={profesorId ?? ""}
        id="profesor"
        name="profesorId"
        defaultValue={profesorId && opciones.some((o) => o.id === profesorId) ? profesorId : ""}
        disabled={pendiente}
        className={CLASE_SELECT}
        onChange={(e) => {
          const elegido = e.target.value || undefined;
          startTransition(() => {
            router.push(construirUrlCalendarioProfesor({ profesorId: elegido, semana }));
          });
        }}
      >
        <option value="">Seleccioná un profesor</option>
        {opciones.map((opcion) => (
          <option key={opcion.id} value={opcion.id}>
            {opcion.nombreParaMostrar}
          </option>
        ))}
      </select>
    </div>
  );
}
