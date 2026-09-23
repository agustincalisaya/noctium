/**
 * Tipos de dominio del módulo D (Regla N.° 11). Los tipos de HU-D-01/D-02
 * siguen en `src/app/(dashboard)/profesores/profesor.types.ts` hasta su
 * refactor propio (deuda técnica, ver HU-D-03 §1 punto 1).
 */

import type { DiaSemanaValor } from "@/lib/horario-atencion";

/** Materia asociada a un profesor. `activa` refleja el estado actual de la materia (HU-D-03 §1 punto 12). */
export type MateriaDeProfesor = { id: string; nombre: string; codigo: string | null; activa: boolean };

export type EstadoAsociarMaterias =
  | { status: "idle" }
  | { status: "error_validacion"; errores: Record<string, string[] | undefined> }
  | { status: "materias_inactivas"; materias: { id: string; nombre: string }[] }
  | { status: "error"; mensaje: string }
  | { status: "error_comunicacion" }
  | { status: "exito"; asociadas: MateriaDeProfesor[] };

export const ESTADO_INICIAL_ASOCIAR_MATERIAS: EstadoAsociarMaterias = { status: "idle" };

/**
 * Horario de atención del profesor (HU-D-04): intervalo semiabierto
 * [horaInicio, horaFin) recurrente todas las semanas en `diaSemana`. Horas
 * en "HH:mm" (24 h).
 */
export type HorarioAtencion = {
  id: string;
  diaSemana: DiaSemanaValor;
  horaInicio: string;
  horaFin: string;
};

/** Profesor activo para el selector de HU-D-04. */
export type ProfesorActivoOpcion = { id: string; nombre: string; apellido: string; dni: string };

export type EstadoRegistrarHorario =
  | { status: "idle" }
  | { status: "error_validacion"; errores: Record<string, string[] | undefined> }
  | { status: "error"; mensaje: string }
  | { status: "error_comunicacion" }
  | { status: "exito"; horario: HorarioAtencion };

export const ESTADO_INICIAL_REGISTRAR_HORARIO: EstadoRegistrarHorario = { status: "idle" };
