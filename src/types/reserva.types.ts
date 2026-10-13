import type { ReservaPendiente, ReservaVencida } from "@/server/turnos/inscripcion.publico";

/**
 * Tipos de la pantalla Reservas (HU-C-26, spec_modulo_C.md §2.20). Las
 * lecturas de C ya devuelven fechas como texto (ISO en la zona del centro), así
 * que la forma serializada por JSON es la misma que la del servicio.
 */
export type ReservaPendienteVista = ReservaPendiente;
export type ReservaVencidaVista = ReservaVencida;

export type PaginacionReservas = { total: number; pagina_actual: number; total_paginas: number; por_pagina: number };

export type ListadoReservasPendientes = { items: ReservaPendienteVista[]; paginacion: PaginacionReservas };
export type ListadoReservasVencidas = { items: ReservaVencidaVista[]; paginacion: PaginacionReservas };

export type ResumenReservas = {
  pendientes: { cantidad: number; importe_total: number };
  vencen_en_3_horas: number;
  vencen_hoy: number;
  vencieron_hoy: number;
};

export type OpcionMateriaReservas = { id: string; nombre: string };
