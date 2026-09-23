import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FichaDatos, FichaSeccion } from "./ficha-seccion";

/**
 * Sección "Datos de contacto" de la ficha (HU-D-02 c1: el contacto se
 * registra desde la ficha del profesor). `puedeEditar` oculta el acceso al
 * formulario para roles sin `profesores:editar` — el servidor igual lo
 * rechaza si se invoca directamente.
 */
export function FichaContacto({
  profesorId,
  telefono,
  email,
  puedeEditar,
}: {
  profesorId: string;
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
            href={`/profesores/${profesorId}/contacto`}
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
