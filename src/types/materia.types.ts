export type EstadoMateria =
  | { status: "idle" }
  | {
      status: "error_validacion";
      errores: { nombre?: string[]; codigo?: string[] };
      nombre: string;
      codigo: string;
    }
  | { status: "error"; campo: "nombre" | "codigo" | null; mensaje: string; nombre: string; codigo: string }
  | { status: "error_comunicacion"; nombre: string; codigo: string };

export const ESTADO_INICIAL: EstadoMateria = { status: "idle" };

/**
 * Resultado de `modificarMateria()` (Server Action, HU-L-03). No está ligada a
 * `useActionState`, así que usa el shape genérico `{ data, error }` de la
 * Regla N.° 5 (mismo criterio que `modificarAlumno()`).
 */
export type ResultadoModificarMateria =
  | { data: { id: string; campos_modificados: ("nombre" | "codigo")[]; version: number }; error: null }
  | { data: null; error: { code: string; message: string; detalles?: unknown } };

/** Detalle de materia (spec_modulo_L.md §2.2), con `updated_at`/`version` desde HU-L-03. */
export type DetalleMateria = {
  id: string;
  nombre: string;
  codigo: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  version: number;
  profesores: { id: string; nombre_completo: string }[];
};
