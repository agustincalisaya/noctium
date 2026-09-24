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

/**
 * Resultado de `iniciarAutorregistro()` (HU-B-08, spec_modulo_B.md §2.6).
 * Las 3 ramas con respuesta directa (a, c-vía-error, d) — la rama (b)
 * devuelve `VERIFICACION_REQUERIDA`. Rama (c) no tiene variante propia acá:
 * se resuelve como el mismo `ServiceError CUENTA_YA_EXISTE` que el paso 2,
 * no como un resultado exitoso distinto (no distinguible desde el cliente).
 */
export type ResultadoAutorregistro =
  | { via: "DIRECTO"; email: string }
  | { via: "VERIFICACION_REQUERIDA"; solicitud_id: string; email_enmascarado: string }
  | { via: "DERIVADO_MESA_ENTRADA" };

/**
 * Resultado de `confirmarCodigoAutorregistro()` (HU-B-08, rama b exitosa).
 * `email`: el alumno recién probó que controla esa casilla al confirmar el
 * código correcto — devolverlo en texto plano acá es seguro (a diferencia
 * de la respuesta de `iniciarAutorregistro()`, que lo enmascara porque
 * todavía no hubo ninguna verificación). Lo usa el cliente para precargar
 * `/login?email=` igual que la rama directa.
 */
export type ResultadoConfirmacionAutorregistro = {
  alumno_id: string;
  usuario_id: string;
  email: string;
};

/** Resultado de `reenviarCodigoAutorregistro()` (HU-B-08). */
export type ResultadoReenvioCodigo = {
  email_enmascarado: string;
};
