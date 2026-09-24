import { LinkProtegido } from "@/components/sesion/link-protegido";
import { notFound, redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerDetalleAlumno, listarFormasPagoActivas } from "@/server/alumnos/alumno.service";
import { ServiceError } from "@/server/shared/service-error";
import { FormaPagoForm } from "./forma-pago-form";

/**
 * Edición de la forma de pago preferida del alumno (HU-B-03). El chequeo de
 * permiso de acá evita montar el formulario para un rol sin
 * `alumnos:editar`; el rechazo que realmente importa lo repite
 * `actualizarFormaPagoPreferida()` en `src/server/alumnos/actions.ts`
 * (mismo criterio que `contacto/page.tsx`, HU-B-02).
 */
export default async function FormaPagoAlumnoPage({
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
  const formasPagoActivas = await listarFormasPagoActivas();

  return (
    <div className="mx-auto max-w-xl space-y-5 p-6">
      <LinkProtegido
        href={`/alumnos/${alumno.id}`}
        className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Volver a la ficha
      </LinkProtegido>
      <div>
        <h1 className="text-2xl font-semibold">Forma de pago preferida</h1>
        <p className="text-sm text-muted-foreground">
          {alumno.apellido}, {alumno.nombre} · DNI {alumno.dni}
        </p>
      </div>
      <FormaPagoForm
        alumnoId={alumno.id}
        formasPagoActivas={formasPagoActivas}
        formaPagoIdActual={alumno.forma_pago_preferida_id}
      />
    </div>
  );
}
