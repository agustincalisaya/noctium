export type EstadoMateria =
  | { status: "idle" }
  | { status: "ok" }
  | {
      status: "error_validacion";
      errores: { nombre?: string[]; codigo?: string[] };
      nombre: string;
      codigo: string;
    }
  | { status: "error"; campo: "nombre" | "codigo" | null; mensaje: string; nombre: string; codigo: string }
  | { status: "error_comunicacion"; nombre: string; codigo: string };

export const ESTADO_INICIAL: EstadoMateria = { status: "idle" };

export type MateriaResumen = {
  id: string;
  nombre: string;
  codigo: string | null;
  profesores_count: number;
  is_active: boolean;
};

export type MateriaDetalle = {
  id: string;
  nombre: string;
  codigo: string | null;
  is_active: boolean;
  created_at: string;
  profesores: { id: string; nombre_completo: string }[];
};
