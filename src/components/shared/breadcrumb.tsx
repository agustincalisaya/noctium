import { LinkProtegido } from "@/components/sesion/link-protegido";

/**
 * Migas de pan de una ficha ("Materias / Matemática"). Los tramos con `href`
 * usan `LinkProtegido`: salir desde un modo edición con cambios pide
 * confirmación. El último tramo es la página actual.
 */
export function Breadcrumb({ tramos }: { tramos: { etiqueta: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {tramos.map((tramo, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {tramo.href ? (
              <LinkProtegido
                href={tramo.href}
                className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tramo.etiqueta}
              </LinkProtegido>
            ) : (
              <span aria-current="page" className="truncate text-foreground">
                {tramo.etiqueta}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
