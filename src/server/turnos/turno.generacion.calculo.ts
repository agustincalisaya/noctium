import { diaSemanaDeFecha, horaAMinutos, type DiaSemanaValor } from "@/lib/horario-atencion";
import { iniciosPosibles } from "./turno.disponibilidad";
import type { MotivoConflictoGeneracion } from "./turno.generacion.schema";

/** Suma meses de calendario y conserva el día, o el último del mes destino. */
export function sumarMesesCalendario(fecha: Date, meses: number): Date {
  const primerDiaDestino = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + meses, 1));
  const ultimoDiaDestino = new Date(Date.UTC(primerDiaDestino.getUTCFullYear(), primerDiaDestino.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(primerDiaDestino.getUTCFullYear(), primerDiaDestino.getUTCMonth(), Math.min(fecha.getUTCDate(), ultimoDiaDestino)));
}

export function validarEncajeEnFranja(
  franja: { hora_inicio: string; hora_fin: string },
  horaInicio: string,
  duracionMin: number,
  granularidadMin: number,
): boolean {
  return iniciosPosibles(
    { inicio: horaAMinutos(franja.hora_inicio), fin: horaAMinutos(franja.hora_fin) },
    duracionMin,
    granularidadMin,
  ).includes(horaAMinutos(horaInicio));
}

export function contarOcurrenciasDentroDelMaximo(cantidad: number, maximo: number): boolean {
  return cantidad <= maximo;
}

/** Fechas inclusivas del día de la franja; la hora vencida de hoy se omite. */
export function calcularOcurrencias(
  desde: Date,
  hasta: Date,
  diaSemana: DiaSemanaValor,
  diasOperativos: readonly DiaSemanaValor[],
  horaInicio: string,
  hoy: { fecha: string; hora: string },
): { fechas: Date[]; fechasOmitidasVencidas: number } {
  const fechas: Date[] = [];
  let fechasOmitidasVencidas = 0;
  if (!diasOperativos.includes(diaSemana)) return { fechas, fechasOmitidasVencidas };
  for (let tiempo = desde.getTime(); tiempo <= hasta.getTime(); tiempo += 24 * 60 * 60 * 1000) {
    const fecha = new Date(tiempo);
    if (diaSemanaDeFecha(fecha) !== diaSemana) continue;
    if (fecha.toISOString().slice(0, 10) === hoy.fecha && horaInicio <= hoy.hora) {
      fechasOmitidasVencidas++;
    } else {
      fechas.push(fecha);
    }
  }
  return { fechas, fechasOmitidasVencidas };
}

/** El duplicado explica el choque; los dos conflictos físicos pueden coexistir. */
export function motivosConflictoGeneracion(
  turnoExistente: boolean,
  aulaOcupada: boolean,
  profesorOcupado: boolean,
): MotivoConflictoGeneracion[] {
  if (turnoExistente) return ["TURNO_EXISTENTE"];
  const motivos: MotivoConflictoGeneracion[] = [];
  if (aulaOcupada) motivos.push("AULA_OCUPADA");
  if (profesorOcupado) motivos.push("PROFESOR_OCUPADO");
  return motivos;
}
