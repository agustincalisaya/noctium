/**
 * Fechas de dominio en la zona del centro (PR-0.md §2.2). Es una constante de
 * este módulo, no una variable de entorno: no depende de la zona del proceso
 * (el CI corre con TZ=UTC justamente para detectarlo).
 *
 * America/Argentina/Buenos_Aires es UTC−3 fijo, sin horario de verano.
 */
export const ZONA_CENTRO = "America/Argentina/Buenos_Aires";
const DESFASE_CENTRO_MS = -3 * 60 * 60 * 1000;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Inicio de una clase como instante: `fechaTurno` (@db.Date, medianoche UTC)
 * más `horaInicioTurno` (@db.Time, 1970-01-01 en UTC), leídos en la zona del
 * centro (offset −03:00). Único helper para armar el inicio de una clase.
 */
export function inicioDeTurno(turno: { fechaTurno: Date; horaInicioTurno: Date }): Date {
  const { fechaTurno: fecha, horaInicioTurno: hora } = turno;
  const localComoUtc = Date.UTC(
    fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(),
    hora.getUTCHours(), hora.getUTCMinutes(), hora.getUTCSeconds(),
  );
  return new Date(localComoUtc - DESFASE_CENTRO_MS);
}

/** Fin de una clase: su inicio más la duración. */
export function finDeTurno(turno: { fechaTurno: Date; horaInicioTurno: Date; duracionMinutosTurno: number }): Date {
  return new Date(inicioDeTurno(turno).getTime() + turno.duracionMinutosTurno * 60_000);
}

/** Día calendario del centro de `momento`, como valor @db.Date (medianoche UTC). */
export function fechaCentro(momento: Date): Date {
  const local = new Date(momento.getTime() + DESFASE_CENTRO_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** Instante en que empieza, en el centro, el día de `momento` (00:00 −03:00). */
export function inicioDelDiaCentro(momento: Date): Date {
  return new Date(fechaCentro(momento).getTime() - DESFASE_CENTRO_MS);
}

/** Instante en que termina, en el centro, el día de `momento` (exclusivo: 00:00 del día siguiente). */
export function finDelDiaCentro(momento: Date): Date {
  return new Date(inicioDelDiaCentro(momento).getTime() + UN_DIA_MS);
}

/** Instante de `fecha` (AAAA-MM-DD) a la hora `hhmm` del centro. */
export function instanteCentro(fecha: string, hhmm = "00:00"): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [hora, minuto] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, hora, minuto) - DESFASE_CENTRO_MS);
}
