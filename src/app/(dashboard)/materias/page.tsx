import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { ListarMateriasQuerySchema } from "@/server/materias/materia.schema";
import { listarMaterias } from "@/server/materias/materia.service";

export default async function MateriasPage({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string; pagina?: string }>;
}) {
  let rol;
  try {
    ({ rol } = await verificarPermiso("materias:leer"));
  } catch (error) {
    if (error instanceof PermisoError) redirect("/home");
    throw error;
  }

  const { creada, pagina } = await searchParams;
  const esGerente = rol === "GERENTE";

  return (
    <div className="space-y-4 p-6">
      {creada === "1" && (
        <p className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          Materia registrada correctamente
        </p>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Materias</h1>
        {/* Ocultamiento de UI únicamente — la verificación real es la de
            verificarPermiso("materias:crear") en el Server Action. */}
        {esGerente && (
          <Link
            href="/materias/nueva"
            className="flex items-center text-sm font-medium underline underline-offset-4"
          >
            <BookOpen className="mr-2 size-4" aria-hidden />
            Nueva materia
          </Link>
        )}
      </div>

      {/*
       * Suspense manual, acotado a esta tabla — a propósito NO es un
       * `loading.tsx` de archivo: ese tipo de boundary es automático a nivel
       * de segmento de ruta y cascadea a TODOS los hijos, incluido
       * `materias/[id]/page.tsx`. Eso rompía el status code 404 de
       * `notFound()` en el detalle (Next.js ya había streameado un 200
       * inicial antes de que el fetch del detalle resolviera). Un
       * `<Suspense>` acá adentro solo envuelve esta página (`/materias`),
       * nunca la ruta hermana `/materias/[id]`, que hoy no tiene ningún
       * ancestro con loading.tsx y por eso resuelve completo antes de
       * responder (mismo comportamiento que `profesores/[id]/page.tsx`).
       */}
      <Suspense fallback={<CargandoMaterias />}>
        <TablaMaterias pagina={pagina} esGerente={esGerente} />
      </Suspense>
    </div>
  );
}

function CargandoMaterias() {
  return (
    <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Cargando materias
    </div>
  );
}

async function TablaMaterias({ pagina, esGerente }: { pagina: string | undefined; esGerente: boolean }) {
  const paginaSolicitada = Number(pagina);
  const query = ListarMateriasQuerySchema.parse({
    pagina: Number.isFinite(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : undefined,
  });
  const { items, paginacion } = await listarMaterias(query);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">No hay materias registradas</p>
        {esGerente && (
          <Link
            href="/materias/nueva"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Nueva materia
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Nombre</th>
              <th className="px-4 py-2 text-left font-medium">Código</th>
              <th className="px-4 py-2 text-left font-medium">Profesores</th>
              <th className="px-4 py-2 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((materia) => (
              <tr
                key={materia.id}
                className={cn(
                  "relative transition-colors hover:bg-accent",
                  !materia.is_active && "opacity-60",
                )}
              >
                <td className="px-4 py-2 font-medium text-foreground">
                  <Link
                    href={`/materias/${materia.id}`}
                    className="after:absolute after:inset-0 after:content-['']"
                  >
                    {materia.nombre}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{materia.codigo ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{materia.profesores_count}</td>
                <td className="px-4 py-2">
                  <Badge variant={materia.is_active ? "success" : "muted"}>
                    {materia.is_active ? "Activa" : "Inactiva"}
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
        buildHref={(p) => `/materias?pagina=${p}`}
      />
    </>
  );
}
