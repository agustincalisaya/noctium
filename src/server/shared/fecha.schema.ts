import { z } from "zod";

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida una fecha de calendario en formato `AAAA-MM-DD` de forma estricta:
 * a diferencia de `z.coerce.date()`, que "corrige" un `Date` nativo de JS
 * (`31/02` se reinterpreta como `03/03`), acá se reconstruye la fecha con
 * `Date.UTC` y se comparan año/mes/día contra lo que realmente vino en el
 * string — si no coinciden, la fecha no existe en el calendario y se
 * rechaza en vez de reinterpretarse. Sin `date-fns` (no es dependencia del
 * proyecto): alcanza con aritmética nativa. Reutilizable por cualquier
 * módulo que reciba fechas de calendario (Alumno, Profesor, Turno).
 */
export const fechaCalendarioValidaSchema = z
  .string()
  .trim()
  .regex(FORMATO_FECHA, "La fecha debe tener el formato AAAA-MM-DD")
  .transform((valor, ctx) => {
    const [anio, mes, dia] = valor.split("-").map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));

    if (
      fecha.getUTCFullYear() !== anio ||
      fecha.getUTCMonth() !== mes - 1 ||
      fecha.getUTCDate() !== dia
    ) {
      ctx.addIssue("La fecha ingresada no existe en el calendario");
      return z.NEVER;
    }

    return fecha;
  });
export type FechaCalendarioValida = z.infer<typeof fechaCalendarioValidaSchema>;
