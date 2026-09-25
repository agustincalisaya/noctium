export type Turno = {
  // cupo_maximo es null hasta asignar aula (Revisión 3); alumnos_inscriptos vale entonces "Sin asignar".
  id: string; fecha: string; hora_inicio: string; hora_fin: string; duracion_minutos: number; cupo_maximo: number | null;
  alumnos_inscriptos: string; alumnos: { id: string; nombre: string; dni: string }[];
  profesor: string; profesor_id: string | null; profesor_dni: string | null;
  materia: string; materia_id: string; materia_codigo: string | null;
  aula: string; aula_id: string | null; aula_capacidad: number | null;
  estado: "PENDIENTE" | "DISPONIBLE" | "COMPLETO"; creado_en: string; actualizado_en: string; creado_por_id: string | null;
  modificado_por_id: string | null;
};

export const ETIQUETA_ESTADO_TURNO: Record<Turno["estado"], string> = { PENDIENTE: "Pendiente", DISPONIBLE: "Disponible", COMPLETO: "Completo" };

export type TurnoDetalle = Turno & { creado_por: string; modificado_por: string };
export type TurnosData = { items: Turno[]; paginacion: { total: number; pagina_actual: number; total_paginas: number; por_pagina: number } };

/** Siguiente paso de un turno PENDIENTE (HU-C-01 c3, Revisión 3): primero aula, después profesor y alumnos. */
export function urlContinuar(turno: Turno, retorno: string) {
  // El aula se elige en la misma pantalla que la configuración (§2.1 + §2.3 fusionadas).
  const paso = turno.aula_id ? "participantes" : "configuracion";
  return `/turnos/${encodeURIComponent(turno.id)}/${paso}?volver=${encodeURIComponent(retorno)}`;
}
