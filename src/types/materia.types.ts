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
