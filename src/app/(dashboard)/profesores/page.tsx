import { Suspense } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { formatearApellidoNombre, resumirMaterias, VALOR_AUSENTE } from "@/lib/profesor-listado";
import { ListarProfesoresQuerySchema } from "@/server/profesores/profesor.schema";
import { listarProfesores } from "@/server/profesores/profesor.service";
import { exigirPermiso, tienePermiso } from "@/server/shared/with-permission";

/**
 * Listado de profesores (HU-D-05). La autorización real es
 * `profesores:leer` verificada acá, en el servidor (el proxy y el menú solo
 * filtran por rol): sin sesión -> /login, sin permiso -> /sin-permiso.
 *
 * La página viaja en la URL (`?pagina=`) y el detalle la recibe para volver
 * al mismo lugar. El orden es fijo (apellido, nombre, DNI), así que no
 * necesita parámetro propio.
 */
export default async function ProfesoresPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  await exigirPermiso("profesores:leer");
  // Ocultamiento de UI únicamente — el alta vuelve a verificar
  // profesores:crear en su Server Action / Route Handler.
  const puedeCrear = await tienePermiso("profesores:crear");

  const { pagina } = await searchParams;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Profesores</h1>
        {puedeCrear && <LinkNuevoProfesor />}
      </div>

      {/*
       * Suspense manual acotado a la tabla, no `loading.tsx` (rompería el 404
       * del detalle, mismo hallazgo que Materias/Alumnos). La `key` fuerza el
       * fallback al cambiar de página: mientras carga no hay tabla ni
       * paginación, así que no se puede navegar sobre datos viejos.
       */}
      <Suspense key={pagina ?? "1"} fallback={<CargandoProfesores />}>
        <TablaProfesores pagina={pagina} puedeCrear={puedeCrear} />
      </Suspense>
    </div>
  );
}

function LinkNuevoProfesor() {
  return (
    <Link
      href="/profesores/nuevo"
      className="flex items-center text-sm font-medium underline underline-offset-4"
    >
      <GraduationCap className="mr-2 size-4" aria-hidden />
      Nuevo profesor
    </Link>
  );
}

function CargandoProfesores() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Cargando profesores
    </div>
  );
}

async function TablaProfesores({
  pagina,
  puedeCrear,
}: {
  pagina: string | undefined;
  puedeCrear: boolean;
}) {
  const paginaSolicitada = Number(pagina);
  const query = ListarProfesoresQuerySchema.parse({
    pagina:
      Number.isSafeInteger(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : undefined,
  });
  const { items, paginacion } = await listarProfesores(query);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">No hay profesores registrados</p>
        {puedeCrear && (
          <Link
            href="/profesores/nuevo"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Nuevo profesor
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium">Apellido y nombre</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">DNI</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">Contacto</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">Materias</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {items.map((profesor) => {
              const apellidoNombre = formatearApellidoNombre(profesor.apellido, profesor.nombre);
              const materias = resumirMaterias(profesor.materias);
              return (
                <tr
                  key={profesor.id}
                  className={cn(
                    "relative transition-colors hover:bg-accent",
                    !profesor.activo && "opacity-60",
                  )}
                >
                  <td
                    className="max-w-[16rem] truncate px-4 py-2 font-medium text-foreground"
                    title={apellidoNombre}
                  >
                    <Link
                      href={`/profesores/${profesor.id}?pagina=${paginacion.pagina_actual}`}
                      className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
                      {apellidoNombre}
                    </Link>
                  </td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{profesor.dni}</td>
                  <td className="max-w-[16rem] px-4 py-2 text-muted-foreground">
                    <DatoContacto icono={Phone} etiqueta="Teléfono" valor={profesor.telefono} />
                    <DatoContacto icono={Mail} etiqueta="Email" valor={profesor.email} />
                  </td>
                  <td
                    className="max-w-[16rem] truncate px-4 py-2 text-muted-foreground"
                    title={profesor.materias.length > 0 ? profesor.materias.join(", ") : undefined}
                  >
                    {materias}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={profesor.activo ? "success" : "muted"}>
                      {profesor.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        paginaActual={paginacion.pagina_actual}
        totalPaginas={paginacion.total_paginas}
        total={paginacion.total}
        buildHref={(p) => `/profesores?pagina=${p}`}
        siempreVisible
      />
    </>
  );
}

function DatoContacto({
  icono: Icono,
  etiqueta,
  valor,
}: {
  icono: typeof Phone;
  etiqueta: string;
  valor: string | null;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={valor ?? undefined}>
      <Icono className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{etiqueta}: </span>
      <span className="truncate">{valor ?? VALOR_AUSENTE}</span>
    </span>
  );
}
