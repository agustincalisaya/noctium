import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerAulaPorId } from "@/server/aulas/aula.service";
import { ServiceError } from "@/server/shared/service-error";

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function AulaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await verificarPermiso("aulas:leer");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/aulas");
    }
    throw error;
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

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5 p-6">
      <Link
        href="/aulas"
        className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Volver al listado
      </Link>

      <div className="space-y-4 rounded-md border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-foreground">{aula.nombre}</h1>
          <Badge variant={aula.is_active ? "success" : "muted"}>
            {aula.is_active ? "Activa" : "Inactiva"}
          </Badge>
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
        </dl>
      </div>
    </div>
  );
}
