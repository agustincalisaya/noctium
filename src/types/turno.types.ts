/** Estado de un turno (spec_modulo_C.md §2, Revisión 5). */
export type EstadoTurno = "PENDIENTE" | "DISPONIBLE" | "COMPLETO" | "CANCELADO";

/** Prioridad del turno (`Turno.prioridadTurno`, spec_modulo_C.md §2.12). */
export type PrioridadTurno = "NORMAL" | "ALTA" | "URGENTE";

/**
 * Acciones que el detalle puede ofrecer (spec_modulo_C.md §2.4), en el orden
 * fijo en que se devuelven. Expresan elegibilidad de dominio: cada endpoint
 * dueño vuelve a autorizar y validar al ejecutarse.
 */
export const ACCIONES_TURNO = ["cancelar", "descartar", "reprogramar", "prioridad", "registrar_pago", "registrar_clase"] as const;
export type AccionTurno = (typeof ACCIONES_TURNO)[number];

/** Ítem del listado y base del detalle (presentador compartido `presentar()`). */
export type Turno = {
  // cupo_maximo es null hasta asignar aula (Revisión 3); alumnos_inscriptos vale entonces "Sin asignar".
  id: string; fecha: string; hora_inicio: string; hora_fin: string; duracion_minutos: number; cupo_maximo: number | null;
  alumnos_inscriptos: string; alumnos: { id: string; nombre: string; dni: string }[];
  profesor: string; profesor_id: string | null; profesor_dni: string | null;
  materia: string; materia_id: string; materia_codigo: string | null;
  aula: string; aula_id: string | null; aula_capacidad: number | null;
  estado: EstadoTurno; prioridad: PrioridadTurno; creado_en: string; actualizado_en: string; creado_por_id: string | null;
  modificado_por_id: string | null;
};

export const ETIQUETA_ESTADO_TURNO: Record<EstadoTurno, string> = { PENDIENTE: "Pendiente", DISPONIBLE: "Disponible", COMPLETO: "Completo", CANCELADO: "Cancelado" };

export const ETIQUETA_PRIORIDAD_TURNO: Record<PrioridadTurno, string> = { NORMAL: "Normal", ALTA: "Alta", URGENTE: "Urgente" };

/** Pago registrado del turno (`listarPagosDeTurno()`, spec_modulo_I.md §2.3). */
export type PagoRegistradoTurno = {
  id: string;
  alumno: { id: string; nombre_completo: string };
  /** Decimal con punto ("15000.50"). */
  monto: string;
  forma_pago: { id: string; nombre: string };
  /** `YYYY-MM-DD`. */
  fecha_pago: string;
  registrado_en: string;
};

/**
 * Detalle de `GET /api/turnos/[id]` (HU-C-09). `creado_por` es el email de la
 * cuenta creadora o `null` (la UI muestra «Sin registrar»). `pagos` solo viene
 * con `pagos:leer`: sin permiso la propiedad no existe.
 */
export type TurnoDetalle = Turno & {
  creado_por: string | null;
  pagos?: PagoRegistradoTurno[];
  clase_dictada: { id: string; registrada_en: string } | null;
  acciones_habilitadas: AccionTurno[];
};

export type TurnosData = { items: Turno[]; paginacion: { total: number; pagina_actual: number; total_paginas: number; por_pagina: number } };
