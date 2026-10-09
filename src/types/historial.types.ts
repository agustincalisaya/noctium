export type TipoRegistroHistorial = "CLASE_DICTADA" | "EXAMEN";

export type ItemHistorialAcademico = {
  tipo: TipoRegistroHistorial;
  fecha: string;
  materia: { id: string; nombre: string };
} & (
  | { tipo: "CLASE_DICTADA"; profesor: string; turno_id: string; asistencia: EstadoAsistencia | null }
  | { tipo: "EXAMEN"; nota: string; observaciones: string | null }
);

export type EstadoAsistencia = "PRESENTE" | "AUSENTE";
export type AsistenciaPorMateria = { materia_id: string; presentes: number; ausentes: number; sin_control: number; porcentaje: number | null };
export type RegistroClaseDictada = {
  id: string; registrada_en: string; registrada_por: string | null;
  alumnos: { id: string; nombre_completo: string; asistencia: EstadoAsistencia | null }[];
  con_control_asistencia: boolean;
  totales: { presentes: number; ausentes: number } | null;
};

export type HistorialAcademicoData = {
  asistencia_por_materia: AsistenciaPorMateria[];
  alumno: { id: string; nombre_completo: string };
  materias_disponibles: { id: string; nombre: string }[];
  items: ItemHistorialAcademico[];
  paginacion: { total: number; pagina_actual: number; total_paginas: number; por_pagina: number };
};

export type OpcionesExamenData = {
  materias: { id: string; nombre: string }[];
  escala: { min: number; max: number };
};
