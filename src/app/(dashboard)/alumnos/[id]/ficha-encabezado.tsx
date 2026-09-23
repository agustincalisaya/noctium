import { Badge } from "@/components/ui/badge";

/**
 * Encabezado de la ficha: identidad resumida y estado del alumno.
 * `success`/`muted` para Activo/Inactivo (corrección retroactiva HU-B-04:
 * quedó con `accent`/`outline` en HU-B-02, se alinea con el criterio usado
 * en el resto del módulo — listado y `materias/page.tsx`).
 */
export function FichaEncabezado({
  nombre,
  apellido,
  dni,
  activo,
}: {
  nombre: string;
  apellido: string;
  dni: string;
  activo: boolean;
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
    </header>
  );
}
