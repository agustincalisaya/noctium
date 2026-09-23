import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ResumenSemanalHorarios } from "@/components/shared/resumen-semanal-horarios";
import type { HorarioAtencion } from "@/types/profesor.types";
import { FichaSeccion } from "./ficha-seccion";

const MENSAJE_PROFESOR_INACTIVO = "Solo pueden registrarse horarios de profesores activos";

/**
 * Sección "Horario de atención" de la ficha (HU-D-04): resumen semanal y
 * acceso al registro con el profesor precargado. Mismo criterio que
 * `FichaMaterias`: la acción solo existe para profesores activos (c1).
 */
export function FichaHorarios({
  profesorId,
  activo,
  horarios,
  puedeEditar,
}: {
  profesorId: string;
  activo: boolean;
  horarios: HorarioAtencion[];
  puedeEditar: boolean;
}) {
  let accion = null;
  if (puedeEditar) {
    accion = activo ? (
      <Link
        href={`/profesores/horarios/nuevo?profesorId=${profesorId}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Registrar horario
      </Link>
    ) : (
      <p className="text-sm text-muted-foreground">{MENSAJE_PROFESOR_INACTIVO}</p>
    );
  }

  return (
    <FichaSeccion titulo="Horario de atención" accion={accion}>
      <ResumenSemanalHorarios horarios={horarios} />
    </FichaSeccion>
  );
}
