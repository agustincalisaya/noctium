"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filtrarMaterias } from "@/lib/filtrar-materias";
import type { OpcionMateria } from "./materias/asociar-materias-form";

const MENSAJE_PROFESOR_INACTIVO = "Solo pueden asociarse materias a profesores activos";

function etiquetaMateria({ nombre, codigo }: { nombre: string; codigo: string | null }) {
  return codigo ? `${nombre} (${codigo})` : nombre;
}

/**
 * Sección "Materias" del modo edición de la ficha (HU-D-07, spec §2.7). Mismo
 * selector que HU-D-03 (filtro con `filtrarMaterias()`, casillas "Nombre
 * (CÓDIGO)", mismos estilos), pero las asociadas están tildadas y HABILITADAS:
 * destildarlas es quitarlas. Componente controlado: el conjunto deseado vive
 * en `EditarProfesorForm`, que es quien guarda.
 *
 * Las asociadas inactivas se listan tildadas con "Inactiva" (solo se quitan si
 * Mesa las destilda a propósito); las inactivas no asociadas no llegan acá.
 * Una materia cuya baja se rechazó muestra debajo el aviso corto de DESIGN.md
 * §6.5 con el link "Ver turnos" (HU-D-07 AC3).
 */
export function MateriasProfesorSelector({
  opciones,
  guardadas,
  seleccionadas,
  onAlternar,
  bloqueos,
  idsInactivas,
  onVerTurnos,
  deshabilitado,
  profesorActivo,
  error,
}: {
  opciones: OpcionMateria[];
  /** Materias asociadas según lo último guardado (base para "agregar"/"quitar"). */
  guardadas: Set<string>;
  seleccionadas: Set<string>;
  onAlternar: (id: string, marcada: boolean) => void;
  /** materiaId → N turnos futuros que impidieron quitarla. */
  bloqueos: Map<string, number>;
  /** Materias del lote que dejaron de estar activas (MATERIA_INACTIVA). */
  idsInactivas: Set<string>;
  onVerTurnos: (materia: { id: string; nombre: string }) => void;
  deshabilitado: boolean;
  profesorActivo: boolean;
  error?: string;
}) {
  const [filtro, setFiltro] = useState("");
  const visibles = filtrarMaterias(opciones, filtro);
  const asociadasOriginales = opciones.filter((opcion) => guardadas.has(opcion.id));
  const agregar = [...seleccionadas].filter((id) => !guardadas.has(id)).length;
  const quitar = [...guardadas].filter((id) => !seleccionadas.has(id)).length;

  // `relative`: el <legend className="sr-only"> es `position: absolute` y, sin
  // un ancestro posicionado, su bloque contenedor sería el documento: quedaría
  // fuera del <main> que scrollea (y del `overflow-hidden` del layout), estiraría
  // html/body por debajo de la ventana y el gesto de scroll movería toda la
  // página (también el salto al ancla #materias).
  return (
    <section
      id="materias"
      aria-labelledby="titulo-materias"
      className="relative scroll-mt-6 space-y-4 rounded-md border border-border bg-card p-6 text-card-foreground"
    >
      <h2 id="titulo-materias" className="text-lg font-semibold">
        Materias
      </h2>

      {!profesorActivo ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{MENSAJE_PROFESOR_INACTIVO}</p>
          {asociadasOriginales.length > 0 && (
            <ul className="space-y-1 text-sm">
              {asociadasOriginales.map((materia) => (
                <li key={materia.id}>{etiquetaMateria(materia)}</li>
              ))}
            </ul>
          )}
        </div>
      ) : opciones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay materias activas para asociar</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-materias">Filtrar por nombre o código</Label>
            <Input
              id="filtro-materias"
              type="search"
              autoComplete="off"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Ej.: matemática o MAT101"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="sr-only">Materias del profesor</legend>
            {visibles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguna materia coincide con el filtro</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border bg-card">
                {visibles.map((materia) => {
                  const idCheckbox = `materia-${materia.id}`;
                  const cantidad = bloqueos.get(materia.id);
                  const inactivaEnLote = idsInactivas.has(materia.id);
                  const descripcion = cantidad !== undefined
                    ? `${idCheckbox}-bloqueo`
                    : inactivaEnLote ? `${idCheckbox}-error` : undefined;
                  return (
                    <li key={materia.id}>
                      <label
                        htmlFor={idCheckbox}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                      >
                        <input
                          id={idCheckbox}
                          type="checkbox"
                          className="size-4 shrink-0 accent-primary"
                          checked={seleccionadas.has(materia.id)}
                          disabled={deshabilitado}
                          onChange={(e) => onAlternar(materia.id, e.target.checked)}
                          aria-invalid={cantidad !== undefined || inactivaEnLote || undefined}
                          aria-describedby={descripcion}
                        />
                        <span className="min-w-0 flex-1 break-words">{etiquetaMateria(materia)}</span>
                        {!materia.activa && <Badge variant="muted">Inactiva</Badge>}
                        {inactivaEnLote && (
                          <span id={`${idCheckbox}-error`} className="text-xs font-medium text-destructive">
                            Dejó de estar activa
                          </span>
                        )}
                      </label>
                      {cantidad !== undefined && (
                        <div
                          id={`${idCheckbox}-bloqueo`}
                          role="alert"
                          className="mx-3 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground"
                        >
                          <CircleAlert className="size-4 shrink-0" aria-hidden />
                          <span>
                            No se puede quitar: el profesor tiene {cantidad} turnos futuros de esta materia
                          </span>
                          <button
                            type="button"
                            onClick={() => onVerTurnos({ id: materia.id, nombre: materia.nombre })}
                            className="rounded-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            Ver turnos
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {seleccionadas.size === 1 ? "1 materia asociada" : `${seleccionadas.size} materias asociadas`}
            {(agregar > 0 || quitar > 0) && ` · ${agregar} para agregar · ${quitar} para quitar`}
          </p>
        </>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
