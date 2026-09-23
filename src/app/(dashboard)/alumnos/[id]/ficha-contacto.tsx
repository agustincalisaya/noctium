import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FichaDatos, FichaSeccion } from "./ficha-seccion";

/**
 * Sección "Datos de contacto" de la ficha (HU-B-02 c1: el contacto se
 * registra desde la ficha del alumno). `puedeEditar` oculta el acceso al
 * formulario para roles sin `alumnos:editar` — el servidor igual lo
 * rechaza si se invoca directamente.
 */
export function FichaContacto({
  alumnoId,
  telefono,
  email,
  puedeEditar,
}: {
  alumnoId: string;
  telefono: string | null;
  email: string | null;
  puedeEditar: boolean;
}) {
  const tieneContacto = telefono !== null || email !== null;
  return (
    <FichaSeccion
      titulo="Datos de contacto"
      accion={
        puedeEditar && (
          <Link
            href={`/alumnos/${alumnoId}/contacto`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {tieneContacto ? "Editar contacto" : "Cargar contacto"}
          </Link>
        )
      }
    >
      <FichaDatos
        datos={[
          ["Teléfono", telefono],
          ["Email", email],
        ]}
      />
    </FichaSeccion>
  );
}
