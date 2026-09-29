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
