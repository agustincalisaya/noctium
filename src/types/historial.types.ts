export type TipoRegistroHistorial = "CLASE_DICTADA" | "EXAMEN";

export type ItemHistorialAcademico = {
  tipo: TipoRegistroHistorial;
  fecha: string;
  materia: { id: string; nombre: string };
} & (
  | { tipo: "CLASE_DICTADA"; profesor: string; turno_id: string }
  | { tipo: "EXAMEN"; nota: string; observaciones: string | null }
);

export type HistorialAcademicoData = {
  alumno: { id: string; nombre_completo: string };
  materias_disponibles: { id: string; nombre: string }[];
  items: ItemHistorialAcademico[];
  paginacion: { total: number; pagina_actual: number; total_paginas: number; por_pagina: number };
};

export type OpcionesExamenData = {
  materias: { id: string; nombre: string }[];
  escala: { min: number; max: number };
};
