import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import {
  obtenerFichaProfesor,
  obtenerHorariosDelProfesor,
  obtenerMateriasDelProfesor,
} from "@/server/profesores/profesor.service";
import { FichaEncabezado } from "./ficha-encabezado";
import { FichaContacto } from "./ficha-contacto";
import { FichaMaterias } from "./ficha-materias";
import { FichaHorarios } from "./ficha-horarios";

/**
 * Ficha del profesor. Hoy muestra identidad resumida + contacto (HU-D-02),
 * materias asociadas (HU-D-03) y el resumen semanal del horario de atención
 * (HU-D-04); HU-D-05 agrega lo suyo con el mismo `FichaSeccion`.
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
  const [materias, horarios] = await Promise.all([
    obtenerMateriasDelProfesor(profesor.id),
    obtenerHorariosDelProfesor(profesor.id),
  ]);

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
      <FichaMaterias
        profesorId={profesor.id}
        activo={profesor.activo}
        materias={materias}
        puedeEditar
      />
      <FichaHorarios
        profesorId={profesor.id}
        activo={profesor.activo}
        horarios={horarios}
        puedeEditar
      />
    </div>
  );
}
