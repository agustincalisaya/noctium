import type { Genero } from "@prisma/client";
import type { ResumenCuenta } from "@/server/usuarios/cuenta.service";

/** Fila del listado mínimo de `/gerentes` (DEC-38: HU-G-03 le suma `esVos`). */
export type GerenteListadoItem = {
  id: string;
  apellido: string;
  nombre: string;
  dni: string;
  telefono: string | null;
  email: string;
  activo: boolean;
};

/**
 * `GET /api/gerentes` mínimo (HU-G-01, DEC-38): todas las fichas, activas e
 * inactivas, sin búsqueda ni paginación. HU-G-03 le suma `pagina`,
 * `por_pagina` y `total_paginas` de forma aditiva.
 */
export type ListadoGerentes = {
  items: GerenteListadoItem[];
  total: number;
};

/**
 * Ficha del gerente (spec_modulo_G.md §2.4, parte de HU-G-01). `cuenta` es el
 * `ResumenCuenta` de A tal cual (snake_case), el que consume
 * `CuentaAccesoCard`. `modificadoEl` es `null` si nunca se modificó. `esVos`
 * es `true` si la ficha es la del gerente autenticado (DEC-44). HU-G-05 suma
 * `historialEstados`, `motivoObligatorioAlDesactivar` y
 * `esUltimoGerenteActivo` sin cambiar la firma.
 */
export type DetalleGerente = {
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
  esVos: boolean;
};

/** Respuesta del alta (spec_modulo_G.md §2.1): nunca incluye la contraseña inicial. */
export type GerenteCreado = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  cuenta: ResumenCuenta;
};

/** Respuesta de la modificación (spec_modulo_G.md §2.2). */
export type GerenteModificado = {
  id: string;
  campos_modificados: string[];
  version: number;
};

/** Verificación al salir del campo (HU-G-01, decisión 9): no dice de quién es el email. */
export type DisponibilidadGerente = {
  dni_disponible: boolean;
  email_disponible: boolean;
};

/** Error de las Server Actions y de los Route Handlers del módulo (Regla N.° 5). */
export type ErrorGerente = {
  code: string;
  message: string;
  /** Errores por campo del 400 VALIDATION_ERROR. */
  detalles?: Record<string, string[] | undefined>;
};

/** Resultado de las Server Actions del módulo: se llaman directo, sin `useActionState`. */
export type ResultadoAccionGerente<T> = { data: T; error: null } | { data: null; error: ErrorGerente };
