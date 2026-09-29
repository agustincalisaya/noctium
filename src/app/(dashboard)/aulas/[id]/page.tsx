import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { esModoEdicion, fueActualizada, rutaModoEdicion } from "@/lib/modo-edicion";
import { PermisoError, exigirPermiso, tienePermiso, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerAulaPorId } from "@/server/aulas/aula.service";
import { ServiceError } from "@/server/shared/service-error";
import { EditarAulaForm } from "./editar-aula-form";

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Ficha de aula (HU-K-02) con modo edición (HU-K-03) sobre la misma ruta:
 * `?modo=edicion` (ver `@/lib/modo-edicion`). El chequeo de `aulas:editar`
 * de acá evita montar el formulario para un rol sin permiso; el rechazo que
 * realmente importa lo repite `modificarAula()` en la Server Action.
 */
export default async function AulaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const edicion = esModoEdicion(query);

  try {
    await verificarPermiso("aulas:leer");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/aulas");
    }
    throw error;
  }

  if (edicion) {
    await exigirPermiso("aulas:editar");
  }

  let aula;
  try {
    aula = await obtenerAulaPorId(id);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "AULA_NO_ENCONTRADA") {
      notFound();
    }
    throw error;
  }

  const breadcrumb = <Breadcrumb tramos={[{ etiqueta: "Aulas", href: "/aulas" }, { etiqueta: aula.nombre }]} />;

  if (edicion) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5 p-6">
        {breadcrumb}
        {/* key: al recargar tras un conflicto de edición llega una `version`
            nueva y el formulario se remonta con los datos actuales. */}
        <EditarAulaForm key={aula.version} aula={aula} />
      </div>
    );
  }

  const puedeEditar = await tienePermiso("aulas:editar");

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5 p-6">
      {breadcrumb}

      {fueActualizada(query) && (
        <p role="status" className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          Aula actualizada correctamente
        </p>
      )}

      <div className="space-y-4 rounded-md border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">{aula.nombre}</h1>
            <Badge variant={aula.is_active ? "success" : "muted"}>
              {aula.is_active ? "Activa" : "Inactiva"}
            </Badge>
          </div>
          {puedeEditar && (
            <Link
              href={rutaModoEdicion(`/aulas/${aula.id}`)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Modificar
            </Link>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Capacidad</dt>
            <dd className="text-foreground">{aula.capacidad}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fecha de alta</dt>
            <dd className="text-foreground">{formatearFecha(aula.created_at)}</dd>
          </div>
          {aula.version > 0 && (
            <div>
              <dt className="text-muted-foreground">Última modificación</dt>
              <dd className="text-foreground">{formatearFecha(aula.updated_at)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
