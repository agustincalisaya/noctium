import type { Genero } from "@prisma/client";
import type { ResumenCuenta } from "@/server/usuarios/cuenta.service";

/** Fila del listado mínimo de `/personal` (spec_modulo_F.md §2.3; HU-F-03 suma búsqueda y paginación). */
export type IntegranteListadoItem = {
  id: string;
  apellido: string;
  nombre: string;
  dni: string;
  telefono: string | null;
  email: string;
  activo: boolean;
};

/** `GET /api/personal` sin `q` ni paginación (HU-F-01, DEC-38). HU-F-03 suma `pagina`, `por_pagina` y `total_paginas`. */
export type ListadoPersonal = {
  items: IntegranteListadoItem[];
  total: number;
};

/**
 * Ficha del integrante (spec_modulo_F.md §2.4, parte de HU-F-01). `cuenta` es
 * el `ResumenCuenta` de A tal cual (snake_case), el que consume
 * `CuentaAccesoCard`. `modificadoEl` es `null` si nunca se modificó. HU-F-05
 * suma `historialEstados`, `cajaAbierta` y `motivoObligatorioAlDesactivar`.
 */
export type DetalleIntegrante = {
  id: string;
  version: number;
  activo: boolean;
  nombre: string;
  apellido: string;
  dni: string;
  /** `YYYY-MM-DD`. */
  fechaNacimiento: string;
  genero: Genero | null;
  telefono: string | null;
  email: string;
  creadoEl: Date;
  modificadoEl: Date | null;
  cuenta: ResumenCuenta;
};

/** Respuesta del alta (spec_modulo_F.md §2.1): nunca incluye la contraseña inicial. */
export type IntegranteCreado = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  cuenta: ResumenCuenta;
};

/** Respuesta de la modificación (spec_modulo_F.md §2.2). */
export type IntegranteModificado = {
  id: string;
  campos_modificados: string[];
  version: number;
};

/** Verificación al salir del campo (HU-F-01 c3): no dice de quién es el email. */
export type DisponibilidadIntegrante = {
  dni_disponible: boolean;
  email_disponible: boolean;
};

/** Error de las Server Actions y de los Route Handlers del módulo (Regla N.° 5). */
export type ErrorPersonal = {
  code: string;
  message: string;
  /** Errores por campo del 400 VALIDATION_ERROR. */
  detalles?: Record<string, string[] | undefined>;
};

/** Resultado de las Server Actions del módulo: se llaman directo, sin `useActionState`. */
export type ResultadoAccionPersonal<T> = { data: T; error: null } | { data: null; error: ErrorPersonal };
