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
