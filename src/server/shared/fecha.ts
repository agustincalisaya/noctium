import { z } from "zod";

const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Valida un string `YYYY-MM-DD` (formato nativo de `<input type="date">`)
 * como fecha de calendario real. A diferencia de `z.coerce.date()` sobre un
 * `Date` nativo de JS, que "corrige" silenciosamente un 31/02 reinterpretándolo
 * como 03/03, este schema lo RECHAZA explícitamente — reconstruye la fecha con
 * `Date.UTC()` y verifica que año/mes/día no hayan "rebalanceado" al pasar por
 * el constructor (mismo mecanismo para día 32, mes 13 o día 0).
 *
 * Devuelve un `Date` en UTC medianoche (`Date.UTC(y, m-1, d)`), mismo criterio
 * que ya usa `prisma/seed.ts` para poblar columnas `@db.Date` — evita que una
 * construcción en horario local desplace el día en timezones detrás de UTC.
 *
 * Sin acoplamiento a ninguna entidad: nombre y ubicación genéricos para que
 * cualquier módulo que reciba una fecha de calendario (Profesor, Alumno,
 * Turno) la reutilice sin duplicarla.
 */
export const fechaCalendarioValidaSchema = z
  .string()
  .trim()
  .regex(FORMATO_FECHA, "Ingresá una fecha válida")
  .transform((valor, ctx) => {
    const match = valor.match(FORMATO_FECHA)!;
    const anio = Number(match[1]);
    const mes = Number(match[2]);
    const dia = Number(match[3]);

    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    const esFechaReal =
      fecha.getUTCFullYear() === anio &&
      fecha.getUTCMonth() === mes - 1 &&
      fecha.getUTCDate() === dia;

    if (!esFechaReal) {
      ctx.addIssue({ code: "custom", message: "Ingresá una fecha válida" });
      return z.NEVER;
    }
    return fecha;
  });

/**
 * "Hoy" en UTC medianoche menos `anios` años calendario exactos — mismo
 * criterio UTC que `fechaCalendarioValidaSchema` (comparar calendario contra
 * calendario, no instante contra calendario). Pensada para límites de edad
 * mínima: una fecha de nacimiento `<=` al resultado tiene `anios` cumplidos.
 *
 * Caso borde: si hoy es 29/02 y el año destino no es bisiesto, `Date.UTC()`
 * rebalancearía a 01/03 y aceptaría a alguien que recién cumple al día
 * siguiente; se clampa al 28/02 (último día real de febrero).
 */
export function fechaUTCHaceAnios(anios: number, ahora: Date = new Date()): Date {
  const anio = ahora.getUTCFullYear() - anios;
  const mes = ahora.getUTCMonth();
  const fecha = new Date(Date.UTC(anio, mes, ahora.getUTCDate()));
  return fecha.getUTCMonth() === mes ? fecha : new Date(Date.UTC(anio, mes + 1, 0));
}
