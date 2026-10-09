import { ErrorDeDominio } from "@/server/shared/error-dominio";

/**
 * Precio de una clase en pesos (PR-0.md §2.4, HU-L-06): tarifa por hora ×
 * duración / 60. Lo usan HU-C-20, C-22, C-24 e I-10, y `crearInscripcion`
 * lo congela en la inscripción. Con las duraciones permitidas (60, 120 y 180
 * minutos) el resultado siempre es entero; si alguna vez no lo fuera, falla
 * en vez de redondear.
 *
 * Sin tarifa lanza MATERIA_SIN_TARIFA (422): con el texto para el alumno o,
 * por defecto, el de mesa de entrada.
 */
export function precioClase(
  materia: { tarifaHora: number | null },
  duracionMin: number,
  opciones: { paraAlumno?: boolean } = {},
): number {
  if (materia.tarifaHora === null) {
    throw new ErrorDeDominio(opciones.paraAlumno ? "errores.inscripcion.materiaSinTarifa" : "errores.inscripcion.materiaSinTarifaCentro");
  }
  const precio = (materia.tarifaHora * duracionMin) / 60;
  if (!Number.isSafeInteger(precio) || precio <= 0) {
    throw new Error(`precioClase: el precio de ${materia.tarifaHora} por hora y ${duracionMin} minutos no es un entero positivo`);
  }
  return precio;
}
