import type { AccionHistorialEstado, Genero } from "@prisma/client";
import type { ResumenCuenta } from "@/server/usuarios/cuenta.service";

/**
 * Fila del listado de `/gerentes` (spec_modulo_G.md §2.3, HU-G-01 y HU-G-03).
 * `esVos` lo calcula el servidor: `true` solo en la ficha del gerente
 * autenticado (criterio 3). El `usuarioId` de la ficha nunca se devuelve.
 */
export type GerenteListadoItem = {
  id: string;
  apellido: string;
  nombre: string;
  dni: string;
  telefono: string | null;
  email: string;
  activo: boolean;
  esVos: boolean;
};

/**
 * `GET /api/gerentes` (spec_modulo_G.md §2.3, HU-G-03): activas e inactivas,
 * con búsqueda y paginación de a `POR_PAGINA_GERENTES`. `total` es el del
 * resultado filtrado; sin resultados, `pagina` es 1 y `total_paginas` es 0.
 */
export type ListadoGerentes = {
  items: GerenteListadoItem[];
  pagina: number;
  por_pagina: number;
  total: number;
  total_paginas: number;
};

/**
 * Ficha del gerente (spec_modulo_G.md §2.4, HU-G-01 y HU-G-05). `cuenta` es
 * el `ResumenCuenta` de A tal cual (snake_case), el que consume
 * `CuentaAccesoCard`. `modificadoEl` es `null` si nunca se modificó. `esVos`
 * es `true` si la ficha es la del gerente autenticado (DEC-44). Los dos
 * indicadores de HU-G-05 son de solo lectura y solo se calculan con la ficha
 * activa (si no, `false`); la baja repite las validaciones al confirmar.
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
  /** Bajas y reactivaciones, de la más reciente a la más antigua. */
  historialEstados: EntradaHistorialGerente[];
  /** La cuenta de la ficha «registró operaciones» (DEC-39): la baja exige motivo. Solo con ficha activa y con cuenta. */
  motivoObligatorioAlDesactivar: boolean;
  /** Sin contar esta ficha, no queda ningún gerente activo con cuenta activa (criterio 3). Solo con ficha activa. */
  esUltimoGerenteActivo: boolean;
};

/**
 * Una baja o reactivación de la ficha (DEC-37). `usuarioNombre` es «Apellido,
 * Nombre» de quien actuó; `null` si no se resuelve o si fue el proceso
 * automático.
 */
export type EntradaHistorialGerente = {
  id: string;
  accion: AccionHistorialEstado;
  motivo: string | null;
  fecha: Date;
  usuarioId: string | null;
  usuarioNombre: string | null;
};

/** Respuesta de desactivar y reactivar (spec_modulo_G.md §2.5 y §2.6). */
export type EstadoGerenteCambiado = {
  id: string;
  activo: boolean;
  version: number;
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
