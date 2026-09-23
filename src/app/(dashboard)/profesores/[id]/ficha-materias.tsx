import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { MateriaDeProfesor } from "@/types/profesor.types";
import { FichaSeccion } from "./ficha-seccion";

const MENSAJE_PROFESOR_INACTIVO = "Solo pueden asociarse materias a profesores activos";

/**
 * Sección "Materias" de la ficha (HU-D-03). Usa `FichaSeccion` con una lista
 * `<ul>` y no `FichaDatos`: las materias son una lista de largo variable, no
 * pares etiqueta/valor (HU-D-03 §1 punto 11). Muestra TODAS las asociadas;
 * las de materias dadas de baja llevan un badge "Inactiva" (§1 punto 12).
 * La acción de asociar solo existe para profesores activos (criterio 1).
 */
export function FichaMaterias({
  profesorId,
  activo,
  materias,
  puedeEditar,
}: {
  profesorId: string;
  activo: boolean;
  materias: MateriaDeProfesor[];
  puedeEditar: boolean;
}) {
  let accion = null;
  if (puedeEditar) {
    accion = activo ? (
      <Link
        href={`/profesores/${profesorId}/materias`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Asociar materias
      </Link>
    ) : (
      <p className="text-sm text-muted-foreground">{MENSAJE_PROFESOR_INACTIVO}</p>
    );
  }

  return (
    <FichaSeccion titulo="Materias" accion={accion}>
      {materias.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin materias asociadas</p>
      ) : (
        <ul className="space-y-2">
          {materias.map((materia) => (
            <li key={materia.id} className="flex flex-wrap items-center gap-2">
              <span className="break-words font-medium">
                {materia.nombre}
                {materia.codigo && (
                  <span className="text-muted-foreground"> ({materia.codigo})</span>
                )}
              </span>
              {!materia.activa && <Badge variant="muted">Inactiva</Badge>}
            </li>
          ))}
        </ul>
      )}
    </FichaSeccion>
  );
}
