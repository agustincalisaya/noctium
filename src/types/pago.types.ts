/** Ítem del listado de gestión de formas de pago (spec_modulo_I.md §2.2). */
export type FormaPagoListado = {
  id: string;
  nombre: string;
  is_active: boolean;
};

export type PaginacionFormasPago = {
  total: number;
  pagina_actual: number;
  total_paginas: number;
  por_pagina: number;
};

export type ListadoFormasPago = {
  items: FormaPagoListado[];
  paginacion: PaginacionFormasPago;
};

export type PagoRegistrado = {
  id: string;
  turno_id: string;
  alumno: { id: string; nombre_completo: string };
  monto: string;
  forma_pago: { id: string; nombre: string };
  fecha_pago: string;
};

export type PagoDeTurno = Omit<PagoRegistrado, "turno_id"> & { registrado_en: string };

export type AlumnoPago = {
  id: string;
  nombre_completo: string;
  dni: string;
  forma_pago_preferida_id: string | null;
};

export type OpcionesPago = {
  alumnos: AlumnoPago[];
  formas_pago: { id: string; nombre: string }[];
  preseleccionar_alumno_id?: string;
};
