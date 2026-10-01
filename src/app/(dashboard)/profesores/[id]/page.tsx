import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { esModoEdicion, fueActualizada, rutaModoEdicion, rutaTrasGuardar } from "@/lib/modo-edicion";
import { formatearApellidoNombre } from "@/lib/profesor-listado";
import { exigirPermiso, tienePermiso } from "@/server/shared/with-permission";
import { getParametroNumerico } from "@/server/shared/parametros";
import { fechaUTCHaceAnios } from "@/server/shared/fecha";
import { obtenerDetalleProfesor } from "@/server/profesores/profesor.service";
import { FichaEncabezado } from "./ficha-encabezado";
import { FichaIdentidad } from "./ficha-identidad";
import { FichaContacto } from "./ficha-contacto";
import { FichaMaterias } from "./ficha-materias";
import { FichaHorarios } from "./ficha-horarios";
import { EditarProfesorForm } from "./editar-profesor-form";

/**
 * Ficha del profesor: detalle en modo consulta (HU-D-05 criterio 3) y modo
 * edición de identidad y contacto (HU-D-06) sobre la misma ruta, con
 * `?modo=edicion` (ver `@/lib/modo-edicion`).
 *
 * Permiso: `profesores:leer` gatea el acceso. El botón «Editar» y los
 * accesos de HU-D-02/03/04 solo se muestran con `profesores:editar`; el modo
 * edición lo exige para montar el formulario, y la Server Action lo vuelve
 * a verificar al guardar.
 *
 * `?pagina=` es la página del listado desde la que se abrió: el breadcrumb
 * vuelve a esa misma página, también al pasar por el modo edición.
 */
export default async function ProfesorDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPermiso("profesores:leer");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const edicion = esModoEdicion(query);
  if (edicion) {
    await exigirPermiso("profesores:editar");
  }

  const profesor = await obtenerDetalleProfesor(id);
  if (!profesor) {
    notFound();
  }

  const paginaListado = Number(query.pagina);
  const pagina = Number.isSafeInteger(paginaListado) && paginaListado > 1 ? paginaListado : null;
  const hrefListado = pagina ? `/profesores?pagina=${pagina}` : "/profesores";
  const conPagina = (ruta: string) => (pagina ? `${ruta}${ruta.includes("?") ? "&" : "?"}pagina=${pagina}` : ruta);
  const rutaFicha = `/profesores/${profesor.id}`;

  const breadcrumb = (
    <Breadcrumb
      tramos={[
        { etiqueta: "Profesores", href: hrefListado },
        { etiqueta: formatearApellidoNombre(profesor.apellido, profesor.nombre) },
      ]}
    />
  );

  if (edicion) {
    const [dniLongitudMin, dniLongitudMax] = await Promise.all([
      getParametroNumerico("dni_longitud_min", 7),
      getParametroNumerico("dni_longitud_max", 8),
    ]);
    // Mismo límite de mayoría de edad que el alta (nuevo/page.tsx).
    const fechaMaximaNacimiento = fechaUTCHaceAnios(18).toISOString().slice(0, 10);

    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-5 p-6">
        {breadcrumb}
        {/* key: al recargar tras un conflicto de edición llega una `version`
            nueva y el formulario se remonta con los datos actuales. */}
        <EditarProfesorForm
          key={profesor.version}
          profesor={profesor}
          dniLongitudMin={dniLongitudMin}
          dniLongitudMax={dniLongitudMax}
          fechaMaximaNacimiento={fechaMaximaNacimiento}
          rutaConsulta={conPagina(rutaFicha)}
          rutaTrasGuardar={conPagina(rutaTrasGuardar(rutaFicha))}
        />
      </div>
    );
  }

  const puedeEditar = await tienePermiso("profesores:editar");

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-5 p-6">
      {breadcrumb}

      {fueActualizada(query) && (
        <p role="status" className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          Profesor actualizado correctamente
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <FichaEncabezado
          nombre={profesor.nombre}
          apellido={profesor.apellido}
          dni={profesor.dni}
          activo={profesor.activo}
        />
        {puedeEditar && (
          <Link
            href={conPagina(rutaModoEdicion(rutaFicha))}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Editar
          </Link>
        )}
      </div>
      <FichaIdentidad profesor={profesor} />
      <FichaContacto
        profesorId={profesor.id}
        telefono={profesor.telefono}
        email={profesor.email}
        puedeEditar={puedeEditar}
      />
      <FichaMaterias
        profesorId={profesor.id}
        activo={profesor.activo}
        materias={profesor.materias}
        puedeEditar={puedeEditar}
      />
      <FichaHorarios
        profesorId={profesor.id}
        activo={profesor.activo}
        horarios={profesor.horarios}
        puedeEditar={puedeEditar}
      />
    </div>
  );
}
