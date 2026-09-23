import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerFichaAlumno } from "@/server/alumnos/alumno.service";
import { FichaEncabezado } from "./ficha-encabezado";
import { FichaContacto } from "./ficha-contacto";

/**
 * Ficha del alumno. Hoy muestra identidad resumida + contacto (HU-B-02);
 * HU-B-03/06 agregan sus secciones (forma de pago, edición de identidad)
 * con el mismo `FichaSeccion`.
 *
 * Permiso: `alumnos:leer` todavía no existe en `RolPermiso` (mismo caso que
 * `profesores:leer`, ver `profesores/[id]/page.tsx` de HU-D-02); mientras
 * tanto la ficha exige `alumnos:editar`, el único permiso que hoy tiene
 * sentido sobre una ficha existente. Cuando exista `alumnos:leer`, cambiar
 * el chequeo de acá y derivar `puedeEditar` de un segundo `verificarPermiso`.
 */
export default async function AlumnoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await verificarPermiso("alumnos:editar");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/alumnos");
    }
    throw error;
  }

  const alumno = await obtenerFichaAlumno(id);
  if (!alumno) {
    notFound();
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-5 p-6">
      <Link
        href="/alumnos"
        className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Volver al listado
      </Link>
      <FichaEncabezado
        nombre={alumno.nombre}
        apellido={alumno.apellido}
        dni={alumno.dni}
        activo={alumno.activo}
      />
      <FichaContacto
        alumnoId={alumno.id}
        telefono={alumno.telefono}
        email={alumno.email}
        puedeEditar
      />
    </div>
  );
}
