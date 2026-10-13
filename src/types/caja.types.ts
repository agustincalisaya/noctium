/**
 * Tipos de la caja de mesa de entrada (HU-I-12, spec_modulo_I.md §2.10 a
 * §2.12): las formas de las respuestas de `/api/cajas/**` que consumen las
 * pantallas «Mi caja» y «Cierres de caja». Los montos son texto decimal con
 * 2 decimales ("5000.00") y los instantes, ISO con el offset del centro.
 */

export type TipoDiferenciaCaja = "SOBRANTE" | "FALTANTE" | "CUADRA";

export type FormaPagoEnResumen = { id: string; nombre: string; es_efectivo: boolean };

/** Resumen del criterio 6 (el mismo que arma `calcularResumen`). */
export type ResumenCajaDto = {
  fondo_inicial: string;
  cobros_por_forma: { forma_pago: FormaPagoEnResumen; cantidad: number; total: string }[];
  ingresos_manuales: string;
  egresos_manuales: string;
  ajustes: { forma_pago: FormaPagoEnResumen; total: string }[];
  efectivo_esperado: string;
  efectivo_declarado: string | null;
  diferencia: string | null;
  tipo_diferencia: TipoDiferenciaCaja | null;
};

/** Resumen del paso 2 del cierre: con la huella que se devuelve al confirmar. */
export type ResumenCierreDto = {
  caja_id: string;
  abierta_el: string;
  integrante: { id: string; nombre_completo: string | null };
  resumen: ResumenCajaDto;
  huella: string;
};

/** Un ítem de la caja abierta (arqueo ciego): monto individual, sin totales. */
export type ItemCajaDto =
  | {
    tipo: "COBRO"; id: string; momento: string; detalle: string;
    forma_pago: { id: string; nombre: string }; monto: string; anulado: boolean;
  }
  | {
    tipo: "MOVIMIENTO"; id: string; momento: string; detalle: string;
    movimiento: "INGRESO" | "EGRESO"; monto: string; anulado: boolean;
  }
  | {
    tipo: "AJUSTE"; id: string; momento: string; detalle: string; origen: "CORRECCION" | "ANULACION";
    forma_pago: { id: string; nombre: string }; monto: string; anulado: false;
  };

/** Movimiento manual recién registrado (`POST /api/cajas/mia/movimientos`, HU-I-12-b). */
export type MovimientoCajaDto = { id: string; tipo: "INGRESO" | "EGRESO"; monto: string; concepto: string; momento: string };

/** La caja abierta propia (`GET /api/cajas/mia`). */
export type CajaPropiaDto = {
  id: string;
  abierta_el: string;
  fondo_inicial: string;
  efectivo_declarado: string | null;
  items: ItemCajaDto[];
};

export type IntegranteCaja = { id: string; nombre_completo: string | null };

/** Una fila de «Mis cierres» o de los cierres del gerente. */
export type CierreCajaFila = {
  id: string;
  integrante: IntegranteCaja;
  abierta_el: string;
  cerrada_el: string;
  fondo_inicial: string;
  efectivo_esperado: string;
  efectivo_declarado: string;
  diferencia: string;
  tipo_diferencia: TipoDiferenciaCaja;
  motivo: string | null;
  por_ausencia: boolean;
  /** El gerente que cerró por ausencia; `null` si la cerró el propio integrante. */
  cerrada_por: IntegranteCaja | null;
};

export type PaginacionCaja = { total: number; pagina_actual: number; total_paginas: number; por_pagina: number };

export type CierresPaginados = { items: CierreCajaFila[]; paginacion: PaginacionCaja };

export type CajaAbiertaFila = { id: string; integrante: IntegranteCaja; abierta_el: string; antiguedad_minutos: number };

/** Listado del gerente (`GET /api/cajas`). */
export type CajasYCierresDto = { abiertas: CajaAbiertaFila[]; cierres: CierresPaginados };

/** Detalle de un cierre: el resumen tal como quedó al cerrar, más los datos del centro para imprimir. */
export type DetalleCierreDto = CierreCajaFila & {
  resumen: ResumenCajaDto;
  centro: { nombre: string; domicilio: string; telefono: string };
};

/** Respuesta del cierre (`POST .../cierre`). */
export type CajaCerradaDto = {
  caja_id: string;
  estado: "CERRADA";
  cerrada_el: string;
  diferencia: string;
  tipo_diferencia: TipoDiferenciaCaja;
  por_ausencia: boolean;
};
