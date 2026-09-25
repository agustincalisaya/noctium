import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { ListarAlumnosQuerySchema } from "@/server/alumnos/alumno.schema";
import { listarAlumnos } from "@/server/alumnos/alumno.service";

export default async function AlumnosPage({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string; pagina?: string; sin_contacto?: string; motivo?: string }>;
}) {
  let rol;
  try {
    ({ rol } = await verificarPermiso("alumnos:leer"));
  } catch (error) {
    if (error instanceof PermisoError) redirect("/home");
    throw error;
  }

  const { creada, pagina, sin_contacto: sinContacto, motivo } = await searchParams;
  const esMesaDeEntrada = rol === "MESA_ENTRADA";

  return (
    <div className="space-y-4 p-6">
      {creada === "1" && (
        <p className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          Alumno registrado correctamente
        </p>
      )}
      {/* Alta con contacto cuyo guardado falló (alumno-form.tsx): el alumno
          quedó creado, solo falta el contacto. */}
      {creada === "1" && sinContacto && (
        <p role="status" className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground">
          {motivo === "email_ya_asociado"
            ? "Los datos de contacto no se guardaron: el email ya está asociado a otra cuenta."
            : "Los datos de contacto no se guardaron."}{" "}
          Podés cargarlos más tarde desde la ficha.{" "}
          {esMesaDeEntrada && (
            <Link href={`/alumnos/${encodeURIComponent(sinContacto)}/contacto`} className="font-medium underline underline-offset-4">
              Cargar datos de contacto
            </Link>
          )}
        </p>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Alumnos</h1>
        {/* Ocultamiento de UI únicamente — la verificación real es la de
            verificarPermiso("alumnos:crear") en el Server Action. */}
        {esMesaDeEntrada && (
          <Link
            href="/alumnos/nueva"
            className="flex items-center text-sm font-medium underline underline-offset-4"
          >
            <GraduationCap className="mr-2 size-4" aria-hidden />
            Nuevo alumno
          </Link>
        )}
      </div>

      {/*
       * Suspense manual, acotado a esta tabla — a propósito NO es un
       * `loading.tsx` de archivo: ese boundary es automático a nivel de
       * segmento de ruta y cascadea a TODOS los hijos, incluido
       * `alumnos/[id]/page.tsx`, rompiendo el status code 404 de
       * `notFound()` en el detalle (mismo hallazgo que HU-L-02 en
       * Materias). Mismo patrón que `materias/page.tsx`.
       */}
      <Suspense fallback={<CargandoAlumnos />}>
        <TablaAlumnos pagina={pagina} esMesaDeEntrada={esMesaDeEntrada} />
      </Suspense>
    </div>
  );
}

function CargandoAlumnos() {
  return (
    <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Cargando alumnos
    </div>
  );
}

async function TablaAlumnos({
  pagina,
  esMesaDeEntrada,
}: {
  pagina: string | undefined;
  esMesaDeEntrada: boolean;
}) {
  const paginaSolicitada = Number(pagina);
  const query = ListarAlumnosQuerySchema.parse({
    pagina: Number.isFinite(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : undefined,
  });
  const { items, paginacion } = await listarAlumnos(query);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">No hay alumnos registrados</p>
        {esMesaDeEntrada && (
          <Link
            href="/alumnos/nueva"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Nuevo alumno
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
              <th className="px-4 py-2 text-left font-medium">Apellido y nombre</th>
              <th className="px-4 py-2 text-left font-medium">DNI</th>
              <th className="px-4 py-2 text-left font-medium">Teléfono</th>
              <th className="px-4 py-2 text-left font-medium">Email</th>
              <th className="px-4 py-2 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((alumno) => (
              <tr
                key={alumno.id}
                className={cn(
                  "relative transition-colors hover:bg-accent",
                  !alumno.is_active && "opacity-60",
                )}
              >
                <td className="max-w-[16rem] truncate px-4 py-2 font-medium text-foreground" title={`${alumno.apellido}, ${alumno.nombre}`}>
                  <Link
                    href={`/alumnos/${alumno.id}?pagina=${paginacion.pagina_actual}`}
                    className="after:absolute after:inset-0 after:content-['']"
                  >
                    {alumno.apellido}, {alumno.nombre}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{alumno.dni}</td>
                <td className="max-w-[12rem] truncate px-4 py-2 text-muted-foreground" title={alumno.telefono ?? "—"}>
                  {alumno.telefono ?? "—"}
                </td>
                <td className="max-w-[16rem] truncate px-4 py-2 text-muted-foreground" title={alumno.email ?? "—"}>
                  {alumno.email ?? "—"}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={alumno.is_active ? "success" : "muted"}>
                    {alumno.is_active ? "Activo" : "Inactivo"}
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
        total={paginacion.total}
        buildHref={(p) => `/alumnos?pagina=${p}`}
      />
    </>
  );
}
