import type { DiaSemana } from "@prisma/client";

/**
 * Helpers puros de horario de atención (HU-D-04, `spec_modulo_D.md` §2.4 y
 * §3.4). Sin acceso a base ni a Prisma como valor: los importan tanto el
 * schema Zod (que también corre en el cliente) como los servicios.
 *
 * Formato de horas: string "HH:mm" en 24 h para la UI y los contratos;
 * internamente se compara en minutos desde las 00:00 (`horaAMinutos`).
 */

// Mismo criterio que GENERO_VALORES en profesor.schema.ts: array literal
// (no el enum de @prisma/client como valor) para poder importarse desde un
// Client Component. El orden es el de la semana, lunes primero.
export const DIAS_SEMANA = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
  "DOMINGO",
] as const satisfies DiaSemana[];

export type DiaSemanaValor = (typeof DIAS_SEMANA)[number];

export const ETIQUETA_DIA: Record<DiaSemanaValor, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

/** Índice de `Date.getUTCDay()` (0 = domingo) -> día de la semana. */
const DIA_POR_INDICE_UTC: DiaSemanaValor[] = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

/** Día de la semana de una fecha calendario (`@db.Date`, medianoche UTC). */
export function diaSemanaDeFecha(fecha: Date): DiaSemanaValor {
  return DIA_POR_INDICE_UTC[fecha.getUTCDay()]!;
}

export const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "10:30" -> 630. No valida el formato: usar después de `HORA_REGEX`. */
export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h! * 60 + m!;
}

/** 630 -> "10:30". */
export function minutosAHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** Intervalo semiabierto [inicio, fin) en minutos desde las 00:00. */
export type IntervaloMinutos = { inicio: number; fin: number };

/**
 * Regla única de superposición del proyecto (`spec_modulo_D.md` §3.4):
 * `a.inicio < b.fin && b.inicio < a.fin`. Los contiguos (10:00–12:00 y
 * 12:00–14:00) NO se superponen.
 */
export function intervalosSeSuperponen(a: IntervaloMinutos, b: IntervaloMinutos): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/** `interior` cae completo dentro de `exterior` (bordes incluidos). */
export function intervaloContenido(interior: IntervaloMinutos, exterior: IntervaloMinutos): boolean {
  return exterior.inicio <= interior.inicio && interior.fin <= exterior.fin;
}

/** Parámetros operativos del centro que acotan un horario de atención. */
export type ParametrosHorarioOperativo = {
  diasOperativos: DiaSemanaValor[];
  /** "HH:mm" */
  apertura: string;
  /** "HH:mm" */
  cierre: string;
  granularidadMinutos: number;
};

/**
 * Horas "HH:mm" entre `desde` y `hasta` (ambas incluidas) en pasos de
 * `granularidadMinutos` — opciones de los selects de hora.
 */
export function generarHoras(desde: string, hasta: string, granularidadMinutos: number): string[] {
  const horas: string[] = [];
  for (let m = horaAMinutos(desde); m <= horaAMinutos(hasta); m += granularidadMinutos) {
    horas.push(minutosAHora(m));
  }
  return horas;
}

export type CampoHorario = "diaSemana" | "horaInicio" | "horaFin";

export type ErrorIntervaloHorario = {
  codigo: "DIA_NO_OPERATIVO" | "HORA_NO_GRANULAR" | "HORARIO_INVERTIDO" | "FUERA_DE_HORARIO_OPERATIVO";
  campo: CampoHorario;
  mensaje: string;
};

/**
 * Reglas de HU-D-04 que no dependen de otros horarios (criterios 1 y 3):
 * día operativo, granularidad, inicio < fin y franja operativa. Devuelve el
 * primer error o `null`. La usan el schema Zod (cliente y servidor) y el
 * servicio, para que las tres capas apliquen exactamente la misma regla.
 * Las horas llegan ya validadas con `HORA_REGEX`.
 */
export function validarIntervaloHorario(
  intervalo: { diaSemana: DiaSemanaValor; horaInicio: string; horaFin: string },
  parametros: ParametrosHorarioOperativo,
): ErrorIntervaloHorario | null {
  const { apertura, cierre, granularidadMinutos } = parametros;

  if (!parametros.diasOperativos.includes(intervalo.diaSemana)) {
    return {
      codigo: "DIA_NO_OPERATIVO",
      campo: "diaSemana",
      mensaje: "El centro no atiende ese día",
    };
  }

  const inicio = horaAMinutos(intervalo.horaInicio);
  const fin = horaAMinutos(intervalo.horaFin);
  const mensajeGranularidad = `La hora debe ajustarse a bloques de ${granularidadMinutos} minutos`;
  if (inicio % granularidadMinutos !== 0) {
    return { codigo: "HORA_NO_GRANULAR", campo: "horaInicio", mensaje: mensajeGranularidad };
  }
  if (fin % granularidadMinutos !== 0) {
    return { codigo: "HORA_NO_GRANULAR", campo: "horaFin", mensaje: mensajeGranularidad };
  }

  if (inicio >= fin) {
    return {
      codigo: "HORARIO_INVERTIDO",
      campo: "horaFin",
      mensaje: "La hora de inicio debe ser anterior a la hora de fin",
    };
  }

  const mensajeFranja = `El horario debe estar dentro del horario operativo del centro (${apertura} a ${cierre})`;
  if (inicio < horaAMinutos(apertura) || inicio >= horaAMinutos(cierre)) {
    return { codigo: "FUERA_DE_HORARIO_OPERATIVO", campo: "horaInicio", mensaje: mensajeFranja };
  }
  if (fin > horaAMinutos(cierre)) {
    return { codigo: "FUERA_DE_HORARIO_OPERATIVO", campo: "horaFin", mensaje: mensajeFranja };
  }

  return null;
}

/** Texto del criterio 5: "El intervalo se superpone con Lunes 10:00–12:00". */
export function mensajeSuperposicion(diaSemana: DiaSemanaValor, horaInicio: string, horaFin: string): string {
  return `El intervalo se superpone con ${ETIQUETA_DIA[diaSemana]} ${horaInicio}–${horaFin}`;
}

/**
 * Agrupa intervalos por día (HU-D-04 c6, HU-D-05 criterio 3): días en el
 * orden de la semana, solo los que tienen al menos un intervalo, y cada día
 * ordenado por hora de inicio. Las horas "HH:mm" con cero a la izquierda
 * ordenan bien como texto. No combina contiguos: se muestran tal como están
 * registrados.
 */
export function agruparHorariosPorDia<T extends { diaSemana: DiaSemanaValor; horaInicio: string }>(
  horarios: readonly T[],
): { dia: DiaSemanaValor; etiqueta: string; intervalos: T[] }[] {
  return DIAS_SEMANA.map((dia) => ({
    dia,
    etiqueta: ETIQUETA_DIA[dia],
    intervalos: horarios
      .filter((horario) => horario.diaSemana === dia)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
  })).filter(({ intervalos }) => intervalos.length > 0);
}

/** Intervalos de un día en texto: "10:00–12:00, 14:00–16:00" (24 h). */
export function formatearIntervalos(intervalos: readonly { horaInicio: string; horaFin: string }[]): string {
  return intervalos.map(({ horaInicio, horaFin }) => `${horaInicio}–${horaFin}`).join(", ");
}
