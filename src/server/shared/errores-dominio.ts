import type { ClaveTexto } from "@/lib/textos";

/**
 * Catálogo de errores de dominio (PR-0.md §2.13): clave del archivo central de
 * textos → `code` estable que ve la API y su HTTP.
 *
 * Cuando la condición ya existía en los Sprints 1 y 2, `code` es el mismo que
 * hoy devuelve el endpoint (1.1): los Route Handlers existentes, que mapean por
 * `error.code`, siguen sin cambios. Varias claves pueden compartir un `code`
 * cuando el texto depende de quién opera (alumno o mesa de entrada).
 */
export const ERRORES_DE_DOMINIO = {
  "errores.transaccion.ocupada": { code: "TRANSACCION_OCUPADA", status: 409 },

  // Turnos e inscripción: condiciones existentes (mismo code de hoy).
  "errores.turno.noEncontrado": { code: "TURNO_NO_ENCONTRADO", status: 404 },
  "errores.turno.pendiente": { code: "TURNO_PENDIENTE", status: 409 },
  "errores.turno.cancelado": { code: "TURNO_CANCELADO", status: 409 },
  "errores.turno.vencido": { code: "TURNO_VENCIDO", status: 409 },
  "errores.turno.cupoInsuficiente": { code: "CUPO_INSUFICIENTE", status: 409 },
  "errores.turno.sinAula": { code: "TURNO_SIN_AULA", status: 409 },
  "errores.alumno.noEncontrado": { code: "ALUMNO_NO_ENCONTRADO", status: 404 },
  "errores.alumno.inactivo": { code: "ALUMNO_INACTIVO", status: 409 },
  "errores.alumno.inactivoPropio": { code: "ALUMNO_INACTIVO", status: 409 },
  "errores.inscripcion.alumnoYaAsignado": { code: "ALUMNO_YA_ASIGNADO", status: 409 },
  "errores.inscripcion.alumnoYaAsignadoPropio": { code: "ALUMNO_YA_ASIGNADO", status: 409 },
  "errores.inscripcion.alumnoNoDisponible": { code: "ALUMNO_NO_DISPONIBLE", status: 409 },
  "errores.inscripcion.alumnoNoDisponiblePropio": { code: "ALUMNO_NO_DISPONIBLE", status: 409 },
  "errores.inscripcion.alumnoNoAsignado": { code: "ALUMNO_NO_ASIGNADO", status: 404 },
  "errores.inscripcion.alumnoNoDisponibleOInactivo": { code: "ALUMNO_NO_DISPONIBLE", status: 409 },

  // Módulo C (spec_modulo_C.md §2.16.7).
  "errores.inscripcion.materiaSinTarifa": { code: "MATERIA_SIN_TARIFA", status: 422 },
  "errores.inscripcion.materiaSinTarifaCentro": { code: "MATERIA_SIN_TARIFA", status: 422 },
  "errores.reserva.previaSinPago": { code: "RESERVA_PREVIA_SIN_PAGO", status: 409 },
  "errores.inscripcion.requierePago": { code: "INSCRIPCION_REQUIERE_PAGO", status: 409 },
  "errores.reserva.noPendiente": { code: "RESERVA_NO_PENDIENTE", status: 409 },
  "errores.inscripcion.noVigente": { code: "INSCRIPCION_NO_VIGENTE", status: 409 },
  "errores.inscripcion.cancelacionFueraDePlazo": { code: "CANCELACION_FUERA_DE_PLAZO", status: 409 },
  "errores.inscripcion.noEncontrada": { code: "INSCRIPCION_NO_ENCONTRADA", status: 404 },

  // Módulo D (spec_modulo_D.md, HU-D-08).
  "errores.profesor.conClasesFuturas": { code: "PROFESOR_CON_CLASES_FUTURAS", status: 409 },
  "errores.profesor.yaInactivo": { code: "PROFESOR_YA_INACTIVO", status: 409 },
  "errores.profesor.yaActivo": { code: "PROFESOR_YA_ACTIVO", status: 409 },
  "errores.profesor.motivoRequerido": { code: "MOTIVO_REQUERIDO", status: 400 },
  "errores.profesor.materiasDistintas": { code: "MATERIAS_DISTINTAS", status: 400 },
  "errores.profesor.destinoIgualOrigen": { code: "PROFESOR_DESTINO_IGUAL_ORIGEN", status: 400 },

  // Módulo E (spec_modulo_E.md §2.6 a §2.12).
  "errores.asistencia.incompleta": { code: "ASISTENCIA_INCOMPLETA", status: 400 },
  "errores.asistencia.sinCambios": { code: "ASISTENCIA_SIN_CAMBIOS", status: 409 },
  "errores.observaciones.yaRegistradas": { code: "OBSERVACIONES_YA_REGISTRADAS", status: 409 },
  "errores.claseDictada.noEncontrada": { code: "CLASE_DICTADA_NO_ENCONTRADA", status: 404 },
  "errores.claseDictada.noCorresponde": { code: "CLASE_DICTADA_NO_CORRESPONDE", status: 409 },
  "errores.claseDictada.yaAnulada": { code: "CLASE_DICTADA_YA_ANULADA", status: 409 },
  "errores.correccion.plazoVencido": { code: "PLAZO_CORRECCION_VENCIDO", status: 403 },
  "errores.examen.resultadoNoEncontrado": { code: "RESULTADO_NO_ENCONTRADO", status: 404 },
  "errores.examen.resultadoAnulado": { code: "RESULTADO_ANULADO", status: 409 },
  "errores.examen.correccionSinCambios": { code: "CORRECCION_SIN_CAMBIOS", status: 409 },

  // Módulo I: condiciones de Sprint 2 (mismo code y texto de POST /api/pagos).
  "errores.pago.turnoNoAdmitePago": { code: "TURNO_NO_ADMITE_PAGO", status: 409 },
  "errores.pago.alumnoNoInscripto": { code: "ALUMNO_NO_INSCRIPTO", status: 409 },
  "errores.formaPago.noEncontrada": { code: "FORMA_PAGO_NO_ENCONTRADA", status: 404 },
  "errores.formaPago.noDisponible": { code: "FORMA_PAGO_NO_DISPONIBLE", status: 409 },
  "errores.pago.fechaFutura": { code: "FECHA_PAGO_FUTURA", status: 400 },

  // Módulo I (spec_modulo_I.md §2.7.6, §2.9.5, §2.10.5, §2.14.5, §2.16.4).
  "errores.pago.turnoYaEmpezo": { code: "TURNO_YA_EMPEZO", status: 409 },
  "errores.pago.reservaVencida": { code: "RESERVA_VENCIDA", status: 409 },
  "errores.pago.inscripcionYaPagada": { code: "INSCRIPCION_YA_PAGADA", status: 409 },
  "errores.pago.motivoAjusteRequerido": { code: "MOTIVO_AJUSTE_REQUERIDO", status: 400 },
  "errores.pago.noEncontrado": { code: "PAGO_NO_ENCONTRADO", status: 404 },
  "errores.pago.anulado": { code: "PAGO_ANULADO", status: 409 },
  "errores.pago.yaAnulado": { code: "PAGO_YA_ANULADO", status: 409 },
  "errores.pago.sinCambios": { code: "SIN_CAMBIOS", status: 400 },
  "errores.pago.fueraDeAlcance": { code: "FUERA_DE_ALCANCE", status: 403 },
  "errores.comprobante.noEncontrado": { code: "COMPROBANTE_NO_ENCONTRADO", status: 404 },
  "errores.caja.sinCajaAbierta": { code: "CAJA_NO_ABIERTA", status: 409 },
  "errores.caja.cerradaDuranteCobro": { code: "CAJA_NO_ABIERTA", status: 409 },
  "errores.caja.cambio": { code: "CAJA_CAMBIO", status: 409 },
  "errores.caja.ajusteSinCajaAbierta": { code: "CAJA_DE_AJUSTE_NO_ABIERTA", status: 409 },
  "errores.caja.efectivoYaDeclarado": { code: "EFECTIVO_YA_DECLARADO", status: 409 },
  "errores.caja.yaAbierta": { code: "CAJA_YA_ABIERTA", status: 409 },
  "errores.caja.integranteInactivo": { code: "INTEGRANTE_INACTIVO", status: 409 },
  "errores.caja.yaCerrada": { code: "CAJA_YA_CERRADA", status: 409 },
  "errores.caja.noCerrada": { code: "CAJA_NO_CERRADA", status: 409 },
  "errores.caja.noEncontrada": { code: "CAJA_NO_ENCONTRADA", status: 404 },
  "errores.caja.efectivoNoDeclarado": { code: "EFECTIVO_NO_DECLARADO", status: 409 },
  "errores.caja.motivoDiferenciaRequerido": { code: "MOTIVO_DIFERENCIA_REQUERIDO", status: 400 },
  "errores.caja.fueraDeAlcance": { code: "FUERA_DE_ALCANCE", status: 403 },
  "errores.caja.movimientoNoEncontrado": { code: "MOVIMIENTO_NO_ENCONTRADO", status: 404 },
  "errores.caja.movimientoYaAnulado": { code: "MOVIMIENTO_YA_ANULADO", status: 409 },
  "errores.caja.egresoSuperaEfectivo": { code: "EGRESO_SUPERA_EFECTIVO", status: 409 },
  "errores.caja.anulacionDejaEfectivoNegativo": { code: "ANULACION_DEJA_EFECTIVO_NEGATIVO", status: 409 },
  "errores.formaPago.ultimaActiva": { code: "ULTIMA_FORMA_PAGO_ACTIVA", status: 409 },
  "errores.formaPago.yaActiva": { code: "FORMA_PAGO_YA_ACTIVA", status: 409 },
  "errores.formaPago.yaInactiva": { code: "FORMA_PAGO_YA_INACTIVA", status: 409 },
  "errores.formaPago.motivoRequerido": { code: "MOTIVO_REQUERIDO", status: 400 },
} as const satisfies Partial<Record<ClaveTexto, { code: string; status: 400 | 403 | 404 | 409 | 422 }>>;

export type CodigoErrorDominio = keyof typeof ERRORES_DE_DOMINIO;
