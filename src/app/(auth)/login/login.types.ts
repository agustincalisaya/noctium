export type EstadoLogin =
  | { status: "idle" }
  | { status: "error_validacion"; errores: { email?: string[]; password?: string[] }; email: string }
  | { status: "error"; mensaje: string; email: string }
  | { status: "error_comunicacion"; email: string };

export const ESTADO_INICIAL: EstadoLogin = { status: "idle" };
