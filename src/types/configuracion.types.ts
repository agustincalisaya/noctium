import type { CampoConfigurable, ClaveConfigurable } from "@/server/configuracion/parametros-configurables";

export type ValoresConfiguracion = Record<CampoConfigurable, number>;
export type ParametroConfiguracion = {
  clave: ClaveConfigurable;
  campo: CampoConfigurable;
  valor: number;
  unidad: "h" | "%";
  min: number;
  max: number;
  porDefecto: number;
};
export type EntradaHistorialConfiguracion = {
  id: string;
  clave: ClaveConfigurable;
  valorAnterior: number;
  valorNuevo: number;
  usuario: { id: string; nombre: string };
  fecha: string;
};
export type HistorialConfiguracion = {
  items: EntradaHistorialConfiguracion[];
  pagina: number;
  por_pagina: 10;
  total: number;
  total_paginas: number;
};
