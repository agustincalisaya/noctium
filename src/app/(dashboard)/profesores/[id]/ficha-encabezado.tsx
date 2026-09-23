import { Badge } from "@/components/ui/badge";

/** Encabezado de la ficha: identidad resumida y estado del profesor. */
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
        <Badge variant={activo ? "accent" : "outline"}>{activo ? "Activo" : "Inactivo"}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">DNI {dni}</p>
    </header>
  );
}
