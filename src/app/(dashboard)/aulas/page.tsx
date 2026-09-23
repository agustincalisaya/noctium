import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DoorOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { ListarAulasQuerySchema } from "@/server/aulas/aula.schema";
import { listarAulas } from "@/server/aulas/aula.service";

export default async function AulasPage({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string; pagina?: string }>;
}) {
  try {
    await verificarPermiso("aulas:leer");
  } catch (error) {
    if (error instanceof PermisoError) redirect("/home");
    throw error;
  }

  const { creada, pagina } = await searchParams;

  return (
    <div className="space-y-4 p-6">
      {creada === "1" && (
        <p className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          Aula registrada correctamente
        </p>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Aulas</h1>
        {/* Ocultamiento de UI únicamente — la verificación real es la de
            verificarPermiso("aulas:crear") en el Server Action. */}
        <Link
          href="/aulas/nueva"
          className="flex items-center text-sm font-medium underline underline-offset-4"
        >
          <DoorOpen className="mr-2 size-4" aria-hidden />
          Nueva aula
        </Link>
      </div>

      {/*
       * Suspense manual, acotado a esta tabla — a propósito NO es un
       * `loading.tsx` de archivo: ese boundary es automático a nivel de
       * segmento y cascadea a TODOS los hijos, incluido `aulas/[id]/page.tsx`
       * (mismo bug ya documentado en `materias/page.tsx`: rompería el status
       * code de `notFound()` en el detalle).
       */}
      <Suspense fallback={<CargandoAulas />}>
        <TablaAulas pagina={pagina} />
      </Suspense>
    </div>
  );
}

function CargandoAulas() {
  return (
    <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Cargando aulas
    </div>
  );
}

async function TablaAulas({ pagina }: { pagina: string | undefined }) {
  const paginaSolicitada = Number(pagina);
  const query = ListarAulasQuerySchema.parse({
    pagina: Number.isFinite(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : undefined,
  });
  const { items, paginacion } = await listarAulas(query);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">No hay aulas registradas</p>
        <Link href="/aulas/nueva" className="text-sm font-medium text-primary underline underline-offset-4">
          Nueva aula
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Nombre o número</th>
              <th className="px-4 py-2 text-left font-medium">Capacidad</th>
              <th className="px-4 py-2 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((aula) => (
              <tr
                key={aula.id}
                className={cn(
                  "relative transition-colors hover:bg-accent",
                  !aula.is_active && "opacity-60",
                )}
              >
                <td className="px-4 py-2 font-medium text-foreground">
                  <Link
                    href={`/aulas/${aula.id}`}
                    className="after:absolute after:inset-0 after:content-['']"
                  >
                    {aula.nombre}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{aula.capacidad}</td>
                <td className="px-4 py-2">
                  <Badge variant={aula.is_active ? "success" : "muted"}>
                    {aula.is_active ? "Activa" : "Inactiva"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        paginaActual={paginacion.pagina_actual}
        totalPaginas={paginacion.total_paginas}
        buildHref={(p) => `/aulas?pagina=${p}`}
      />
    </>
  );
}
