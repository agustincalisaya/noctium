import type { DiaDeSemana, ParametrosGrilla } from "@/lib/calendario-semana";

/**
 * Turno `DISPONIBLE` o `COMPLETO` tal como lo muestra la agenda (HU-J-01,
 * `spec_modulo_J.md` §2.1). `alumno` es "Apellido, Nombre"; si el turno
 * tuviera más de un alumno, se unen con "; ".
 */
export type EventoCalendario = {
  turno_id: string;
  /** "AAAA-MM-DD" */
  fecha: string;
  /** "HH:mm" */
  hora_inicio: string;
  /** "HH:mm" (inicio + duración del turno) */
  hora_fin: string;
  alumno: string;
  materia: string;
  aula: string;
  estado: "DISPONIBLE" | "COMPLETO";
};

export type RangoSemana = { desde: string; hasta: string };

export type CalendarioProfesor = {
  profesor: { id: string; nombre_completo: string };
  /** Del primer al último día operativo de la semana, inclusivo. */
  rango: RangoSemana;
  dias: DiaDeSemana[];
  horario: ParametrosGrilla;
  eventos: EventoCalendario[];
};
