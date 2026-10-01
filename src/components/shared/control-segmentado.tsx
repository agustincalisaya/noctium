import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Control segmentado de links (HU-J-03): fondo gris claro (`bg-muted`) y la
 * opción activa en blanco (`bg-card`) y negrita. Lo usan el control de
 * vista Día / Semana / Mes y el toggle Por profesor / Por materia. Cada
 * opción es un link: el estado vive en la URL, no en el cliente.
 */
export function ControlSegmentado({
  etiqueta,
  opciones,
  className,
}: {
  /** Nombre accesible del grupo. */
  etiqueta: string;
  opciones: { etiqueta: string; href: string; activa: boolean }[];
  className?: string;
}) {
  return (
    <nav aria-label={etiqueta} className={cn("inline-flex w-fit rounded-md bg-muted p-1", className)}>
      {opciones.map((opcion) => (
        <Link
          key={opcion.href}
          href={opcion.href}
          aria-current={opcion.activa ? "page" : undefined}
          className={cn(
            "rounded-sm px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            opcion.activa
              ? "bg-card font-semibold text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opcion.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
