import type { DetalleProfesor } from "@/types/profesor.types";
import { FichaDatos, FichaSeccion } from "./ficha-seccion";

const ETIQUETA_GENERO: Record<NonNullable<DetalleProfesor["genero"]>, string> = {
  MASCULINO: "Masculino",
  FEMENINO: "Femenino",
  OTRO: "Otro",
  PREFIERO_NO_INDICARLO: "Prefiere no indicarlo",
};

/** Fecha calendario `@db.Date` (medianoche UTC): se formatea en UTC para no correr el día. */
function formatearFechaCalendario(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

/** Instante (fecha de alta): se formatea en la hora de Argentina. */
function formatearFechaAlta(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

/**
 * Sección "Datos personales" del detalle (HU-D-05 criterio 3): identidad,
 * estado y fecha de alta, en modo consulta.
 */
export function FichaIdentidad({ profesor }: { profesor: DetalleProfesor }) {
  return (
    <FichaSeccion titulo="Datos personales">
      <FichaDatos
        datos={[
          ["Apellido", profesor.apellido],
          ["Nombre", profesor.nombre],
          ["DNI", profesor.dni],
          ["Fecha de nacimiento", formatearFechaCalendario(profesor.fechaNacimiento)],
          ["Género", profesor.genero ? ETIQUETA_GENERO[profesor.genero] : null],
          ["Estado", profesor.activo ? "Activo" : "Inactivo"],
          ["Fecha de alta", formatearFechaAlta(profesor.fechaAlta)],
        ]}
      />
    </FichaSeccion>
  );
}
