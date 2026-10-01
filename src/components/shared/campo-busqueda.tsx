"use client";

import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Espera desde la última tecla antes de buscar (spec_modulo_B.md §2.7, spec_modulo_C.md §2.7). */
export const ESPERA_BUSQUEDA_MS = 300;
/** Demora de la respuesta a partir de la cual se muestra el spinner del input. */
export const ESPERA_AVISO_CARGA_MS = 300;

/**
 * Campo de "búsqueda inteligente" de los listados (HU-B-05, HU-C-02):
 * input de ancho completo con lupa a la izquierda. Mientras `buscando`, la
 * lupa se reemplaza por un spinner del mismo tamaño y en el mismo lugar (el
 * aviso no mueve el layout) y se anuncia `textoBuscando` a lectores de
 * pantalla. Cada listado decide cuándo `buscando` es true (solo si la
 * respuesta tarda más de ESPERA_AVISO_CARGA_MS).
 */
export function CampoBusqueda({
  valor,
  onCambiar,
  placeholder,
  etiqueta,
  buscando,
  textoBuscando,
}: {
  valor: string;
  onCambiar: (valor: string) => void;
  placeholder: string;
  etiqueta: string;
  buscando: boolean;
  textoBuscando: string;
}) {
  const claseIcono = "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground";
  return (
    <div className="relative">
      {buscando ? (
        <Loader2 className={cn(claseIcono, "animate-spin")} aria-hidden data-buscando="" />
      ) : (
        <Search className={claseIcono} aria-hidden />
      )}
      {buscando && <span role="status" className="sr-only">{textoBuscando}</span>}
      <Input
        type="search"
        value={valor}
        onChange={(event) => onCambiar(event.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta}
        autoComplete="off"
        maxLength={100}
        className="pl-9"
      />
    </div>
  );
}
