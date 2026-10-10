/** Ingresos cobrados en un mes, en pesos (`spec_modulo_H.md` §2.2). */
export type IngresoMes = {
  mes: string;
  total: number;
};

/** Ocupación promedio de un mes, en porcentaje con 1 decimal (`spec_modulo_H.md` §2.3). */
export type OcupacionMes = {
  mes: string;
  ocupacion_promedio: number;
};

export type ResumenPresentismo = { inscriptos: number; presentes: number; ausentes: number; indice: number | null };
export type PresentismoMes = ResumenPresentismo & { mes: string };
export type PresentismoMensualData = { meses: PresentismoMes[]; resumen: ResumenPresentismo; clases_sin_control: number };
export type PresentismoMateria = ResumenPresentismo & { materia_id: string; nombre: string; codigo: string | null; activa: boolean };
export type PresentismoMateriasData = { items: PresentismoMateria[]; resumen: ResumenPresentismo; clases_sin_control: number };
export type AlumnoPresentismoBajo = { alumno_id: string; nombre_completo: string; materia_id: string; materia: string; clases_dictadas: number; ausencias: number; porcentaje: number };
export type PresentismoBajoData = { umbral: number; minimo_clases: number; pagina: number; por_pagina: number; total: number; items: AlumnoPresentismoBajo[] };
export type ResumenOcupacion = { ocupacion_promedio: number; turnos: number };

export type ClasesMateria = { materia_id: string; nombre: string; codigo: string | null; activa: boolean; clases: number };
export type ClasesMateriasData = { total: number; items: ClasesMateria[] };
export type ClasesProfesor = { profesor_id: string; nombre: string; activo: boolean; clases: number; horas: number };
export type ClasesProfesoresData = { total: { clases: number; horas: number }; items: ClasesProfesor[] };

export type SeriesCancelaciones = { clases_canceladas_centro: number; inscripciones_canceladas_alumno: number; reservas_vencidas: number; bajas: number };
export type CancelacionesMesData = {
  meses: ({ mes: string } & SeriesCancelaciones)[];
  totales: SeriesCancelaciones;
  tasas: { clases: { canceladas: number; totales: number; tasa: number | null }; inscripciones: { canceladas_alumno: number; totales: number; tasa: number | null } };
};
export type CancelacionesMateriaData = { items: { materia_id: string; nombre: string; codigo: string | null; activa: boolean; clases_canceladas_centro: number; inscripciones_canceladas_alumno: number }[] };
