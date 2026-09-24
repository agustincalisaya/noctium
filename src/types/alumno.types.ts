import type { Genero } from "@prisma/client";

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

/** Ítem del listado de alumnos (HU-B-04): datos resumidos de una fila de la tabla. */
export type AlumnoListado = {
  id: string;
  apellido: string;
  nombre: string;
  dni: string;
  telefono: string | null;
  email: string | null;
  is_active: boolean;
};

/** Metadatos de paginación server-side (HU-B-04, spec_modulo_B.md §2.4). */
export type Paginacion = {
  total: number;
  pagina_actual: number;
  total_paginas: number;
  por_pagina: number;
};

/**
 * Detalle completo del alumno (HU-B-04): identidad + contacto + forma de
 * pago preferida (nombre resuelto, `null` = "Sin preferencia") + estado +
 * fecha de alta. Separado de `FichaAlumno` (HU-B-02) a propósito — ver
 * `obtenerDetalleAlumno()` en `alumno.service.ts`.
 */
export type DetalleAlumno = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  /** Fecha de nacimiento en formato `YYYY-MM-DD` (HU-B-06) — precarga el `<input type="date">` del formulario de edición. */
  fecha_nacimiento: string;
  genero: Genero | null;
  is_active: boolean;
  telefono: string | null;
  email: string | null;
  forma_pago_preferida: string | null;
  /** Id de la `FormaPago` preferida actual (HU-B-03) — para precargar el `<select>` por id, no por nombre. */
  forma_pago_preferida_id: string | null;
  created_at: string;
  /** Condición de concurrencia optimista (HU-B-06, RULES.md Regla N.° 7) — viaja oculta en el formulario de edición y vuelve en el payload de `modificarAlumno()`. */
  version: number;
};

/**
 * Resultado de `modificarAlumno()` (HU-B-06): mismo shape genérico
 * `{ data, error }` (Regla N.° 5) que `ResultadoContactoAlumno` — esta
 * Server Action tampoco está ligada a `useActionState`.
 */
export type ResultadoModificarAlumno =
  | { data: { id: string; campos_modificados: string[]; version: number }; error: null }
  | { data: null; error: { code: string; message: string; detalles?: unknown } };
