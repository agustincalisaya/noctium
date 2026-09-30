export type IndicadorMes = {
  mes: string;
  turnos: number;
};

export type RangoIndicadores = {
  desde: string;
  hasta: string;
  meses: number;
};

export type IndicadoresMensuales = {
  rango: RangoIndicadores;
  meses: IndicadorMes[];
};
