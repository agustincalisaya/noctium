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
  "ui.historial.clasesAlumno.tab": "Clases",
  "ui.historial.clasesAlumno.resultado": "Resultado",
  "ui.historial.clasesAlumno.todos": "Todos",
  "ui.historial.clasesAlumno.desde": "Desde",
  "ui.historial.clasesAlumno.hasta": "Hasta",
  "ui.historial.clasesAlumno.proxima": "Próxima",
  "ui.historial.clasesAlumno.asistio": "Asistió",
  "ui.historial.clasesAlumno.ausente": "Ausente",
  "ui.historial.clasesAlumno.sinRegistrarComoDictada": "Sin registrar como dictada",
  "ui.historial.clasesAlumno.canceladaCentro": "Cancelada por el centro",
  "ui.historial.clasesAlumno.canceladaAlumno": "Cancelada por el alumno",
  "ui.historial.clasesAlumno.reservaVencida": "Reserva vencida",
  "ui.historial.clasesAlumno.bajaAlumno": "Baja del alumno",
  "ui.historial.clasesAlumno.quitadaCentro": "Quitada por el centro",
  "ui.historial.clasesAlumno.porcentaje": "% de asistencia",
  "ui.historial.clasesAlumno.denominador": "{presentes} de {total} clases dictadas con control",
  "ui.historial.clasesAlumno.sinControl": "Asistió (sin control de asistencia)",
  "ui.historial.clasesAlumno.fecha": "Fecha",
  "ui.historial.clasesAlumno.hora": "Hora",
  "ui.historial.clasesAlumno.materia": "Materia",
  "ui.historial.clasesAlumno.profesor": "Profesor",
  "ui.historial.clasesAlumno.aula": "Aula",
  "ui.historial.clasesAlumno.vacio": "Este alumno todavía no tiene clases registradas",
  "ui.historial.clasesAlumno.sinCoincidencias": "No se encontraron clases para los filtros elegidos",
  "ui.historial.clasesAlumno.sinPagina": "No hay clases en esta página.",
  "ui.historial.clasesAlumno.limpiar": "Limpiar filtros",
  "ui.historial.clasesAlumno.primera": "Volver a la primera página",
  "ui.historial.clasesAlumno.cargando": "Cargando clases…",
  "ui.historial.clasesAlumno.error": "No se pudieron cargar las clases. Intentá nuevamente.",
  "ui.historial.clasesAlumno.reintentar": "Reintentar",
  "ui.historial.clasesAlumno.rangoInvalido": "«Desde» no puede ser posterior a «Hasta»",
  "ui.historial.clasesAlumno.consulta": "Modo consulta: no editás datos, no inscribís ni registrás pagos.",
  "ui.historial.clasesAlumno.volverClase": "Volver a la clase",
  "ui.historial.clasesAlumno.tabla": "Historial de clases",
  "ui.historial.clasesAlumno.sinDato": "—",
  "ui.historial.propio.titulo": "Mi historial",
  "ui.historial.propio.subtitulo": "Tus clases dictadas, resultados de examen e indicaciones.",
  "ui.historial.propio.materia": "Materia",
  "ui.historial.propio.todas": "Todas",
  "ui.historial.propio.registros": "{total} registros",
  "ui.historial.propio.asistencia": "Asistencia por materia",
  "ui.historial.propio.porcentaje": "{porcentaje}% de asistencia",
  "ui.historial.propio.sinControlPorcentaje": "Sin clases con control de asistencia",
  "ui.historial.propio.clase": "Clase dictada",
  "ui.historial.propio.examen": "Examen",
  "ui.historial.propio.indicacion": "Indicación",
  "ui.historial.propio.presente": "Asistió",
  "ui.historial.propio.ausente": "Ausente",
  "ui.historial.propio.sinControl": "Asistió (sin control de asistencia)",
  "ui.historial.propio.temas": "Temas vistos",
  "ui.historial.propio.vacio": "Todavía no tenés historial académico",
  "ui.historial.propio.sinCoincidencias": "No hay registros para esta materia.",
  "ui.historial.propio.sinPagina": "No hay registros en esta página.",
  "ui.historial.propio.cargando": "Cargando historial…",
  "ui.historial.propio.error": "No se pudo cargar tu historial. Intentá nuevamente.",
  "ui.historial.propio.reintentar": "Reintentar",
  "ui.historial.propio.volver": "Mis turnos",
  "ui.historial.propio.timeline": "Registros académicos",
  "ui.historial.correccionClase.corregir": "Corregir asistencia",
  "ui.historial.correccionClase.motivoCorreccion": "Motivo de la corrección",
  "ui.historial.correccionClase.motivo": "Motivo",
  "ui.historial.correccionClase.placeholderCorreccion": "Ej.: se marcó ausente por error",
  "ui.historial.correccionClase.placeholderAnulacion": "Ej.: la clase no se dio por un corte de luz",
  "ui.historial.correccionClase.guardar": "Guardar corrección",
  "ui.historial.correccionClase.cancelar": "Cancelar",
  "ui.historial.correccionClase.volver": "Volver",
  "ui.historial.correccionClase.anular": "Anular registro",
  "ui.historial.correccionClase.accionAnular": "Anular registro de clase dictada",
  "ui.historial.correccionClase.tituloAnular": "¿Estás seguro de que querés anular el registro de clase dictada de {materia} del {fecha} a las {hora}?",
  "ui.historial.correccionClase.detalleAnular": "La clase vuelve a “Sin registrar como dictada”, deja de aparecer en el historial académico y en los indicadores, y sus observaciones quedan ocultas. Los resultados de examen no cambian y las indicaciones se conservan sin el vínculo a esta clase. Esta acción no se puede deshacer.",
  "ui.historial.correccionClase.tituloCorregir": "¿Estás seguro de que querés corregir la asistencia de {materia} del {fecha}?",
  "ui.historial.correccionClase.guardada": "Asistencia corregida correctamente",
  "ui.historial.correccionClase.anulada": "Registro de clase dictada anulado",
  "ui.historial.correccionClase.plazo": "Pasaron más de 7 días desde la clase. Solo mesa de entrada puede corregir la asistencia o anular el registro.",
  "ui.historial.correccionClase.obligatorio": "El motivo es obligatorio",
  "ui.historial.correccionClase.procesando": "Procesando…",
  "ui.historial.correccionClase.error": "No se pudo completar la acción. Intentá nuevamente.",
  "ui.historial.correccionClase.alumno": "Alumno",
  "ui.historial.correccionClase.asistencia": "Asistencia",

  // --- Asistencia individual (HU-E-09) ---
  "ui.historial.asistencia.presente": "Presente",
  "ui.historial.asistencia.ausente": "Ausente",
  "ui.historial.asistencia.asistio": "Asistió",
  "ui.historial.asistencia.sinControl": "Asistió (sin control de asistencia)",
  "ui.historial.asistencia.marcarAusentes": "Marcar todos ausentes",
  "ui.historial.asistencia.marcarPresentes": "Marcar todos presentes",
  "ui.historial.asistencia.totales": "{presentes} presentes · {ausentes} ausentes",
  "ui.historial.asistencia.registrar": "Registrar clase dictada",
  "ui.historial.asistencia.registrando": "Registrando…",
  "ui.historial.asistencia.confirmar": "¿Registrar la clase de {materia} del {fecha}?",
  "ui.historial.asistencia.confirmacion": "Horario: {horaInicio}–{horaFin}. Presentes: {presentes}. Ausentes: {ausentes}.",
  "ui.historial.asistencia.fechaRegistro": "Clase dictada registrada el {fecha}.",
  "ui.historial.asistencia.estadoNoElegible": "Solo se puede registrar una clase disponible o completa.",
  "ui.historial.asistencia.pendienteRegistro": "La clase ya pasó y todavía no se registró.",
  "ui.historial.asistencia.guardada": "Clase dictada registrada correctamente",
  "ui.historial.asistencia.errorRegistro": "No se pudo registrar la clase dictada. Intentá nuevamente.",
  "ui.historial.asistencia.errorLectura": "No se pudo consultar la asistencia. Intentá nuevamente.",
  "ui.historial.asistencia.cargando": "Cargando asistencia…",
  "ui.historial.asistencia.resumen": "Asistencia por materia",
  "ui.historial.asistencia.porcentaje": "{porcentaje} % de asistencia",
  "ui.historial.asistencia.soloSinControl": "Sin clases con control de asistencia",
  "ui.historial.asistencia.excluidas": "{cantidad} clases sin control excluidas del porcentaje",
  "ui.historial.asistencia.esperarFin": "Podés registrarla cuando la clase haya terminado.",
  "ui.historial.observaciones.registrar": "Registrar observaciones",
  "ui.historial.observaciones.titulo": "Observaciones de la clase",
  "ui.historial.observaciones.noEditar": "Una vez registradas, no se pueden editar.",
  "ui.historial.observaciones.temas": "Temas vistos",
  "ui.historial.observaciones.internas": "Observaciones internas",
  "ui.historial.observaciones.opcional": "Opcional. Solo visible para el equipo del centro y el profesor de esta clase.",
  "ui.historial.observaciones.contador": "{cantidad} / 1000 caracteres",
  "ui.historial.observaciones.temasRequeridos": "Escribí los temas vistos para continuar.",
  "ui.historial.observaciones.cancelar": "Cancelar",
  "ui.historial.observaciones.continuar": "Continuar",
  "ui.historial.observaciones.confirmar": "¿Registrar las observaciones de esta clase?",
  "ui.historial.observaciones.guardada": "Observaciones registradas correctamente",
  "ui.historial.observaciones.errorRegistro": "No se pudieron registrar las observaciones. Intentá nuevamente.",
  "ui.historial.observaciones.sinRegistrar": "Sin registrar",
  "ui.historial.observaciones.temasEnClase": "Temas vistos",
  "ui.historial.observaciones.internasEnClase": "Observaciones internas",
  "ui.historial.observaciones.registradaPor": "Registradas el {fechaHora} por {usuario}",
  "ui.historial.indicacion.registrar": "Registrar indicación",
  "ui.historial.indicacion.titulo": "Registrar indicación académica",
  "ui.historial.indicacion.materia": "Materia",
  "ui.historial.indicacion.elegirMateria": "Elegí una materia",
  "ui.historial.indicacion.clase": "Clase dictada relacionada (opcional)",
  "ui.historial.indicacion.sinClase": "Sin vincular a una clase",
  "ui.historial.indicacion.texto": "Indicación",
  "ui.historial.indicacion.placeholder": "Escribí la indicación académica",
  "ui.historial.indicacion.contador": "{cantidad} / 1000 caracteres",
  "ui.historial.indicacion.formularioIncompleto": "Completá la materia y la indicación.",
  "ui.historial.indicacion.cancelar": "Cancelar",
  "ui.historial.indicacion.continuar": "Continuar",
  "ui.historial.indicacion.confirmar": "¿Registrar la indicación para {alumno} en {materia}?",
  "ui.historial.indicacion.confirmarAccion": "Registrar indicación",
  "ui.historial.indicacion.guardada": "Indicación registrada correctamente",
  "ui.historial.indicacion.error": "No se pudo registrar la indicación. Intentá nuevamente.",
  "ui.historial.indicacion.deshabilitada": "Vas a poder registrar indicaciones después de tu primera clase dictada de esta materia con este alumno.",
  "ui.historial.indicacion.registradaEn": "Registrada el {fecha}",
  "ui.historial.indicacion.registradaPor": "Registrada por {autor}",
  "ui.historial.indicacion.claseRelacionada": "Clase relacionada del {fecha}",
  "ui.historial.indicacion.etiqueta": "Indicación",
  // --- Resultados de examen (HU-E-10) ---
  "ui.historial.examen.corregido": "Corregido",
  "ui.historial.examen.anulado": "Anulado",
  "ui.historial.examen.corregir": "Corregir",
  "ui.historial.examen.anular": "Anular",
  "ui.historial.examen.ariaCorregir": "Corregir resultado de {materia} del {fecha}",
  "ui.historial.examen.ariaAnular": "Anular resultado de {materia} del {fecha}",
  "ui.historial.examen.motivoAnulacion": "Motivo: {motivo}",
  "ui.historial.examen.datosAnulacion": "Anulado el {fecha} por {usuario}.",
  "ui.historial.examen.dialogoCorregir": "Corregir resultado de examen",
  "ui.historial.examen.dialogoAnular": "Anular resultado de examen",
  "ui.historial.examen.fecha": "Fecha del examen",
  "ui.historial.examen.nota": "Nota",
  "ui.historial.examen.motivo": "Motivo (obligatorio, máximo 300 caracteres)",
  "ui.historial.examen.detalleCorregir": "Registrado: {fechaAnterior}, nota {notaAnterior}. Nuevo valor: {fechaNueva}, nota {notaNueva}. Motivo: {motivo}",
  "ui.historial.examen.confirmarCorregir": "Guardar corrección",
  "ui.historial.examen.confirmarAnular": "Anular resultado",
  "ui.historial.examen.continuar": "Continuar",
  "ui.historial.examen.cancelar": "Cancelar",
  "ui.historial.examen.guardado": "Resultado corregido correctamente",
  "ui.historial.examen.anulacionGuardada": "Resultado anulado",
  "ui.historial.examen.motivoRequerido": "Ingresá el motivo de la operación.",
  "ui.historial.examen.sinCambios": "Modificá la fecha o la nota para guardar una corrección.",
  "ui.historial.examen.notaInvalida": "Ingresá una nota válida con hasta un decimal.",
  "ui.historial.examen.errorOperacion": "No se pudo completar la operación. Intentá nuevamente.",
  "confirmaciones.examen.corregir": "¿Corregir el resultado de {materia}?",
  "confirmaciones.examen.anular": "¿Anular el resultado de {materia} del {fecha}?",
  "ui.indicadores.panel.ausentes": "Ausentes",
  "ui.indicadores.panel.titulo": "Indicadores",
  "ui.indicadores.panel.actividad": "Actividad",
  "ui.indicadores.panel.presentismo": "Índice de Presentismo",
  "ui.indicadores.panel.cancelaciones": "Cancelaciones",
  "ui.indicadores.panel.periodo": "Por defecto, los últimos 6 meses incluido el actual. El período se conserva entre pestañas.",
  "ui.indicadores.panel.desde": "Desde",
  "ui.indicadores.panel.hasta": "Hasta",
  "ui.indicadores.panel.maximo": "El período máximo es de 24 meses.",
  "ui.indicadores.panel.error": "No se pudo cargar este indicador. Intentá nuevamente.",
  "ui.indicadores.panel.reintentar": "Reintentar",
  "ui.indicadores.panel.tabla": "Ver como tabla",
  "ui.indicadores.panel.vacio": "No hay datos para el período seleccionado",
  "ui.indicadores.panel.scroll": "Se muestran los meses más recientes. Desplazá el gráfico hacia la izquierda para ver los anteriores.",
  "ui.indicadores.panel.cargando": "Cargando {titulo}",
  "ui.indicadores.panel.mes": "Mes",
  "ui.indicadores.panel.ingresos": "Ingresos cobrados",
  "ui.indicadores.panel.ocupacion": "Tasa de ocupación",
  "ui.indicadores.panel.leyendaIngresos": "Por fecha de pago. Monto vigente de cada pago, sin los anulados.",
  "ui.indicadores.panel.leyendaOcupacion": "Por fecha de la clase. Inscripciones vigentes (reservadas no vencidas, pagadas y pago sin registrar) sobre el cupo, en clases Disponibles y Completas hasta hoy.",
  "ui.indicadores.panel.pesos": "pesos",
  "ui.indicadores.panel.porcentaje": "%",
  "ui.indicadores.panel.meta": "Meta {valor}%",

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
  "ui.indicadores.presentismo.titulo": "Índice de presentismo",
  "ui.indicadores.presentismo.mensual": "Inscriptos vs. presentes por mes",
  "ui.indicadores.presentismo.materia": "Por materia",
  "ui.indicadores.presentismo.leyenda": "Clases dictadas con asistencia individual. Sobre cada par, los ausentes.",
  "ui.indicadores.presentismo.ordenMateria": "De menor a mayor índice de presentismo",
  "ui.indicadores.presentismo.sinControl": "{cantidad} clases dictadas sin control de asistencia no se incluyen en el índice.",
  "ui.indicadores.presentismo.tabla": "Alumnos con presentismo bajo",
  "ui.indicadores.presentismo.umbral": "Índice de presentismo menor a {umbral} %, con al menos {minimo} clases dictadas en la materia en el período.",
  "ui.indicadores.presentismo.vacio": "No hay datos para el período seleccionado",
  "ui.indicadores.presentismo.tablaVacia": "No hay alumnos con presentismo bajo en el período.",
  "ui.indicadores.presentismo.error": "No se pudo cargar el índice de presentismo. Intentá nuevamente.",
  "ui.indicadores.presentismo.cargando": "Cargando índice de presentismo…",
  "ui.indicadores.presentismo.inscripcionesUnidad": "inscripciones",
  "ui.indicadores.presentismo.presenciasUnidad": "presencias",
  "ui.indicadores.presentismo.inactiva": "inactiva",
  "ui.indicadores.presentismo.ausentes": "ausentes",
  "ui.indicadores.presentismo.inscriptos": "Inscriptos",
  "ui.indicadores.presentismo.presentes": "Presentes",
  "ui.indicadores.presentismo.alumno": "Alumno",
  "ui.indicadores.presentismo.materiaColumna": "Materia",
  "ui.indicadores.presentismo.clases": "Clases dictadas",
  "ui.indicadores.presentismo.ausencias": "Ausencias",
  "ui.indicadores.presentismo.historial": "Historial académico",
  "ui.indicadores.presentismo.reintentar": "Reintentar",

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
