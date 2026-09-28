import { Suspense } from "react";
import { ChevronRight, Loader2, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { fechaUTCHaceAnios } from "@/server/shared/fecha";
import { getParametroNumerico, obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import { listarMateriasActivas } from "@/server/materias/materia.service";
import { AbrirNuevoProfesor, AbrirProfesor, ProfesoresModales } from "./profesores-modales";
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
  const puedeEditar = await tienePermiso("profesores:editar");
  const [dniLongitudMin, dniLongitudMax, parametrosHorario, materiasActivas] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
    obtenerParametrosHorarioOperativo(),
    puedeEditar ? listarMateriasActivas() : Promise.resolve([]),
  ]);

  const { pagina } = await searchParams;

  return (
    <ProfesoresModales puedeCrear={puedeCrear} puedeEditar={puedeEditar} dniLongitudMin={dniLongitudMin} dniLongitudMax={dniLongitudMax} fechaMaximaNacimiento={fechaUTCHaceAnios(18).toISOString().slice(0, 10)} parametrosHorario={parametrosHorario} materiasActivas={materiasActivas.map((materia) => ({ id: materia.idMateria, nombre: materia.nombreMateria, codigo: materia.codigoMateria, activa: true }))}>
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">Profesores</h1><p className="text-sm text-muted-foreground">Consultá las fichas, materias y horarios de atención.</p></div>
        {puedeCrear && <AbrirNuevoProfesor />}
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
    </ProfesoresModales>
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
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">No hay profesores registrados</p>
        {puedeCrear && (
          <AbrirNuevoProfesor />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><p className="text-sm font-semibold">{paginacion.total} {paginacion.total === 1 ? "profesor registrado" : "profesores registrados"}</p><p className="text-xs text-muted-foreground">Seleccioná un profesor para ver su ficha</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium">Apellido y nombre</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">DNI</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">Contacto</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">Materias</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">Estado</th>
              <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Abrir ficha</span></th>
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
                    <AbrirProfesor id={profesor.id} nombre={apellidoNombre} />
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
                  <td className="px-3 py-2 text-muted-foreground"><ChevronRight className="size-4" aria-hidden /></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
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
