"use client";

import { texto } from "@/lib/textos";
import { BuscadorAlumnos, type AlumnoBuscado } from "../../turnos/buscador-alumnos";

/**
 * Paso 1 (spec_modulo_I.md §2.7.1): buscador de alumnos activos con el
 * combobox de DESIGN.md §8.2, activo desde 2 caracteres (lista grande).
 */
export function PasoBuscarAlumno({ onSeleccionar }: { onSeleccionar: (alumno: AlumnoBuscado) => void }) {
  return <section className="space-y-4" aria-labelledby="paso-buscar-alumno-titulo">
    <h2 id="paso-buscar-alumno-titulo" className="text-lg font-semibold">{texto("ui.pagos.buscador.titulo")}</h2>
    <BuscadorAlumnos
      id="registrar-pago-buscador"
      excluir={[]}
      deshabilitado={false}
      endpoint="/api/pagos/buscar-alumnos"
      textoSinResultados={(buscado) => texto("ui.pagos.buscador.sinResultados", { texto: buscado })}
      onSeleccionar={onSeleccionar}
    />
    <p className="text-xs text-muted-foreground">{texto("ui.pagos.buscador.ayuda")}</p>
  </section>;
}
