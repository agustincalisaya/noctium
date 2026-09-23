import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerDetalleAlumno } from "@/server/alumnos/alumno.service";
import { ServiceError } from "@/server/shared/service-error";
import { FichaEncabezado } from "./ficha-encabezado";
import { FichaContacto } from "./ficha-contacto";
import { FichaAltaPago } from "./ficha-alta-pago";

/**
 * Ficha del alumno. Muestra identidad, contacto (HU-B-02), fecha de alta y
 * forma de pago preferida (HU-B-04); HU-B-06 agrega edición de identidad
 * con el mismo `FichaSeccion`.
 *
 * Permiso: `alumnos:leer` (HU-B-04) gatea el acceso a la ficha; `puedeEditar`
 * se deriva de un segundo `verificarPermiso("alumnos:editar")`, tal como
 * quedó anotado en este mismo archivo desde HU-B-02. Hoy ambos permisos son
 * exclusivos de MESA_ENTRADA, así que `puedeEditar` es siempre igual al rol
 * autenticado — pero se resuelve así, no como atajo, para no romper el
 * patrón si más adelante otro rol lee sin poder editar.
 */
export default async function AlumnoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { id } = await params;
  const { pagina } = await searchParams;

  try {
    await verificarPermiso("alumnos:leer");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/alumnos");
    }
    throw error;
  }

  let puedeEditar = true;
  try {
    await verificarPermiso("alumnos:editar");
  } catch (error) {
    if (error instanceof PermisoError) {
      puedeEditar = false;
    } else {
      throw error;
    }
  }

  let alumno;
  try {
    alumno = await obtenerDetalleAlumno(id);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "ALUMNO_NO_ENCONTRADO") {
      notFound();
    }
    throw error;
  }

  const hrefListado = pagina ? `/alumnos?pagina=${pagina}` : "/alumnos";

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-5 p-6">
      <Link
        href={hrefListado}
        className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Volver al listado
      </Link>
      <FichaEncabezado
        nombre={alumno.nombre}
        apellido={alumno.apellido}
        dni={alumno.dni}
        activo={alumno.is_active}
      />
      <FichaContacto
        alumnoId={alumno.id}
        telefono={alumno.telefono}
        email={alumno.email}
        puedeEditar={puedeEditar}
      />
      <FichaAltaPago fechaAlta={alumno.created_at} formaPagoPreferida={alumno.forma_pago_preferida} />
    </div>
  );
}
