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

/** Estado de pago de una clase cobrable (spec_modulo_I.md §2.7.2). */
export type EstadoPagoCobrable = "RESERVADA" | "PAGO_SIN_REGISTRAR" | "SE_INSCRIBE_AL_PAGAR";

/** Fila del paso 2 de «Registrar pago» (HU-I-10). */
export type ClasePendienteDePago = {
  inscripcion_id: string | null;
  turno_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  materia: { id: string; nombre: string };
  profesor: { id: string; nombre_completo: string } | null;
  estado_pago: EstadoPagoCobrable;
  vence_el: string | null;
  precio: number;
  origen_precio: "INSCRIPCION" | "TARIFA_VIGENTE";
  marcada: boolean;
};

export type ClasesPendientesDePago = {
  alumno: AlumnoPago;
  clases: ClasePendienteDePago[];
  formas_pago: { id: string; nombre: string }[];
};

/** Respuesta 201 de POST /api/pagos/operaciones (§2.7.5). */
export type OperacionDePagoRegistrada = {
  operacion_id: string;
  alumno: { id: string; nombre_completo: string };
  forma_pago: { id: string; nombre: string };
  fecha_pago: string;
  total: string;
  pagos: {
    id: string;
    turno_id: string;
    inscripcion_id: string;
    materia: { id: string; nombre: string };
    fecha: string;
    hora_inicio: string;
    precio: number;
    monto: string;
    motivo_ajuste: string | null;
  }[];
  comprobante: { id: string; numero: string };
};
