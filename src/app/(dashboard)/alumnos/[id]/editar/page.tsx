import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerDetalleAlumno, listarFormasPagoActivas } from "@/server/alumnos/alumno.service";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico } from "@/server/shared/parametros";
import { EditarAlumnoForm } from "./editar-alumno-form";

/**
 * Formulario único de edición del alumno (HU-B-06): identidad, contacto y
 * forma de pago preferida en un solo `<form>`/submit (Nota de alcance §1
 * punto 2 de la task — evita que dos ediciones parciales compitan por el
 * mismo `version`). El chequeo de permiso de acá evita montar el formulario
 * para un rol sin `alumnos:editar`; el rechazo que realmente importa lo
 * repite `modificarAlumno()` en `src/server/alumnos/actions.ts` (mismo
 * criterio que `contacto/page.tsx` y `forma-pago/page.tsx`).
 */
export default async function EditarAlumnoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await verificarPermiso("alumnos:editar");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/alumnos");
    }
    throw error;
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

  const [formasPagoActivas, dniLongitudMin, dniLongitudMax] = await Promise.all([
    listarFormasPagoActivas(),
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-xl space-y-5 p-6">
      <Link
        href={`/alumnos/${alumno.id}`}
        className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Volver a la ficha
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Modificar datos del alumno</h1>
        <p className="text-sm text-muted-foreground">
          {alumno.apellido}, {alumno.nombre} · DNI {alumno.dni}
        </p>
      </div>
      <EditarAlumnoForm
        alumno={alumno}
        formasPagoActivas={formasPagoActivas}
        dniLongitudMin={dniLongitudMin}
        dniLongitudMax={dniLongitudMax}
      />
    </div>
  );
}
