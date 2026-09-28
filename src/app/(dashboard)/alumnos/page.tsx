import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { ListarAlumnosQuerySchema } from "@/server/alumnos/alumno.schema";
import { listarAlumnos } from "@/server/alumnos/alumno.service";
import { listarFormasPagoActivas } from "@/server/alumnos/alumno.service";
import { getParametroNumerico } from "@/server/shared/parametros";
import { AlumnosModales, AbrirAlumno, AbrirNuevoAlumno } from "./alumnos-modales";

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
  const [dniLongitudMin, dniLongitudMax, formasPagoActivas] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
    esMesaDeEntrada ? listarFormasPagoActivas() : Promise.resolve([]),
  ]);

  return (
    <AlumnosModales puedeCrear={esMesaDeEntrada} puedeEditar={esMesaDeEntrada} dniLongitudMin={dniLongitudMin} dniLongitudMax={dniLongitudMax} formasPagoActivas={formasPagoActivas}>
    <div className="space-y-5 p-6">
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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">Alumnos</h1><p className="text-sm text-muted-foreground">Consultá las fichas y los datos de contacto de los alumnos.</p></div>
        {/* Ocultamiento de UI únicamente — la verificación real es la de
            verificarPermiso("alumnos:crear") en el Server Action. */}
        {esMesaDeEntrada && (
          <AbrirNuevoAlumno />
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
      <Suspense key={pagina ?? "1"} fallback={<CargandoAlumnos />}>
        <TablaAlumnos pagina={pagina} esMesaDeEntrada={esMesaDeEntrada} />
      </Suspense>
    </div>
    </AlumnosModales>
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
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">No hay alumnos registrados</p>
        {esMesaDeEntrada && (
          <AbrirNuevoAlumno compacto />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><p className="text-sm font-semibold">{paginacion.total} {paginacion.total === 1 ? "alumno registrado" : "alumnos registrados"}</p><p className="text-xs text-muted-foreground">Seleccioná un alumno para ver su ficha</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium">Apellido y nombre</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">DNI</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">Teléfono</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">Email</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">Estado</th>
              <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Abrir ficha</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {items.map((alumno) => (
              <tr
                key={alumno.id}
                className={cn(
                  "relative transition-colors hover:bg-accent",
                  !alumno.is_active && "opacity-60",
                )}
              >
                <td className="max-w-[16rem] truncate px-4 py-2 font-medium text-foreground" title={`${alumno.apellido}, ${alumno.nombre}`}>
                  <AbrirAlumno id={alumno.id} nombre={`${alumno.apellido}, ${alumno.nombre}`} />
                </td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">{alumno.dni}</td>
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
                <td className="px-3 py-2 text-muted-foreground"><ChevronRight className="size-4" aria-hidden /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <Pagination
        paginaActual={paginacion.pagina_actual}
        totalPaginas={paginacion.total_paginas}
        total={paginacion.total}
        buildHref={(p) => `/alumnos?pagina=${p}`}
        siempreVisible
      />
    </>
  );
}
