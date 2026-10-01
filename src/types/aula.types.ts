export type EstadoAula =
  | { status: "idle" }
  | {
      status: "error_validacion";
      errores: { nombre?: string[]; capacidad?: string[] };
      nombre: string;
      capacidad: string;
    }
  | { status: "error"; campo: "nombre" | "capacidad" | null; mensaje: string; nombre: string; capacidad: string }
  | { status: "error_comunicacion"; nombre: string; capacidad: string };

export const ESTADO_INICIAL: EstadoAula = { status: "idle" };

/** Detalle de aula (spec_modulo_K.md §2.2), con `updated_at`/`version` desde HU-K-03. */
export type DetalleAula = {
  id: string;
  nombre: string;
  capacidad: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  version: number;
};

/**
 * Resultado de `modificarAula()` (Server Action, HU-K-03). No está ligada a
 * `useActionState`, así que usa el shape genérico `{ data, error }` de la
 * Regla N.° 5 (mismo criterio que `modificarMateria()`).
 */
export type ResultadoModificarAula =
  | {
      data: {
        id: string;
        campos_modificados: ("nombre" | "capacidad")[];
        version: number;
        turnos_actualizados: number;
      };
      error: null;
    }
  | {
      data: null;
      error: { code: string; message: string; detalles?: unknown; detalle?: unknown };
    };
