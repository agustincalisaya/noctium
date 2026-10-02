import { z } from "zod";

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const mesSchema = z.string().regex(MES_REGEX, "Formato de mes inválido (AAAA-MM)");

/** Mes calendario actual del centro, no necesariamente el mes UTC del servidor. */
export function mesActualBuenosAires(fecha = new Date()): string {
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(fecha);
  const anio = partes.find((parte) => parte.type === "year")?.value;
  const mes = partes.find((parte) => parte.type === "month")?.value;
  if (!anio || !mes) throw new Error("No se pudo resolver el mes actual del centro");
  return `${anio}-${mes}`;
}

/** Fecha calendario de hoy en el centro (AAAA-MM-DD): tope de los turnos ya dictados (spec_modulo_H.md §3.6). */
export function fechaActualBuenosAires(fecha = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

export function desplazarMes(mes: string, cantidad: number): string {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio!, numeroMes! - 1 + cantidad, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function cantidadMesesInclusivos(desde: string, hasta: string): number {
  const [anioDesde, mesDesde] = desde.split("-").map(Number);
  const [anioHasta, mesHasta] = hasta.split("-").map(Number);
  return (anioHasta! - anioDesde!) * 12 + (mesHasta! - mesDesde!) + 1;
}

export function listarMeses(desde: string, hasta: string): string[] {
  const total = cantidadMesesInclusivos(desde, hasta);
  if (total < 1) return [];
  return Array.from({ length: total }, (_, indice) => desplazarMes(desde, indice));
}

export function resolverRangoIndicadores(query: RangoIndicadoresInput, fecha = new Date()) {
  const actual = mesActualBuenosAires(fecha);
  const hasta = query.hasta ?? actual;
  const desde = query.desde ?? desplazarMes(hasta, -5);
  const meses = listarMeses(desde, hasta);
  return { desde, hasta, meses };
}

export const RangoIndicadoresQuerySchema = z.object({
  desde: mesSchema.optional(),
  hasta: mesSchema.optional(),
}).superRefine((query, contexto) => {
  if ((query.desde && !MES_REGEX.test(query.desde)) || (query.hasta && !MES_REGEX.test(query.hasta))) return;

  const actual = mesActualBuenosAires();
  if (!query.hasta && query.desde && query.desde > actual) {
    contexto.addIssue({
      code: "custom",
      message: "El mes desde no puede ser posterior al mes actual",
      path: ["desde"],
    });
    return;
  }

  const rango = resolverRangoIndicadores(query);
  if (rango.desde > rango.hasta) {
    contexto.addIssue({
      code: "custom",
      message: "El mes desde no puede ser posterior al mes hasta",
      path: ["desde"],
    });
  } else if (rango.meses.length > 24) {
    contexto.addIssue({
      code: "custom",
      message: "El rango máximo es de 24 meses",
      path: ["hasta"],
    });
  }
});

export type RangoIndicadoresInput = z.infer<typeof RangoIndicadoresQuerySchema>;
