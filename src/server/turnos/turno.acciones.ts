import type { RolUsuario } from "@prisma/client";
import { ACCIONES_TURNO, type AccionTurno, type EstadoTurno } from "@/types/turno.types";
import { horaLocal, turnoSigueVigente } from "./turno.validaciones";

const MINUTOS_POR_DIA = 24 * 60;

/**
 * `fecha + hora_fin <= ahora` en America/Argentina/Buenos_Aires, a precisión
 * de minuto (spec_modulo_E.md §2.1 paso 4 (b)): el mismo minuto del fin ya
 * cuenta como terminado. Un turno que termina después de medianoche pasa al
 * día siguiente. Pura: recibe `ahora`, no lee el reloj.
 */
export function turnoYaTermino(fecha: Date, horaInicio: Date, duracionMinutos: number, ahora: Date): boolean {
  const inicio = horaInicio.getUTCHours() * 60 + horaInicio.getUTCMinutes();
  const fin = inicio + duracionMinutos;
  const diaFin = new Date(fecha.getTime() + Math.floor(fin / MINUTOS_POR_DIA) * MINUTOS_POR_DIA * 60_000).toISOString().slice(0, 10);
  const minutoFin = fin % MINUTOS_POR_DIA;
  const horaFin = `${String(Math.floor(minutoFin / 60)).padStart(2, "0")}:${String(minutoFin % 60).padStart(2, "0")}`;
  const actual = horaLocal(ahora);
  return diaFin < actual.fecha || (diaFin === actual.fecha && horaFin <= actual.hora);
}

/** Permisos opcionales del rol, calculados por la ruta sin abortar el GET. */
export type CapacidadesAcciones = {
  cancelar: boolean;
  reprogramar: boolean;
  priorizar: boolean;
  registrarPago: boolean;
  registrarClase: boolean;
};

export type EntradaAcciones = {
  estado: EstadoTurno;
  fecha: Date;
  horaInicio: Date;
  duracionMinutos: number;
  cantidadAlumnos: number;
  rol: RolUsuario;
  /** El turno es del profesor de la sesión (solo cuenta para el rol PROFESOR). */
  turnoPropio: boolean;
  /**
   * Si el turno ya tiene clase dictada. `null` mientras E no publique
   * `obtenerClaseDictadaDeTurno()`: sin ese dato `registrar_clase` no se ofrece.
   */
  tieneClaseDictada: boolean | null;
  capacidades: CapacidadesAcciones;
  /** Único instante de referencia de la request. */
  ahora: Date;
};

const ESTADOS_CONFIRMADOS: readonly EstadoTurno[] = ["DISPONIBLE", "COMPLETO"];

/**
 * Acciones elegibles para el estado, el momento y el rol (spec_modulo_C.md
 * §2.4 y §3.8), en orden fijo. Un turno CANCELADO no tiene ninguna. No
 * reemplaza la autorización ni la validación de cada endpoint dueño.
 */
export function calcularAccionesHabilitadas(entrada: EntradaAcciones): AccionTurno[] {
  const { estado, capacidades } = entrada;
  if (estado === "CANCELADO") return [];
  const confirmado = ESTADOS_CONFIRMADOS.includes(estado);
  const vigente = turnoSigueVigente(entrada.fecha, entrada.horaInicio, entrada.ahora);
  const elegibles: Record<AccionTurno, boolean> = {
    cancelar: capacidades.cancelar && confirmado && vigente,
    descartar: capacidades.cancelar && estado === "PENDIENTE",
    reprogramar: capacidades.reprogramar && confirmado && vigente,
    prioridad: capacidades.priorizar,
    registrar_pago: capacidades.registrarPago && confirmado && entrada.cantidadAlumnos > 0,
    registrar_clase: capacidades.registrarClase && confirmado
      && entrada.tieneClaseDictada === false
      && (entrada.rol !== "PROFESOR" || entrada.turnoPropio)
      && turnoYaTermino(entrada.fecha, entrada.horaInicio, entrada.duracionMinutos, entrada.ahora),
  };
  return ACCIONES_TURNO.filter((accion) => elegibles[accion]);
}
