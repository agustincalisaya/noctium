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
