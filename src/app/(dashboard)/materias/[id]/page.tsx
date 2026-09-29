import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { esModoEdicion, fueActualizada, rutaModoEdicion } from "@/lib/modo-edicion";
import { PermisoError, exigirPermiso, tienePermiso, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerMateriaPorId } from "@/server/materias/materia.service";
import { ServiceError } from "@/server/shared/service-error";
import { EditarMateriaForm } from "./editar-materia-form";

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Ficha de materia (HU-L-02) con modo edición (HU-L-03) sobre la misma ruta:
 * `?modo=edicion` (ver `@/lib/modo-edicion`). El chequeo de `materias:editar`
 * de acá evita montar el formulario para un rol sin permiso; el rechazo que
 * realmente importa lo repite `modificarMateria()` en la Server Action.
 */
export default async function MateriaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const edicion = esModoEdicion(query);

  try {
    await verificarPermiso("materias:leer");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/materias");
    }
    throw error;
  }

  if (edicion) {
    await exigirPermiso("materias:editar");
  }

  let materia;
  try {
    materia = await obtenerMateriaPorId(id);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "MATERIA_NO_ENCONTRADA") {
      notFound();
    }
    throw error;
  }

  const breadcrumb = <Breadcrumb tramos={[{ etiqueta: "Materias", href: "/materias" }, { etiqueta: materia.nombre }]} />;

  if (edicion) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-5 p-6">
        {breadcrumb}
        {/* key: al recargar tras un conflicto de edición llega una `version`
            nueva y el formulario se remonta con los datos actuales. */}
        <EditarMateriaForm key={materia.version} materia={materia} />
      </div>
    );
  }

  const puedeEditar = await tienePermiso("materias:editar");

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5 p-6">
      {breadcrumb}

      {fueActualizada(query) && (
        <p role="status" className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          Materia actualizada correctamente
        </p>
      )}

      <div className="space-y-4 rounded-md border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">{materia.nombre}</h1>
            <Badge variant={materia.is_active ? "success" : "muted"}>
              {materia.is_active ? "Activa" : "Inactiva"}
            </Badge>
          </div>
          {puedeEditar && (
            <Link
              href={rutaModoEdicion(`/materias/${materia.id}`)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Modificar
            </Link>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Código</dt>
            <dd className="text-foreground">{materia.codigo ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fecha de alta</dt>
            <dd className="text-foreground">{formatearFecha(materia.created_at)}</dd>
          </div>
          {materia.version > 0 && (
            <div>
              <dt className="text-muted-foreground">Última modificación</dt>
              <dd className="text-foreground">{formatearFecha(materia.updated_at)}</dd>
            </div>
          )}
        </dl>

        <div>
          <h2 className="mb-2 text-sm font-medium text-foreground">Profesores asociados</h2>
          {materia.profesores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin profesores asociados</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {materia.profesores.map((profesor) => (
                <li key={profesor.id}>{profesor.nombre_completo}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
