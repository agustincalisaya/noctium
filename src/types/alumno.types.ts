/** Ficha del alumno (HU-B-02): identidad resumida + contacto actual, para la ficha y para precargar el formulario de contacto. */
export type FichaAlumno = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  activo: boolean;
  telefono: string | null;
  email: string | null;
};

/**
 * Resultado de `actualizarContactoAlumno()` (HU-B-02): mismo shape genérico
 * `{ data, error }` que `ResultadoCrearAlumno` de HU-B-01 (RULES.md Regla
 * N.° 5) — esta Server Action no está ligada a `useActionState`, así que no
 * aplica la excepción de esa regla.
 */
export type ResultadoContactoAlumno =
  | { data: { id: string; telefono: string | null; email: string | null }; error: null }
  | { data: null; error: { code: string; message: string; detalles?: unknown } };
