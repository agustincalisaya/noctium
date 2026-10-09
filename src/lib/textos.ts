/**
 * Archivo central de textos (HU-C-23). Una clave por texto; la interfaz y los
 * errores de dominio leen de acá en vez de repetir literales.
 *
 * PR-0.md §2.13: los servicios no devuelven textos; lanzan
 * `ErrorDeDominio(clave)` y el texto sale de esta tabla. Para las condiciones
 * que ya existían en los Sprints 1 y 2 el texto es el literal que hoy devuelve
 * el endpoint (1.1). Los marcados «propuesto» no tienen literal en el backlog
 * ni en la spec: los fija el PR 0 y los puede ajustar la HU dueña.
 *
 * Los huecos se escriben `{nombre}` y se completan con `texto(clave, valores)`.
 */
export const TEXTOS = {
  // UI: cada módulo es dueño de ui.<modulo>.<grupo>.<nombre>.
  // ui.comun pertenece a los componentes compartidos; no a sus consumidores.
  "ui.comun.paginacion.nombre": "Paginación",
  "ui.comun.paginacion.pagina": "Página {pagina} de {totalPaginas}",
  "ui.comun.paginacion.paginaConTotal": "Página {pagina} de {totalPaginas} · {total} en total",
  "ui.comun.paginacion.rango": "Mostrando {desde}–{hasta} de {total}",
  "ui.comun.paginacion.anterior": "Anterior",
  "ui.comun.paginacion.siguiente": "Siguiente",
  "ui.comun.paginacion.paginaAnterior": "Página anterior",
  "ui.comun.paginacion.paginaSiguiente": "Página siguiente",
  "ui.comun.paginacion.numero": "Página {pagina}",
  "ui.comun.paginacion.elipsis": "…",
  // Módulo C: vocabulario para las pantallas del Sprint 3; legacy se conserva.
  "ui.turnos.clase.nombre": "Clase",
  "ui.turnos.estado.pendiente": "Pendiente",
  "ui.turnos.estado.disponible": "Disponible",
  "ui.turnos.estado.completa": "Completa",
  "ui.turnos.estado.cancelada": "Cancelada",
  // --- Transversales (PR-0.md §2.10) ---
  "errores.transaccion.ocupada": "Otra persona está modificando estos datos. Intentá de nuevo.",

  // --- Turnos: condiciones de los Sprints 1 y 2 (texto de hoy) ---
  "errores.turno.noEncontrado": "No se encontró el turno",
  "errores.turno.pendiente": "El turno está pendiente: los alumnos se cargan desde la asignación de participantes",
  "errores.turno.cancelado": "El turno está cancelado",
  "errores.turno.vencido": "El horario del turno ya pasó",
  "errores.turno.cupoInsuficiente": "El turno alcanzó su cupo máximo",
  "errores.turno.sinAula": "El turno no tiene aula asignada",
  "errores.alumno.noEncontrado": "El alumno ya no existe",
  "errores.alumno.inactivo": "La ficha del alumno está inactiva",
  "errores.alumno.inactivoPropio": "Tu ficha de alumno no está activa",
  "errores.inscripcion.alumnoYaAsignado": "El mismo alumno no puede agregarse dos veces al mismo turno",
  "errores.inscripcion.alumnoYaAsignadoPropio": "Ya estás inscripto en este turno",
  "errores.inscripcion.alumnoNoDisponible": "El alumno ya tiene un turno agendado en ese horario",
  "errores.inscripcion.alumnoNoDisponiblePropio": "Ya tenés otro turno en ese horario",
  "errores.inscripcion.alumnoNoAsignado": "El alumno no está inscripto en este turno",
  // Inscripción desde mesa de entrada de un alumno inexistente o inactivo (texto de hoy).
  "errores.inscripcion.alumnoNoDisponibleOInactivo": "El alumno no existe o no está activo",

  // --- Inscripción y reservas (spec_modulo_C.md §2.16.7) ---
  // Al alumno (P-C2).
  "errores.inscripcion.materiaSinTarifa": "Esta clase todavía no tiene precio. Comunicate con el centro.",
  // A mesa de entrada (spec_modulo_L.md 3.12).
  "errores.inscripcion.materiaSinTarifaCentro": "Esta materia todavía no tiene tarifa. Pedile al gerente que la defina.",
  "errores.reserva.previaSinPago":
    "Ya tuviste una reserva sin pagar en esta clase. Para volver a inscribirte, acercate al centro y abonala en el momento.",
  "errores.inscripcion.requierePago":
    "El alumno ya tuvo una reserva sin pagar en esta clase: se inscribe recién al confirmar el pago.",
  "errores.reserva.noPendiente": "Esta reserva ya no está pendiente: se pagó o venció.",
  "errores.inscripcion.cancelacionFueraDePlazo": "Ya no podés cancelar en línea. Comunicate con el centro",
  // propuesto
  "errores.inscripcion.noVigente": "La inscripción ya no está vigente.",
  // propuesto
  "errores.inscripcion.noEncontrada": "No se encontró la inscripción.",

  // --- Profesores: baja y cambio de profesor (spec_modulo_D.md, HU-D-08) ---
  "errores.profesor.conClasesFuturas": "No se puede desactivar: el profesor tiene {total} clases futuras",
  // propuesto
  "errores.profesor.yaInactivo": "El profesor ya está inactivo.",
  // propuesto
  "errores.profesor.yaActivo": "El profesor ya está activo.",
  // propuesto
  "errores.profesor.motivoRequerido": "Ingresá el motivo de la desactivación.",
  "errores.profesor.materiasDistintas":
    "Las clases seleccionadas son de distintas materias. Filtrá por materia (por ejemplo, solo Matemática I) para cambiar el profesor.",
  // propuesto
  "errores.profesor.destinoIgualOrigen": "Elegí un profesor distinto del actual.",
  // Condiciones de Sprint 1 y 2 (texto de hoy).
  "errores.profesor.inactivo": "El profesor no está activo",
  "errores.profesor.noEncontrado": "El profesor no existe",
  "errores.profesor.noDictaMateria": "El profesor no dicta la materia seleccionada",
  "errores.profesor.conflictoEdicion": "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.",

  // --- Cuentas (spec_modulo_A.md §2.6.1) ---
  "errores.cuenta.emailYaAsociado": "Ese email ya está asociado a otra cuenta",
  // propuesto
  "errores.cuenta.datosInvalidos": "Los datos de la cuenta no son válidos.",

  // --- Historial académico (spec_modulo_E.md §2.6 a §2.12; todos propuestos) ---
  "errores.asistencia.incompleta": "La asistencia tiene que indicar a cada alumno de la clase una sola vez.",
  "errores.asistencia.sinCambios": "La asistencia es la misma que la registrada.",
  "errores.observaciones.yaRegistradas": "Esta clase ya tiene observaciones registradas.",
  "errores.claseDictada.noEncontrada": "No se encontró la clase dictada.",
  "errores.claseDictada.noCorresponde": "La clase dictada no corresponde a esa materia o a ese alumno.",
  "errores.claseDictada.yaAnulada": "El registro de esta clase ya está anulado.",
  "errores.correccion.plazoVencido": "Pasó el plazo para que corrijas este registro. Pedile el cambio a mesa de entrada.",
  "errores.examen.resultadoNoEncontrado": "No se encontró el resultado de examen.",
  "errores.examen.resultadoAnulado": "El resultado de examen está anulado.",
  "errores.examen.correccionSinCambios": "La fecha y la nota son las mismas que las registradas.",
  // Condiciones de Sprint 2 del módulo E (texto de hoy).
  "errores.claseDictada.turnoNoAdmiteClase": "Solo se puede registrar una clase de un turno disponible o completo",
  "errores.claseDictada.noFinalizada": "La clase todavía no terminó",
  "errores.claseDictada.noRegistrada": "El turno todavía no tiene una clase dictada registrada",
  "errores.examen.materiaNoCursada": "El alumno todavía no cursó esta materia",
  "errores.examen.fechaFutura": "La fecha del examen no puede ser futura",
  "errores.examen.notaFueraDeRango": "La nota debe estar entre {min} y {max}",
  "errores.historial.alumnoNoEncontrado": "No se encontró el alumno",
  "errores.historial.alumnoInactivo": "El alumno está inactivo",

  // --- Pagos: condiciones de Sprint 2 (texto de hoy, POST /api/pagos) ---
  "errores.pago.turnoNoAdmitePago": "Solo se pueden registrar pagos en turnos disponibles o completos",
  "errores.pago.alumnoNoInscripto": "El alumno no está inscripto en este turno",
  "errores.formaPago.noEncontrada": "No se encontró la forma de pago",
  "errores.formaPago.noDisponible": "La forma de pago ya no está disponible",
  "errores.pago.fechaFutura": "La fecha de pago no puede ser futura",

  // --- Pagos y comprobantes (spec_modulo_I.md §2.7.6, §2.9.5, §2.14.5) ---
  "errores.pago.turnoYaEmpezo": "La clase de {materia} del {fecha_dia} ya empezó: el pago se hace antes de la clase.",
  "errores.pago.reservaVencida": "La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo.",
  // propuesto
  "errores.pago.inscripcionYaPagada": "Esta clase ya tiene un pago registrado.",
  // propuesto
  "errores.pago.motivoAjusteRequerido": "El monto es distinto del precio de la clase: ingresá el motivo del ajuste.",
  // propuesto
  "errores.pago.noEncontrado": "No se encontró el pago.",
  // propuesto
  "errores.pago.anulado": "El pago está anulado: no se puede corregir.",
  // propuesto
  "errores.pago.yaAnulado": "El pago ya estaba anulado.",
  // propuesto
  "errores.pago.sinCambios": "Los valores son los mismos que los vigentes.",
  // propuesto
  "errores.pago.fueraDeAlcance": "No podés modificar este pago.",
  // propuesto
  "errores.comprobante.noEncontrado": "No se encontró el comprobante.",

  // --- Caja (spec_modulo_I.md §2.10.5, HU-I-12) ---
  "errores.caja.sinCajaAbierta": "No se puede registrar un cobro hasta que abras una caja.",
  "errores.caja.cerradaDuranteCobro": "Tu caja se cerró. Abrí una caja nueva para registrar el cobro.",
  "errores.caja.cambio": "La caja cambió mientras cerrabas. Revisá el resumen.",
  "errores.caja.ajusteSinCajaAbierta": "Para registrar este cambio tiene que haber una caja abierta en mesa de entrada.",
  "errores.caja.efectivoYaDeclarado": "Ya declaraste el efectivo: desde ese momento el monto declarado no se puede cambiar.",
  // propuestos
  "errores.caja.yaAbierta": "Ya tenés una caja abierta.",
  "errores.caja.integranteInactivo": "Tu ficha de mesa de entrada no está activa.",
  "errores.caja.yaCerrada": "La caja ya está cerrada.",
  "errores.caja.noCerrada": "La caja sigue abierta: su cierre todavía no se puede consultar.",
  "errores.caja.noEncontrada": "No se encontró la caja.",
  "errores.caja.efectivoNoDeclarado": "Primero declará el efectivo contado.",
  "errores.caja.motivoDiferenciaRequerido": "La caja tiene diferencia: ingresá el motivo.",
  "errores.caja.fueraDeAlcance": "No podés operar sobre la caja de otro integrante.",
  "errores.caja.movimientoNoEncontrado": "No se encontró el movimiento.",
  "errores.caja.movimientoYaAnulado": "El movimiento ya estaba anulado.",
  "errores.caja.egresoSuperaEfectivo": "El egreso supera el efectivo de la caja.",
  "errores.caja.anulacionDejaEfectivoNegativo": "No se puede anular: la caja quedaría con efectivo negativo.",

  // --- Índice de presentismo (HU-H-07; textos propuestos conforme a spec H §2.6) ---
  "indicadores.presentismo.titulo": "Índice de presentismo",
  "indicadores.presentismo.mensual": "Inscriptos vs. presentes por mes",
  "indicadores.presentismo.materia": "Por materia",
  "indicadores.presentismo.leyenda": "Clases dictadas con asistencia individual. Sobre cada par, los ausentes.",
  "indicadores.presentismo.ordenMateria": "De menor a mayor índice de presentismo",
  "indicadores.presentismo.sinControl": "{cantidad} clases dictadas sin control de asistencia no se incluyen en el índice.",
  "indicadores.presentismo.tabla": "Alumnos con presentismo bajo",
  "indicadores.presentismo.umbral": "Índice de presentismo menor a {umbral} %, con al menos {minimo} clases dictadas en la materia en el período.",
  "indicadores.presentismo.vacio": "No hay datos para el período seleccionado",
  "indicadores.presentismo.tablaVacia": "No hay alumnos con presentismo bajo en el período.",
  "indicadores.presentismo.error": "No se pudo cargar el índice de presentismo. Intentá nuevamente.",
  "indicadores.presentismo.cargando": "Cargando índice de presentismo…",
  "indicadores.presentismo.inscripcionesUnidad": "inscripciones",
  "indicadores.presentismo.presenciasUnidad": "presencias",
  "indicadores.presentismo.inactiva": "inactiva",
  "indicadores.presentismo.ausentes": "ausentes",
  "indicadores.presentismo.inscriptos": "Inscriptos",
  "indicadores.presentismo.presentes": "Presentes",
  "indicadores.presentismo.alumno": "Alumno",
  "indicadores.presentismo.materiaColumna": "Materia",
  "indicadores.presentismo.clases": "Clases dictadas",
  "indicadores.presentismo.ausencias": "Ausencias",
  "indicadores.presentismo.historial": "Historial académico",
  "indicadores.presentismo.reintentar": "Reintentar",

  // --- Formas de pago (spec_modulo_I.md §2.16.4) ---
  "errores.formaPago.ultimaActiva": "Debe quedar al menos una forma de pago activa",
  "errores.formaPago.nombreDuplicado": "Ya existe una forma de pago con ese nombre.",
  // propuestos
  "errores.formaPago.yaActiva": "La forma de pago ya está activa.",
  "errores.formaPago.yaInactiva": "La forma de pago ya está inactiva.",
  "errores.formaPago.motivoRequerido": "La forma de pago tiene pagos registrados: ingresá el motivo.",
} as const;

export type ClaveTexto = keyof typeof TEXTOS;

/** Texto de `clave` con sus huecos `{nombre}` completados. Un hueco sin valor queda tal cual. */
export function texto(clave: ClaveTexto, valores?: Record<string, unknown>): string {
  if (!Object.prototype.hasOwnProperty.call(TEXTOS, clave)) {
    console.warn(clave);
    return clave;
  }
  const plantilla: string = TEXTOS[clave];
  if (!valores) return plantilla;
  return plantilla.replace(/\{(\w+)\}/g, (hueco, nombre: string) =>
    valores[nombre] === undefined || valores[nombre] === null ? hueco : String(valores[nombre]),
  );
}
