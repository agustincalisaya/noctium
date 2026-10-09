/**
 * Formatos del detalle de turno (HU-C-09, mockup pág. 5). Funciones puras,
 * sin React ni acceso a datos, compartidas por los subcomponentes de la vista.
 */

const ZONA = "America/Argentina/Buenos_Aires";

/** "2026-10-06" → "06/10/2026". */
export function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** "2026-10-06" → "06/10" (migas de pan). */
export function diaMes(fecha: string): string {
  return fechaCorta(fecha).slice(0, 5);
}

/** "2026-10-06" → "Mar 06/10" (resumen del modal de cancelación, mockup pág. 8). Fecha de calendario: en UTC. */
export function diaAbreviadoYFecha(fecha: string): string {
  const dia = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][new Date(`${fecha}T00:00:00.000Z`).getUTCDay()];
  return `${dia} ${diaMes(fecha)}`;
}

/** "2026-10-06" → "Martes 6 de octubre de 2026". La fecha es de calendario: se formatea en UTC para no correr el día. */
export function fechaLarga(fecha: string): string {
  const texto = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${fecha}T00:00:00.000Z`))
    .replace(",", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Instante ISO → "dd/mm/aaaa" en la zona del centro. */
export function fechaDeInstante(instante: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(instante));
}

/** Instante ISO → «dd/mm/aaaa, hh:mm» en la zona del centro. */
export function fechaHoraDeInstante(instante: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(instante));
}

/** Múltiplo de 60 → «1 hora» / «N horas»; si no, «N min» (P2, SM 30/09). */
export function duracion(minutos: number): string {
  if (minutos > 0 && minutos % 60 === 0) {
    const horas = minutos / 60;
    return horas === 1 ? "1 hora" : `${horas} horas`;
  }
  return `${minutos} min`;
}

/** Cupo máximo: «6 alumnos», «1 alumno». */
export function cupo(cantidad: number): string {
  return cantidad === 1 ? "1 alumno" : `${cantidad} alumnos`;
}

/**
 * "Pérez, Juan" → "JP": inicial del primer nombre y de la última palabra del
 * apellido, a partir del texto «Apellido, Nombre» que ya envía la API. Solo
 * arma el avatar; el nombre visible se muestra siempre como «Apellido, Nombre».
 */
export function iniciales(apellidoNombre: string): string {
  const coma = apellidoNombre.indexOf(", ");
  const nombreApellido = coma === -1 ? apellidoNombre : `${apellidoNombre.slice(coma + 2)} ${apellidoNombre.slice(0, coma)}`;
  return nombreApellido
    .split(/\s+/)
    .filter(Boolean)
    .filter((_, i, partes) => i === 0 || i === partes.length - 1)
    .map((parte) => parte.charAt(0).toLocaleUpperCase("es-AR"))
    .join("");
}

/**
 * "12000.00" → "$ 12.000"; "15000.50" → "$ 15.000,50". Trabaja sobre el texto
 * decimal de la API, sin pasar por coma flotante.
 */
export function monto(valor: string): string {
  const [entero = "0", decimales = ""] = valor.split(".");
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const centavos = decimales.padEnd(2, "0").slice(0, 2);
  return centavos === "00" ? `$ ${miles}` : `$ ${miles},${centavos}`;
}
