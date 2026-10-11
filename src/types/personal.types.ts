import type { AccionHistorialEstado, Genero } from "@prisma/client";
import type { ResumenCuenta } from "@/server/usuarios/cuenta.service";

/** Fila del listado de `/personal` (spec_modulo_F.md §2.3). */
export type IntegranteListadoItem = {
  id: string;
  apellido: string;
  nombre: string;
  dni: string;
  telefono: string | null;
  email: string;
  activo: boolean;
};

/**
 * `GET /api/personal` con búsqueda y paginación (spec_modulo_F.md §2.3,
 * HU-F-03). `total` y `total_paginas` son del resultado filtrado; sin
 * resultados, `total_paginas` es 0 y `pagina` es 1.
 */
export type ListadoPersonal = {
  items: IntegranteListadoItem[];
  pagina: number;
  por_pagina: number;
  total: number;
  total_paginas: number;
};

/**
 * Ficha del integrante (spec_modulo_F.md §2.4, parte de HU-F-01). `cuenta` es
 * el `ResumenCuenta` de A tal cual (snake_case), el que consume
 * `CuentaAccesoCard`. `modificadoEl` es `null` si nunca se modificó. HU-F-05
 * suma `historialEstados`, `cajaAbierta` y `motivoObligatorioAlDesactivar`:
 * los dos indicadores son de solo lectura (el servidor repite la validación
 * al desactivar) y son `false` si la ficha está inactiva o no tiene cuenta.
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
  /** Del más reciente al más antiguo. */
  historialEstados: EntradaHistorialIntegrante[];
  cajaAbierta: boolean;
  motivoObligatorioAlDesactivar: boolean;
};

/**
 * Una baja o reactivación de la ficha (DEC-37). `usuarioNombre` es «Apellido,
 * Nombre» de quien actuó; `null` si no se resuelve o si fue el proceso
 * automático.
 */
export type EntradaHistorialIntegrante = {
  id: string;
  accion: AccionHistorialEstado;
  motivo: string | null;
  fecha: Date;
  usuarioId: string | null;
  usuarioNombre: string | null;
};

/** Respuesta de desactivar y reactivar (spec_modulo_F.md §2.5 y §2.6). */
export type EstadoIntegranteCambiado = {
  id: string;
  activo: boolean;
  version: number;
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
