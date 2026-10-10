export type ResultadoClaseAlumno = "PROXIMA" | "ASISTIO" | "AUSENTE" | "SIN_REGISTRAR_COMO_DICTADA" | "CANCELADA_CENTRO" | "CANCELADA_ALUMNO" | "RESERVA_VENCIDA" | "BAJA_ALUMNO" | "QUITADA_CENTRO";
export type ClaseDelAlumno = {
  inscripcion_id: string; turno_id: string; fecha: string; hora_inicio: string; hora_fin: string;
  materia: { id: string; nombre: string }; profesor: string | null; aula: string | null;
  resultado: ResultadoClaseAlumno; sin_control_asistencia: boolean;
};
export type ClasesAlumnoData = {
  alumno: { id: string; nombre_completo: string };
  resumen: { total: number; por_resultado: Record<ResultadoClaseAlumno, number>; asistio_sin_control: number; clases_con_control: number; porcentaje_asistencia: number | null };
  items: ClaseDelAlumno[];
  paginacion: { total: number; pagina_actual: number; total_paginas: number; por_pagina: number };
};
