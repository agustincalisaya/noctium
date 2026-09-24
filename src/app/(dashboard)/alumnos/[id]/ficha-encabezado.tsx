import Link from "next/link";
import { Badge } from "@/components/ui/badge";

/**
 * Encabezado de la ficha: identidad resumida y estado del alumno.
 * `success`/`muted` para Activo/Inactivo (corrección retroactiva HU-B-04:
 * quedó con `accent`/`outline` en HU-B-02, se alinea con el criterio usado
 * en el resto del módulo — listado y `materias/page.tsx`).
 *
 * Link "Modificar datos" (HU-B-06, criterio 1): visible solo si `puedeEditar`
 * (derivado de `alumnos:editar`, ya calculado en `page.tsx` desde HU-B-04) —
 * la verificación real es la de `verificarPermiso("alumnos:editar")` dentro
 * de la Server Action/Route Handler, esto solo evita mostrar el acceso a
 * quien no podría enviarlo.
 */
export function FichaEncabezado({
  alumnoId,
  nombre,
  apellido,
  dni,
  activo,
  puedeEditar,
}: {
  alumnoId: string;
  nombre: string;
  apellido: string;
  dni: string;
  activo: boolean;
  puedeEditar: boolean;
}) {
  return (
    <header className="space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">
          {apellido}, {nombre}
        </h1>
        <Badge variant={activo ? "success" : "muted"}>{activo ? "Activo" : "Inactivo"}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">DNI {dni}</p>
      {puedeEditar && (
        <Link
          href={`/alumnos/${alumnoId}/editar`}
          className="inline-block rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Modificar datos
        </Link>
      )}
    </header>
  );
}
