"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { construirUrlCalendario, type RutaCalendario } from "@/lib/calendario-semana";

// Mismo estilo de <select> nativo que registrar-horario-form.tsx (HU-D-04).
const CLASE_SELECT = cn(
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none",
  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/**
 * Selector de la entidad de una vista del calendario: profesor (HU-J-01)
 * o materia (HU-J-02). Cambiar la opción conserva la semana consultada; la
 * elección queda en la URL (`?<parametro>=`). Solo recibe datos
 * serializables: la URL se arma acá con la ruta y el nombre del parámetro.
 */
export function SelectorCalendario({
  id,
  etiqueta,
  placeholder,
  sinOpciones,
  opciones,
  valor,
  rutaBase,
  parametro,
  semana,
}: {
  id: string;
  etiqueta: string;
  placeholder: string;
  /** Texto cuando no hay ninguna opción. */
  sinOpciones: string;
  opciones: { id: string; etiqueta: string }[];
  valor: string | undefined;
  rutaBase: RutaCalendario;
  parametro: string;
  semana: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  if (opciones.length === 0) {
    return <p className="text-sm text-muted-foreground">{sinOpciones}</p>;
  }

  return (
    <div className="w-full max-w-sm space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <select
        key={valor ?? ""}
        id={id}
        name={parametro}
        defaultValue={valor && opciones.some((o) => o.id === valor) ? valor : ""}
        disabled={pendiente}
        className={CLASE_SELECT}
        onChange={(e) => {
          const elegido = e.target.value || undefined;
          startTransition(() => {
            router.push(construirUrlCalendario(rutaBase, { [parametro]: elegido, semana }));
          });
        }}
      >
        <option value="">{placeholder}</option>
        {opciones.map((opcion) => (
          <option key={opcion.id} value={opcion.id}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}
