export type Turno = {
  id: string; fecha: string; hora_inicio: string; hora_fin: string; duracion_minutos: number; cupo_maximo: number;
  alumno: string; alumnos: { id: string; nombre: string; dni: string }[]; alumno_id: string | null; alumno_dni: string | null;
  profesor: string; profesor_id: string | null; profesor_dni: string | null;
  materia: string; materia_id: string; materia_codigo: string | null;
  aula: string; aula_id: string | null; aula_capacidad: number | null;
  estado: "PENDIENTE" | "DISPONIBLE" | "COMPLETO"; creado_en: string; actualizado_en: string; creado_por_id: string | null;
  modificado_por_id: string | null;
};

export const ETIQUETA_ESTADO_TURNO: Record<Turno["estado"], string> = { PENDIENTE: "Pendiente", DISPONIBLE: "Disponible", COMPLETO: "Completo" };

export type TurnoDetalle = Turno & { creado_por: string; modificado_por: string };
export type TurnosData = { items: Turno[]; paginacion: { total: number; pagina_actual: number; total_paginas: number; por_pagina: number } };

export function urlContinuar(turno: Turno, retorno: string) {
  const paso = !turno.alumno_id || !turno.profesor_id ? "participantes" : "aula";
  return `/turnos/${encodeURIComponent(turno.id)}/${paso}?volver=${encodeURIComponent(retorno)}`;
}
