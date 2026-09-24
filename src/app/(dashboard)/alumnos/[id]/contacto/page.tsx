import { LinkProtegido } from "@/components/sesion/link-protegido";
import { notFound, redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerFichaAlumno } from "@/server/alumnos/alumno.service";
import { ContactoAlumnoForm } from "./contacto-alumno-form";

/**
 * Registro de contacto del alumno (HU-B-02). El chequeo de permiso de acá
 * evita montar el formulario para un rol sin `alumnos:editar`; el rechazo
 * que realmente importa lo repite `actualizarContactoAlumno()` en
 * `src/server/alumnos/actions.ts` (mismo criterio que
 * `profesores/[id]/contacto/page.tsx` de HU-D-02).
 */
export default async function ContactoAlumnoPage({
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

  const alumno = await obtenerFichaAlumno(id);
  if (!alumno) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-6">
      <LinkProtegido
        href={`/alumnos/${alumno.id}`}
        className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Volver a la ficha
      </LinkProtegido>
      <div>
        <h1 className="text-2xl font-semibold">Datos de contacto</h1>
        <p className="text-sm text-muted-foreground">
          {alumno.apellido}, {alumno.nombre} · DNI {alumno.dni}
        </p>
      </div>
      <ContactoAlumnoForm
        alumnoId={alumno.id}
        telefonoActual={alumno.telefono}
        emailActual={alumno.email}
      />
    </div>
  );
}
