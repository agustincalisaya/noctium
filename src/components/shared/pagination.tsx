import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Paginación server-side genérica, conectada a query params (`?pagina=`) vía
 * navegación con `<Link>` — sin JS de cliente propio, reusable por
 * cualquier listado paginado del proyecto (Materias, y luego Aulas/Alumnos/
 * Profesores cuando lo necesiten). El caller arma el resto de los query
 * params (`buildHref`) para no asumir cuáles existen en cada listado.
 */
export function Pagination({
  paginaActual,
  totalPaginas,
  total,
  buildHref,
  siempreVisible = false,
}: {
  paginaActual: number;
  totalPaginas: number;
  /** Cantidad total de registros (opcional) — se muestra junto a "Página X de Y" cuando se provee. */
  total?: number;
  buildHref: (pagina: number) => string;
  /**
   * Muestra "Página 1 de 1" (con los botones deshabilitados) aunque haya una
   * sola página — para listados que siempre deben informar página y total
   * (HU-D-05). Por defecto, con una sola página no se renderiza nada.
   */
  siempreVisible?: boolean;
}) {
  if (totalPaginas === 0 || (totalPaginas === 1 && !siempreVisible)) return null;

  const hayAnterior = paginaActual > 1;
  const haySiguiente = paginaActual < totalPaginas;

  return (
    <nav className="flex items-center justify-between gap-4 pt-2" aria-label="Paginación">
      <span className="text-sm text-muted-foreground">
        Página {paginaActual} de {totalPaginas}
        {total !== undefined && ` · ${total} en total`}
      </span>
      <div className="flex items-center gap-2">
        <PaginationLink href={hayAnterior ? buildHref(paginaActual - 1) : null} aria-label="Página anterior">
          <ChevronLeft className="size-4" aria-hidden />
          Anterior
        </PaginationLink>
        <PaginationLink href={haySiguiente ? buildHref(paginaActual + 1) : null} aria-label="Página siguiente">
          Siguiente
          <ChevronRight className="size-4" aria-hidden />
        </PaginationLink>
      </div>
    </nav>
  );
}

function PaginationLink({
  href,
  children,
  ...props
}: { href: string | null; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  const className = cn(buttonVariants({ variant: "outline", size: "sm" }));

  if (!href) {
    return (
      <span className={cn(className, "pointer-events-none opacity-50")} aria-disabled="true" {...props}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className} {...props}>
      {children}
    </Link>
  );
}
