/**
 * Tipos de dominio del módulo D (Regla N.° 11). Los tipos de HU-D-01/D-02
 * siguen en `src/app/(dashboard)/profesores/profesor.types.ts` hasta su
 * refactor propio (deuda técnica, ver HU-D-03 §1 punto 1).
 */

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
