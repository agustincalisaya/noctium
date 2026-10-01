import type { DiaDeSemana, ParametrosGrilla, VistaCalendario } from "@/lib/calendario-semana";
import type { PrioridadTurno } from "@/types/turno.types";

export type { VistaCalendario };

type EstadoCalendario = "DISPONIBLE" | "COMPLETO";

/**
 * Datos comunes a todo turno `DISPONIBLE` o `COMPLETO` en el calendario
 * (`spec_modulo_J.md` §2.1 y §2.2).
 */
export type EventoCalendarioBase = {
  turno_id: string;
  /** "AAAA-MM-DD" */
  fecha: string;
  /** "HH:mm" */
  hora_inicio: string;
  /** "HH:mm" (inicio + duración del turno) */
  hora_fin: string;
  aula: string;
  estado: EstadoCalendario;
  prioridad: PrioridadTurno;
};

/**
 * Turno tal como lo muestra la agenda por profesor (HU-J-01). `alumno` es
 * "Apellido, Nombre"; si el turno tuviera más de un alumno, se unen con "; ".
 */
export type EventoCalendario = EventoCalendarioBase & {
  alumno: string;
  materia: string;
};

/**
 * Turno tal como lo muestra el calendario por materia (HU-J-02). En lugar
 * de nombres de alumnos lleva la ocupación: `alumnos_inscriptos` es
 * "inscriptos/cupo" (mismo formato que el módulo C).
 */
export type EventoCalendarioMateria = EventoCalendarioBase & {
  /** "Apellido, Nombre" */
  profesor: string;
  /** "3/5" */
  alumnos_inscriptos: string;
  inscriptos: number;
  cupo: number;
};

/**
 * Turno confirmado tal como lo define el contrato de
 * `listarTurnosParaCalendario()` (`spec_modulo_C.md` §2.15). Mientras el
 * módulo C no lo publique, lo arma `listarTurnosDelCalendario()` del
 * módulo J con la misma forma (HU-J-03.md §1 punto 7).
 */
export type TurnoDelCalendario = {
  turno_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: EstadoCalendario;
  prioridad: PrioridadTurno;
  materia: { id: string; nombre: string };
  profesor: { id: string; nombre_para_mostrar: string } | null;
  aula: { id: string; nombre: string } | null;
  /** "Apellido, Nombre", ordenados por apellido y nombre normalizados. */
  alumnos: string[];
  inscriptos: number;
  cupo: number | null;
  /** "3/5" */
  alumnos_inscriptos: string;
};

export type RangoSemana = { desde: string; hasta: string };
export type RangoCalendario = RangoSemana;

/**
 * Indicador compacto de un día en la vista mes (HU-J-03 c2,
 * `spec_modulo_J.md` §2.3 punto 4). `en_mes: false` = día de relleno de la
 * grilla (mes anterior o siguiente).
 */
export type ResumenDiaCalendario = {
  fecha: string;
  en_mes: boolean;
  cantidad: number;
  por_estado: Record<EstadoCalendario, number>;
  estado_predominante: EstadoCalendario | null;
  prioridad_maxima: PrioridadTurno | null;
};

/** Vistas día y semana: grilla horaria con los turnos (HU-J-03 c3). */
type PeriodoConEventos<E> = {
  vista: "dia" | "semana";
  /** Día consultado, o del primer al último día operativo de la semana, inclusivo. */
  rango: RangoCalendario;
  dias: DiaDeSemana[];
  horario: ParametrosGrilla;
  eventos: E[];
};

/** Vista mes: un resumen por día de la grilla, relleno incluido. */
type PeriodoMes = {
  vista: "mes";
  /** Del día 1 al último día del mes. */
  rango: RangoCalendario;
  dias: ResumenDiaCalendario[];
};

export type CalendarioProfesor = {
  profesor: { id: string; nombre_completo: string };
} & (PeriodoConEventos<EventoCalendario> | PeriodoMes);

export type MateriaCalendario = { id: string; nombre: string; codigo: string | null };

export type CalendarioMateria = {
  materia: MateriaCalendario;
} & (PeriodoConEventos<EventoCalendarioMateria> | PeriodoMes);
