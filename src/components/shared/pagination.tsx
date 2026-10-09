import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { texto } from "@/lib/textos";

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
  mostrarRango = false,
  mostrarNumeros = false,
  porPagina = 10,
  onPageChange,
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
  /** Presentación compacta del historial: «Mostrando X–Y de N». */
  mostrarRango?: boolean;
  /** Presenta botones numerados con elipsis además de Anterior/Siguiente. */
  mostrarNumeros?: boolean;
  porPagina?: number;
  /** Si se indica, pagina en el cliente; por defecto conserva enlaces de navegación. */
  onPageChange?: (pagina: number) => void;
}) {
  if (totalPaginas === 0 || (totalPaginas === 1 && !siempreVisible)) return null;

  const hayAnterior = paginaActual > 1;
  const haySiguiente = paginaActual < totalPaginas;
  const desde = total === undefined || total === 0 ? 0 : (paginaActual - 1) * porPagina + 1;
  const hasta = total === undefined ? 0 : Math.min(paginaActual * porPagina, total);
  const paginas = mostrarNumeros ? paginasVisibles(paginaActual, totalPaginas) : [];

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 pt-2" aria-label={texto("ui.comun.paginacion.nombre")}>
      <span className="text-sm text-muted-foreground">
        {mostrarRango && total !== undefined
          ? texto("ui.comun.paginacion.rango", { desde, hasta, total })
          : texto(total === undefined ? "ui.comun.paginacion.pagina" : "ui.comun.paginacion.paginaConTotal", { pagina: paginaActual, totalPaginas, total })}
      </span>
      <div className="flex items-center gap-2">
        <PaginationLink href={hayAnterior ? buildHref(paginaActual - 1) : null} onClick={hayAnterior && onPageChange ? () => onPageChange(paginaActual - 1) : undefined} aria-label={texto("ui.comun.paginacion.paginaAnterior")}>
          <ChevronLeft className="size-4" aria-hidden />
          {texto("ui.comun.paginacion.anterior")}
        </PaginationLink>
        {mostrarNumeros && <div className="flex items-center gap-1">
          {paginas.map((pagina, i) => pagina === null
            ? <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground" aria-hidden>{texto("ui.comun.paginacion.elipsis")}</span>
            : <PageButton key={pagina} pagina={pagina} actual={pagina === paginaActual} onClick={onPageChange ? () => onPageChange(pagina) : undefined} href={onPageChange ? undefined : buildHref(pagina)} />)}
        </div>}
        <PaginationLink href={haySiguiente ? buildHref(paginaActual + 1) : null} onClick={haySiguiente && onPageChange ? () => onPageChange(paginaActual + 1) : undefined} aria-label={texto("ui.comun.paginacion.paginaSiguiente")}>
          {texto("ui.comun.paginacion.siguiente")}
          <ChevronRight className="size-4" aria-hidden />
        </PaginationLink>
      </div>
    </nav>
  );
}

function PaginationLink({
  href,
  children,
  onClick,
  ...props
}: { href: string | null; children: ReactNode; onClick?: () => void } & HTMLAttributes<HTMLElement>) {
  const className = cn(buttonVariants({ variant: "outline", size: "sm" }));

  if (!href) {
    if (onClick) return <button type="button" className={className} onClick={onClick} {...props}>{children}</button>;
    return (
      <span className={cn(className, "pointer-events-none opacity-50")} aria-disabled="true" {...props}>
        {children}
      </span>
    );
  }

  if (onClick) return <button type="button" className={className} onClick={onClick} {...props}>{children}</button>;

  return (
    <Link href={href} className={className} {...props}>
      {children}
    </Link>
  );
}

function paginasVisibles(actual: number, total: number): (number | null)[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const candidatas = [...new Set([1, actual - 1, actual, actual + 1, total])]
    .filter((pagina) => pagina >= 1 && pagina <= total)
    .sort((a, b) => a - b);
  return candidatas.flatMap((pagina, i) => i > 0 && pagina - (candidatas[i - 1] ?? pagina) > 1
    ? [null, pagina]
    : [pagina]);
}

function PageButton({
  pagina,
  actual,
  href,
  onClick,
}: {
  pagina: number;
  actual: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const className = buttonVariants({ variant: actual ? "default" : "outline", size: "sm" });
  const props = { className, "aria-label": texto("ui.comun.paginacion.numero", { pagina }), ...(actual ? { "aria-current": "page" as const } : {}) };
  return onClick
    ? <button type="button" onClick={onClick} {...props}>{pagina}</button>
    : <Link href={href ?? "#"} {...props}>{pagina}</Link>;
}
