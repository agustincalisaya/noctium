import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerMateriaPorId } from "@/server/materias/materia.service";
import { ServiceError } from "@/server/shared/service-error";

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function MateriaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await verificarPermiso("materias:leer");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/materias");
    }
    throw error;
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

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5 p-6">
      <Link
        href="/materias"
        className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Volver al listado
      </Link>

      <div className="space-y-4 rounded-md border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-foreground">{materia.nombre}</h1>
          <Badge variant={materia.is_active ? "success" : "muted"}>
            {materia.is_active ? "Activa" : "Inactiva"}
          </Badge>
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
