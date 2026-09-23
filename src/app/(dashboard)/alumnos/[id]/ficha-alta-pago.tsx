import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FichaDatos, FichaSeccion } from "./ficha-seccion";

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Sección "Fecha de alta y forma de pago" de la ficha (HU-B-04 criterio 3,
 * HU-B-03 agrega el link de edición). `puedeEditar` oculta el acceso al
 * formulario para roles sin `alumnos:editar` — el servidor igual lo
 * rechaza si se invoca directamente, mismo criterio que `FichaContacto`.
 */
export function FichaAltaPago({
  alumnoId,
  fechaAlta,
  formaPagoPreferida,
  puedeEditar,
}: {
  alumnoId: string;
  fechaAlta: string;
  formaPagoPreferida: string | null;
  puedeEditar: boolean;
}) {
  return (
    <FichaSeccion
      titulo="Fecha de alta y forma de pago"
      accion={
        puedeEditar && (
          <Link
            href={`/alumnos/${alumnoId}/forma-pago`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Editar forma de pago
          </Link>
        )
      }
    >
      <FichaDatos
        datos={[
          ["Fecha de alta", formatearFecha(fechaAlta)],
          ["Forma de pago preferida", formaPagoPreferida ?? "Sin preferencia"],
        ]}
      />
    </FichaSeccion>
  );
}
