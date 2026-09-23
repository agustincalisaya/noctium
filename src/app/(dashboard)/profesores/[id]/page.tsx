import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerFichaProfesor } from "@/server/profesores/profesor.service";
import { FichaEncabezado } from "./ficha-encabezado";
import { FichaContacto } from "./ficha-contacto";

/**
 * Ficha del profesor. Hoy muestra identidad resumida + contacto (HU-D-02);
 * HU-D-03/04/05 agregan sus secciones (materias, horarios) con el mismo
 * `FichaSeccion`.
 *
 * Permiso: `profesores:leer` todavía no existe en `RolPermiso` (lo agrega
 * HU-D-05, que es la dueña del detalle); mientras tanto la ficha exige
 * `profesores:editar`, el único permiso que hoy tiene sentido sobre una
 * ficha existente. Cuando exista `profesores:leer`, cambiar el chequeo de
 * acá y derivar `puedeEditar` de un segundo `verificarPermiso`.
 */
export default async function ProfesorDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await verificarPermiso("profesores:editar");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/profesores");
    }
    throw error;
  }

  const profesor = await obtenerFichaProfesor(id);
  if (!profesor) {
    notFound();
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-5 p-6">
      <Link
        href="/profesores"
        className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Volver al listado
      </Link>
      <FichaEncabezado
        nombre={profesor.nombre}
        apellido={profesor.apellido}
        dni={profesor.dni}
        activo={profesor.activo}
      />
      <FichaContacto
        profesorId={profesor.id}
        telefono={profesor.telefono}
        email={profesor.email}
        puedeEditar
      />
    </div>
  );
}
