import type { DiaDeSemana, ParametrosGrilla } from "@/lib/calendario-semana";

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
  estado: "DISPONIBLE" | "COMPLETO";
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

export type RangoSemana = { desde: string; hasta: string };

type SemanaCalendario = {
  /** Del primer al último día operativo de la semana, inclusivo. */
  rango: RangoSemana;
  dias: DiaDeSemana[];
  horario: ParametrosGrilla;
};

export type CalendarioProfesor = SemanaCalendario & {
  profesor: { id: string; nombre_completo: string };
  eventos: EventoCalendario[];
};

export type MateriaCalendario = { id: string; nombre: string; codigo: string | null };

export type CalendarioMateria = SemanaCalendario & {
  materia: MateriaCalendario;
  eventos: EventoCalendarioMateria[];
};
