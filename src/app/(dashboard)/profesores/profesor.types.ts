export type EstadoNuevoProfesor =
  | { status: "idle" }
  | { status: "error_validacion"; errores: Record<string, string[] | undefined> }
  | { status: "error"; mensaje: string }
  | { status: "error_comunicacion" }
  | { status: "exito"; profesorId: string; nombre: string; apellido: string };

export const ESTADO_INICIAL_NUEVO_PROFESOR: EstadoNuevoProfesor = { status: "idle" };
