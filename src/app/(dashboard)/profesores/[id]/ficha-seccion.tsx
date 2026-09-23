import type { ReactNode } from "react";

/**
 * Bloque de la ficha del profesor: título, acción opcional (ej. "Editar") y
 * contenido. Cada sección de la ficha (contacto HU-D-02, materias HU-D-03,
 * horarios HU-D-04) usa este mismo contenedor.
 */
export function FichaSeccion({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: ReactNode;
  children: ReactNode;
}) {
  const idTitulo = `ficha-seccion-${titulo.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section
      aria-labelledby={idTitulo}
      className="space-y-3 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={idTitulo} className="text-lg font-semibold">
          {titulo}
        </h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

/** Lista etiqueta/valor de una sección; un valor ausente se muestra como "—". */
export function FichaDatos({ datos }: { datos: [etiqueta: string, valor: string | null][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {datos.map(([etiqueta, valor]) => (
        <div className="min-w-0" key={etiqueta}>
          <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
          <dd className="break-words font-medium">{valor ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
