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
 * Sección "Fecha de alta y forma de pago" de la ficha (HU-B-04 criterio 3).
 * Solo muestra la forma de pago preferida ya existente — asociarla/
 * cambiarla es HU-B-03, fuera de alcance acá (sin `accion` de edición, a
 * diferencia de `FichaContacto`).
 */
export function FichaAltaPago({
  fechaAlta,
  formaPagoPreferida,
}: {
  fechaAlta: string;
  formaPagoPreferida: string | null;
}) {
  return (
    <FichaSeccion titulo="Fecha de alta y forma de pago">
      <FichaDatos
        datos={[
          ["Fecha de alta", formatearFecha(fechaAlta)],
          ["Forma de pago preferida", formaPagoPreferida ?? "Sin preferencia"],
        ]}
      />
    </FichaSeccion>
  );
}
