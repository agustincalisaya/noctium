import { LinkProtegido } from "@/components/sesion/link-protegido";
import { notFound, redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerFichaProfesor } from "@/server/profesores/profesor.service";
import { ContactoProfesorForm } from "./contacto-profesor-form";

/**
 * Registro de contacto del profesor (HU-D-02). El chequeo de permiso de acá
 * evita montar el formulario para un rol sin `profesores:editar`; el rechazo
 * que realmente importa lo repite `actualizarContactoProfesor()` en
 * `../../actions.ts` (mismo criterio que `nuevo/page.tsx` de HU-D-01).
 */
export default async function ContactoProfesorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    <div className="mx-auto max-w-xl space-y-5 p-6">
      <LinkProtegido
        href={`/profesores/${profesor.id}`}
        className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Volver a la ficha
      </LinkProtegido>
      <div>
        <h1 className="text-2xl font-semibold">Datos de contacto</h1>
        <p className="text-sm text-muted-foreground">
          {profesor.apellido}, {profesor.nombre} · DNI {profesor.dni}
        </p>
      </div>
      <ContactoProfesorForm
        profesorId={profesor.id}
        telefonoActual={profesor.telefono}
        emailActual={profesor.email}
      />
    </div>
  );
}
