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

/**
 * Comprobante tal como lo muestran `GET /api/comprobantes/[id]` y sus dos
 * variantes (spec_modulo_I.md §2.9.3). Las marcas se derivan al leer (§2.9.4).
 * Vista del alumno: sin `registrado_por` (lleva `registrado_en_el_centro`) y
 * sin el motivo de la anulación.
 */
export type ComprobanteLeido = {
  id: string;
  /** «0001-NNNNNNNN». */
  numero: string;
  /** ISO 8601 con el offset del centro. */
  emitido_el: string;
  centro: { nombre: string; domicilio: string; telefono: string };
  /** `nombre_completo` en formato «Apellido, Nombre». */
  alumno: { nombre_completo: string; dni: string };
  /** `YYYY-MM-DD`. */
  fecha_pago: string;
  forma_pago: { nombre: string };
  /** Vista completa: nombre real, o `null` si la cuenta no tiene ficha del personal. */
  registrado_por?: string | null;
  registrado_en_el_centro?: true;
  clases: { materia: string; fecha: string; hora_inicio: string; monto: string }[];
  total: string;
  marcas: {
    /** `fecha` `YYYY-MM-DD`; `motivo` ausente en la vista del alumno. */
    anulado: { fecha: string; motivo?: string } | null;
    reemplazado_por: { id: string; numero: string } | null;
    reemplaza_a: { numero: string } | null;
  };
};

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

/** HU-I-02: las dos respuestas de la pestaña Pagos. */
export type PaginacionHistorialPagos = { total: number; pagina_actual: number; total_paginas: number; por_pagina: 10 };
export type PagoHistorialItem = {
  pago_id: string;
  fecha_pago: string;
  registrado_en: string;
  clase: { turno_id: string; fecha: string; hora_inicio: string; materia: { id: string; nombre: string } };
  precio: number;
  monto: string;
  monto_original: string | null;
  forma_pago: { id: string; nombre: string; is_active: boolean };
  registrado_por: { usuario_id: string; nombre_completo: string | null };
  ajuste: { motivo: string; ajustado_por: { usuario_id: string; nombre_completo: string | null } } | null;
  anulado: boolean;
  comprobante: { id: string; numero: string } | null;
  operacion: { id: string; clases: number };
  cambios: number;
  puede_corregir: boolean;
};
export type EstadoPagoHistorialItem = {
  inscripcion_id: string;
  turno_id: string;
  fecha: string;
  hora_inicio: string;
  materia: { id: string; nombre: string };
  profesor: { id: string; nombre_para_mostrar: string } | null;
  precio: number;
  estado_pago: "PAGADA" | "RESERVADA" | "PAGO_SIN_REGISTRAR";
  vence_el: string | null;
  puede_registrar_pago: boolean;
};
export type HistorialPagosData =
  | { modo: "HISTORIAL"; total_pagado: string; items: PagoHistorialItem[]; paginacion: PaginacionHistorialPagos }
  | { modo: "ESTADO_DE_PAGO"; items: EstadoPagoHistorialItem[]; paginacion: PaginacionHistorialPagos };
export type OpcionesHistorialPagos = {
  formas_pago: { id: string; nombre: string; is_active: boolean }[];
  materias: { id: string; nombre: string }[];
};
/** HU-I-06: respuesta de `POST /api/pagos/[id]/correccion` (spec_modulo_I.md §2.14.2), con los valores vigentes. */
export type PagoCorregidoDto = {
  pago_id: string;
  monto: string;
  forma_pago: { id: string; nombre: string; is_active: boolean };
  /** `YYYY-MM-DD`. */
  fecha_pago: string;
  /** Pagos no anulados de la operación (aviso «alcanza a N clases»). */
  clases_abarcadas: number;
  /** El último comprobante de reemplazo emitido. */
  comprobante: { id: string; numero: string };
};

/** HU-I-06: respuesta de `POST /api/pagos/[id]/anulacion` (spec_modulo_I.md §2.14.3). */
export type PagoAnuladoDto = {
  pago_id: string;
  anulado: true;
  inscripcion: {
    id: string;
    estado_pago: "PAGADA" | "RESERVADA" | "PAGO_SIN_REGISTRAR";
    /** ISO con el offset del centro; `null` si no se reabrió ninguna reserva. */
    vence_el: string | null;
  };
  /** `null` si no se emitió ninguno (el vigente queda «ANULADO»). */
  comprobante: { id: string; numero: string; reemplazo: true } | null;
};

export type TipoCambioPago = "CORRECCION_MONTO" | "CORRECCION_FORMA" | "CORRECCION_FECHA" | "ANULACION";

/** Usuario del personal; `nombre_completo` es `null` si la cuenta no tiene ficha. */
export type PersonaHistorialPago = { usuario_id: string; nombre_completo: string | null };

/** HU-I-06: `GET /api/pagos/[id]/historial` (DEC-27, spec_modulo_I.md §2.14.6). */
export type HistorialPagoDto = {
  /** Valores vigentes del pago y quién y cuándo lo registró. */
  registro: {
    monto: string;
    forma_pago: { id: string; nombre: string };
    fecha_pago: string;
    registrado_por: PersonaHistorialPago;
    /** ISO con el offset del centro. */
    registrado_en: string;
  };
  /**
   * Cada evento con su propio anterior → nuevo, tal como quedó grabado: el
   * monto como decimal, la forma por su nombre y la fecha `YYYY-MM-DD`. En la
   * anulación, `valor_anterior` es el monto vigente del pago y `valor_nuevo`
   * es `null`. Más nuevos primero.
   */
  cambios: {
    tipo: TipoCambioPago;
    valor_anterior: string | null;
    valor_nuevo: string | null;
    motivo: string;
    /** `null` solo si la anuló un proceso automático (sin usuario). */
    usuario: PersonaHistorialPago | null;
    /** ISO con el offset del centro. */
    fecha: string;
  }[];
};
