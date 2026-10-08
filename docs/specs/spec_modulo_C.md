```markdown
# Especificación Técnica — Módulo C (Turno)
## Noctium — Sprint 1 (Revisión 4) · Sprint 2 (Revisión 5.1) · Sprint 3 (Revisión 6)

## Revisión 6 — Sprint 3: modelo de inscripción con vigencia y estado de pago, resumen y reserva del alumno (HU-C-20, HU-C-22), vencimiento y gestión de reservas (HU-C-24, HU-C-26), cancelación propia (HU-C-14) y aula por fecha en la generación masiva (HU-C-21)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas (Revisión 6):** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11) · Backlog del Sprint 3 (v18, 06/10/2026; convenciones 5, 8 a, 8 b, 8 d y 9, y las HU-C-14, C-20, C-21, C-22, C-24 y C-26) · `PR-0.md` §1.1 (principio de compatibilidad), §2.0 a §2.2, §2.4, §2.6, §2.9, §2.10, §2.13, §2.15 y §2.16 · `spec_modulo_L.md` Revisión 3 (§2.10 `obtenerTarifasPorIds`, regla 3.12) · `spec_modulo_I.md` (pagos y caja) · `spec_modulo_E.md` (historial) · `spec_modulo_B.md` (baja del alumno, búsqueda) · `schema.prisma`

**HU contractualizadas en la Revisión 6 (Sprint 3):** HU-C-20 (Confirmar inscripción con un resumen de la clase), HU-C-22 (Reservar una clase y pagarla en el centro antes del vencimiento), HU-C-24 (Vencer las reservas sin pago y gestionarlas desde mesa de entrada), HU-C-14 (Cancelar mi inscripción a una clase), HU-C-26 (Ver y gestionar las reservas pendientes de todas las clases) y HU-C-21 (Cambiar el aula de las fechas ocupadas al generar varias clases).

**Fuera de esta spec (explícito):** HU-C-23 (Centralizar los textos de la interfaz) y HU-C-25 (Confirmar cada operación antes de guardarla) son transversales y no se contractualizan acá (corresponden a `DESIGN.md`). Los textos que muestra la interfaz salen del archivo central de HU-C-23; donde esta spec cita un texto de pantalla (por ejemplo, la referencia a «`DESIGN.md` §6» de 2.10), prevalece ese archivo. HU-C-19 (término «Clase» en la interfaz) cambia solo la capa de presentación: los `code` y las rutas de este módulo conservan la palabra «turno» (HU-C-19, criterio 3). Esta spec sigue usando «turno» para el dato y la regla, y «clase» para lo que se muestra (convención 2 del backlog).

**Regla del equipo (08/10/2026) — nada de lo ya desarrollado se rompe.** El Sprint 3 se acomoda a lo que se hizo en los Sprints 1 y 2, no al revés. Esta revisión es **aditiva**: no renumera ninguna sección, no reescribe ninguna de las anteriores (solo les agrega una nota de «Revisión 6» al comienzo cuando el comportamiento interno cambia) y no cambia ningún contrato HTTP de Sprint 2.

| Lo que ya existe | Qué se conserva | Qué cambia por dentro (y quién lo manda) |
|---|---|---|
| 2.2 `PATCH .../participantes` | Ruta, cuerpo, respuesta `{ id, alumno_ids, profesor_id, cupo_maximo, estado }`, todos los `code` | Reconciliación de inscripciones en vez de `deleteMany` + `createMany` (convención 8 a). Nuevo error `422 MATERIA_SIN_TARIFA` (HU-L-06, criterio 5). Desde HU-C-24, quedan como reserva (2.18.3) |
| 2.5 agregar y quitar un alumno | Rutas, respuestas, `code` (`CUPO_INSUFICIENTE`, `ALUMNO_YA_ASIGNADO`, `ALUMNO_NO_DISPONIBLE` con `{ alumno_id }`, `ALUMNO_NO_ASIGNADO`…) | Quitar no borra: `QUITADA_CENTRO` (convención 8 a, HU-C-22 criterio 3). Campos opcionales nuevos en la respuesta de agregar |
| 2.4 listado y detalle | Todos los campos | Cuentan y muestran solo inscripciones vigentes; `estado` se decide con la ocupación real (HU-C-24, criterio 2). Campos opcionales nuevos por alumno en el detalle, **que el Profesor no recibe** (no ve precios). `puede_ver_historial` conserva el campo; su valor para el Profesor pasa a calcularse con el alcance de 8 g: `true` para los inscriptos vigentes de una clase suya, que C resuelve con los datos del detalle sin llamar a E (`spec_modulo_E.md` 2.5.3) |
| 2.10 cancelar y 2.11 reprogramar | Rutas, cuerpo, respuestas, `code` | Marcan antes las reservas ya vencidas (HU-C-24, criterio 2). Reprogramar recalcula los vencimientos (HU-C-22, criterio 2) |
| 2.14.1 «Mis turnos» | Ruta, parámetros, paginación, `totales` y los campos de cada ítem | Cada ítem suma el objeto `inscripcion` (HU-C-22, criterios 4 y 6). Se listan también las inscripciones finalizadas (HU-C-14, criterio 5) |
| 2.14.2 «Solicitar turno» | `opciones`; `POST .../inscripcion` sin body y su respuesta `{ id, alumnos_inscriptos, estado }`; todos los `code` | Resumen previo (endpoint nuevo de solo lectura). La inscripción queda como reserva con plazo (HU-C-22). Errores nuevos para condiciones nuevas |
| 2.9 generación masiva | Rutas, `GenerarTurnosSchema` (campos nuevos opcionales), códigos | Aula por fecha y fechas excluidas (HU-C-21), solo si el pedido las usa |
| 2.15 servicios públicos | Firma y forma del resultado de cada función | Cuentan solo inscripciones vigentes |
| Cualquier endpoint que inscribe (2.2, 2.5, 2.14.2) | Todo | **Cambio inevitable:** si la materia no tiene tarifa se rechaza con `422 MATERIA_SIN_TARIFA` (HU-L-06, criterio 5; `PR-0.md` §1.1). Con las materias del seed no ocurre |
| Eventos de §4 | Nombres y payloads existentes | Campos extra opcionales y un evento nuevo |

**Contradicciones entre Sprint 2, el backlog y el PR 0, y cómo se resuelven.** No hay ninguna que obligue a romper un contrato; las que siguen son de redacción o de reglas internas.

| # | Contradicción | Resolución |
|---|---|---|
| T1 | 2.5 y 3.13 dicen que la baja de `TurnoAlumno` es **física**; la convención 8 (a) y HU-C-22 (criterio 3) exigen que la inscripción **no se borre** | Manda el backlog: vigencia en lugar de baja física (3.14). El contrato HTTP de quitar no cambia |
| T2 | `Turno.estado` se guarda y se muestra; HU-C-24 (criterio 2) exige que una clase llena solo por reservas vencidas se muestre Disponible aunque el proceso no corrió | `Turno.estado` se sigue guardando y manteniendo, pero ninguna lectura decide con él (2.16.5, 3.16) |
| T3 | R5-6 / Q5 (aprobado por el PO el 29/09) dice que un turno vencido **sí** admite registrar un pago; HU-C-22 y HU-I-10 (criterios 3 y 7) dicen que el pago se hace **antes** de la clase | `POST /api/pagos` **conserva siempre** el comportamiento de Sprint 2 (modo de compatibilidad del PR 0, `PR-0.md` §2.13), y R5-6 sigue valiendo para ese endpoint. «Antes de la clase» rige en el flujo nuevo de HU-I-10 (`POST /api/pagos/operaciones`), que usan las pantallas de cobro (P-C7). Lo define `spec_modulo_I.md` (T1, P-I1); 3.8 lo anota |
| T4 | 3.7 pide bloquear la fila del turno a mano; el PR 0 fija un orden de bloqueo único (recurso → clase → inscripción → operación → caja) | Se usa `bloquear(...)` con la misma garantía (3.17) |
| T5 | Los servicios del módulo lanzan `ServiceError(code)`; el PR 0 introduce `ErrorDeDominio(clave)` | `ErrorDeDominio` **extiende** `ServiceError` y lleva el mismo `code` que hoy en las condiciones existentes (2.16.7) |
| T6 | Sprint 2 usa `eventos_turno` (usuario obligatorio); el PR 0 agrega un historial de estados de la inscripción con actor «Proceso automático» | Conviven (§4): el historial registra cada transición de la inscripción; `eventos_turno` sigue registrando lo que hace un usuario sobre la clase |

**Changelog de la Revisión 6 (trazabilidad Backlog → Spec):**
| HU / sección | Estado previo | Acción |
|---|---|---|
| Modelo de inscripción (convención 8 a) | `TurnoAlumno` con PK compuesta, sin estado, borrado físico | Nueva sección 2.16: extensión de `TurnoAlumno` con vigencia, estado de pago, plazo y precio; qué cambia por dentro en 2.2, 2.4, 2.5, 2.10, 2.11, 2.14 y 2.15 sin cambiar sus contratos |
| HU-C-20 | Sin contrato (HU-C-12 inscribía directamente al tocar «Inscribirme») | Nueva sección 2.17.1: resumen de la clase (endpoint de solo lectura) |
| HU-C-22 | Sin contrato | Nuevas secciones 2.17.2 a 2.17.5: reserva con plazo, precio congelado, regla de re-reserva y estado de pago en «Mis turnos» |
| HU-C-24 | Sin contrato | Nueva sección 2.18: proceso de vencimiento, validación por fecha, inscripción desde el centro, reservas en el detalle, plazo nuevo tras anulación y clases canceladas |
| HU-C-14 | Diferida desde Sprint 2 (criterio 6 de HU-C-05 y 5 de HU-C-13) | Nueva sección 2.19 |
| HU-C-26 | Sin contrato | Nueva sección 2.20 |
| HU-C-21 | Sin contrato; 2.9 exigía una sola aula para todo el rango | Nueva subsección 2.9.1 (al final de 2.9) |
| HU-C-04 / HU-C-18 (2.2, 2.5) | Inscribían sin plazo de pago | Notas de Revisión 6; el cambio lo pide HU-C-24, criterio 3 (2.18.3) |
| HU-C-05 / HU-C-06 (2.10, 2.11) | Sin vencimiento de reservas | Notas de Revisión 6 (2.16.6 y 2.18.2) |
| HU-C-12 / HU-C-13 (2.14) | Inscripción directa; «Mis turnos» sin estado de pago | Notas de Revisión 6 en 2.14, 2.14.1 y 2.14.2 |
| §3 Reglas | 3.1 a 3.13 | + 3.14 a 3.20 al final del bloque, sin renumerar. Notas en 3.1, 3.4, 3.7, 3.8 y 3.13 |
| §4 Trazabilidad | Opción (b) | Nota de Revisión 6: historial de estados de la inscripción, eventos ampliados y `turno:inscripcion_cancelada` |
| Parámetros | — | + `plazo_pago_horas` y `cancelacion_anticipacion_horas` |

**Puntos a confirmar antes de implementar (Revisión 6):**
| # | Punto | Quién |
|---|---|---|
| P-C1 | **Vencimiento mostrado en el resumen.** HU-C-20 (criterio 3) y HU-C-22 (criterio 2) muestran «tenés que pagarlo antes del <fecha y hora>» *antes* de reservar, cuando el vencimiento todavía no existe (corre desde que se confirma). Esta spec muestra el que **correspondería si se reservara en ese instante** (`vence_pago_el`) y la confirmación informa el **definitivo**, que puede diferir en minutos. Si el PO prefiere otra redacción («tenés 24 horas desde que reservás…»), es solo un texto | PO |
| P-C2 | **Materia sin tarifa y resguardo de re-inscripción.** Por la regla del equipo, `Materia.tarifaHora` admite vacío (`spec_modulo_L.md` P-L1), así que una materia creada sin tarifa puede tener clases. Esta spec **sigue ofreciendo** esas clases en «Solicitar clase» y rechaza en el resumen y en la reserva con `422 MATERIA_SIN_TARIFA`. El backlog no trae el texto: propuesta «Esta clase todavía no tiene precio. Comunicate con el centro.» (alumno) y «La materia todavía no tiene tarifa. Pedile al gerente que la defina.» (mesa de entrada). Para `INSCRIPCION_REQUIERE_PAGO` (mesa de entrada): «El alumno ya tuvo una reserva sin pagar en esta clase: se inscribe recién al confirmar el pago.» | PO |
| P-C3 | **Clase cancelada con reserva pendiente.** HU-C-24 (criterio 6) dice que sus reservas dejan de vencer y el alumno las ve como clase cancelada; HU-C-22 (criterio 4) no dice qué etiqueta de pago lleva. Esta spec la rotula `PAGO_SIN_REGISTRAR` (informativo, sin invitar a pagar) | PO |
| P-C4 | **Una tarjeta por clase en «Mis turnos».** El backlog no dice qué pasa si el alumno canceló y volvió a inscribirse en la misma clase (dos inscripciones). Esta spec muestra una tarjeta por clase (la vigente o, si no hay, la más reciente) y los totales de las pestañas cuentan tarjetas. Las clases `PENDIENTE` no se listan | PO |
| P-C5 | **Nombres propuestos:** permiso `turnos:cancelar_propia` (ALUMNO; el PR 0 lo prevé sin nombrarlo), `reservas:leer` (lo nombra el PR 0), y las rutas `POST /api/procesos/vencer-reservas`, `POST /api/turnos/[id]/inscripcion/cancelacion`, `GET /api/turnos/[id]/inscripcion/resumen`, `GET /api/reservas/{resumen,pendientes,vencidas}`, `POST /api/reservas/[inscripcionId]/quitar` y `GET /api/turnos/generacion/aulas-libres`. Los fija la tabla cerrada de `PR-0.md` §2.9 y las rutas por rol | SM |
| P-C6 | **Filtro por alumno de HU-C-26** («mismo criterio que HU-B-05»). `construirFiltroBusquedaAlumno` está hoy en el módulo B. Se pide a `spec_modulo_B.md` que lo publique en `alumno.publico.ts`; si no, queda la excepción de solo lectura de 3.11 (columnas normalizadas de Alumno por relación, como la búsqueda de 2.7) | SM |
| P-C7 | **R5-6 / Q5 y Q6a (aprobados por el PO el 29/09).** El backlog del Sprint 3 (HU-C-22 criterio 4, HU-I-10 criterios 3 y 7) pide que el cobro de una clase ya iniciada no se ofrezca. Por la regla del equipo, el endpoint de Sprint 2 conserva su comportamiento para siempre (T3) y la regla nueva rige solo en el flujo de HU-I-10. Se informa al PO | PO (informativo) |
| P-C8 | **Reserva reabierta por anulación y cancelación del alumno.** HU-C-22 (criterio 4) excluye de la regla de re-reserva a la reserva reabierta que **vence**; no dice qué pasa si el alumno la **cancela**. Esta spec la trata igual (no cuenta: el alumno había pagado) | PO |

**Pedidos al PR 0 (surgen de esta revisión; el PR 0 se actualiza una vez, con todas las specs listas):**
| # | Pedido | Dónde |
|---|---|---|
| R6-PR0-1 | `crearInscripcion`, `finalizarInscripcion`, `marcarVencidas` y `marcarVencidasDelAlumno` **no cambian `Turno.estado` de una clase `PENDIENTE` ni `CANCELADO`**: solo recalculan `DISPONIBLE ⇄ COMPLETO` en clases confirmadas. La salida de `PENDIENTE` es exclusiva de 2.2 paso 8 | 2.16.5, 3.16; `PR-0.md` §2.2 |
| R6-PR0-2 | `ErrorDeDominio` con el `code` y el **texto literal** de hoy para las condiciones existentes de 2.16.7, y los códigos nuevos con su HTTP: `MATERIA_SIN_TARIFA` 422, `RESERVA_PREVIA_SIN_PAGO` 409, `INSCRIPCION_REQUIERE_PAGO` 409, `RESERVA_NO_PENDIENTE` 409, `INSCRIPCION_NO_VIGENTE` 409, `CANCELACION_FUERA_DE_PLAZO` 409, `INSCRIPCION_NO_ENCONTRADA` 404 | 2.16.7; `PR-0.md` §2.13 |
| R6-PR0-3 | Lecturas de módulo C para las operaciones de 2.2, 2.5 y 2.19: inscripción **vigente** de un par (alumno, clase) e inscripción **más reciente** del par, ambas con `db` opcional | `PR-0.md` §2.13 |
| R6-PR0-4 | `exigeInscripcionConPago` devuelve el motivo (reserva vencida o cancelada sin pago) y respeta que no cuenta la reserva reabierta por anulación ni la pagada (P-C8) | `PR-0.md` §2.13 |
| R6-PR0-5 | `listarReservasPendientes`, `listarReservasVencidas` y `resumenReservas` devuelven los campos de 2.20 (alumno con DNI y cantidad de reservas pendientes, clase con aula, profesor, precio guardado, `vence_el`, filtro `vencen` = `en_3_horas` / `hoy` / `manana`, y `sin_marcar` en vencidas) | 2.20; `PR-0.md` §2.13 |
| R6-PR0-6 | `parametrosVigentes()` expone `plazo_pago_horas` y `cancelacion_anticipacion_horas` | `PR-0.md` §2.6 |
| R6-PR0-7 | Tabla cerrada de permisos: `turnos:cancelar_propia` (ALUMNO) y `reservas:leer` (MESA_ENTRADA); ruta `/reservas` en `rutas-por-rol` y en el `matcher`; la ruta del proceso de vencimiento **fuera** del control de sesión (se autentica con `CRON_SECRET`) | 2.18.1, 2.19, 2.20; `PR-0.md` §2.9 |
| R6-PR0-8 | Prueba con PostgreSQL real: el trigger de `reservas_turno` proyecta solo inscripciones `VIGENTE`, y finalizar una inscripción libera al alumno para otra clase superpuesta | 2.16.8; `PR-0.md` §2.0 |
| R6-PR0-9 | `marcarVencidas` devuelve la cantidad marcada y existe la lectura `clasesConReservasVencidas(db, momento)` para el proceso (2.18.1) | `PR-0.md` §2.2 |
| R6-PR0-10 | `crearInscripcion` conserva `ALUMNO_NO_ENCONTRADO` (404) y `ALUMNO_INACTIVO` (409) y acepta un `alumnoActivo` ya resuelto (autoservicio, 2.5 paso 2); obtiene la tarifa con `obtenerTarifasPorIds` (`spec_modulo_L.md` §2.10) y calcula con `precioClase` | 2.16.6, 3.18; `PR-0.md` §2.13 |

**Efectos en otras specs (se anotan al escribirlas):** `spec_modulo_I.md` (el pago apunta a la inscripción; modo de compatibilidad de `POST /api/pagos`; mensajes de HU-I-10), `spec_modulo_E.md` (el historial de clases del alumno muestra el resultado de cada inscripción —Cancelada por el alumno, Reserva vencida, Quitada, Baja—; `profesorAtendioAlumno` y Q13/Q7b se reemplazan por el alcance de 8 g), `spec_modulo_B.md` (HU-B-07 finaliza inscripciones con `BAJA_ALUMNO`; publicar `construirFiltroBusquedaAlumno`), `spec_modulo_H.md` (la ocupación y las series cuentan inscripciones vigentes), `spec_modulo_J.md` y `spec_modulo_K.md` (cuentan vigentes a través de los servicios públicos de 2.15).


## Nota aditiva — 01/10/2026: servicios públicos para Indicadores (`spec_modulo_H.md` Revisión 2)

| Sección | Estado previo | Acción |
|---|---|---|
| 2.15 `contarTurnosPorMes()` | Consumida por HU-H-01 original | **Retirada** del código: HU-H-01 fue reemplazada por "Ingresos cobrados" y la función quedó sin consumidores. La fila se conserva tachada como historial |
| 2.15 `promediarOcupacionTurnosPorMes()` | — | **Nueva**, consumida por HU-H-02 revisada (tasa de ocupación). Solo lectura, sin cambios en reglas de negocio, estados ni numeración |

## Revisión 5.1 — HU-C-13: indicador de clase dictada (29/09/2026)

**Changelog de esta revisión:**
| HU | Estado previo | Acción |
|---|---|---|
| HU-C-13 | §2.14.1 no informaba si un turno pasado tenía una clase dictada registrada ni incluía una clave técnica para cada tarjeta | Por decisión del PO (29/09/2026), se agrega `clase_dictada: boolean` por ítem. También se expone `turno_id` para renderizar las tarjetas con una clave estable. Turnos consulta el servicio público `obtenerClaseDictadaDeTurno()` de Historial (E §2.4); la pantalla muestra la etiqueta «Clase dictada» en Anteriores cuando el valor es `true`. |

## Revisión 5 — Sprint 2: nuevo orden del flujo de registro de turno (HU-C-18), nuevas HU 2.7 a 2.15 y backlog v2 del 28/09/2026

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker, extensión `btree_gist` ya migrada: exclusión GiST de `reservas_turno`, migración `20260924150000_turnos_reservas_recursos_v2`, ver 3.4) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 8, 10, 11) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_L.md` (Materias) · `spec_modulo_B.md` (Alumno) · `spec_modulo_D.md` (Profesor, fórmula de superposición §3.4) · `spec_modulo_K.md` (Aulas) · `spec_modulo_I.md` (Pagos, Sprint 2) · `spec_modulo_E.md` (Historial, Sprint 2) · `schema.prisma` · `docs/tasks/Sprint 1/` · `docs/tasks/Sprint 2/HU-Sprint-2.md` · `docs/adicionales/mapa-pantallas-sprint-2.md` · `docs/adicionales/propuesta-cambio-orden-flujo-turno.md`

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-C-01 | Implementada (Sprint 1), sin prioridad ni búsqueda | Ampliada en 2.4: el presentador agrega `prioridad` y `creado_en`; el detalle agrega además `creado_por` (email), `pagos`, `acciones_habilitadas`, etc. Sin renumerar |
| HU-C-02 | Gap — no contractualizada | Añadida sección 2.7 (búsqueda `q` en el listado) |
| HU-C-03 | Implementada (Rev. 3) y reabierta en Rev. 4 (duración configurable) | Anotada en 2.1: `profesor_id` obligatorio, contrato de «Atrás», `aula_desasignada`. Sin renumerar |
| HU-C-04 | Implementada (Rev. 3) | Anotadas 2.2 (`profesor_id` opcional, `TURNO_SIN_PROFESOR`), 2.5 (núcleo `inscribirAlumnoEnTurno`) y 2.6 (solo para completar `PENDIENTE` sin profesor) |
| HU-C-05 | Gap — no contractualizada | Añadida sección 2.10 (cancelar; descarte de `PENDIENTE`, N-1) |
| HU-C-06 | Gap — no contractualizada | Añadida sección 2.11 (reprogramar) |
| HU-C-07 | Gap — no contractualizada | Añadida sección 2.8 (profesores por materia y disponibilidad) |
| HU-C-08 | Gap — no contractualizada | Añadida sección 2.7 (filtro por profesor) |
| HU-C-09 | Gap — no contractualizada | Ampliado el detalle de 2.4 |
| HU-C-09 / Regla N.° 3 (decisión del 29/09/2026) | §3.11 exceptuaba explícitamente la búsqueda/listado, pero no delimitaba la lectura del detalle que reutiliza `presentar()` | Anotadas §2.4 y §3.11: excepción de solo lectura acotada a los campos básicos de Alumno, Materia, Profesor y Aula en el detalle existente; sin escrituras, validaciones ni campos nuevos de esos dominios. No se renumeran secciones |
| HU-C-09 (decisiones del 30/09/2026) | La spec incluía `creado_por` en el listado y no decía nada del pie de la tarjeta de pagos | `creado_por` (email) solo en el detalle: el listado queda sin él (ticket); «Total registrado» no se implementa (PO). Sin renumerar |
| HU-C-09 / HU-I-01 («Total registrado», 01/10/2026) | La decisión del 30/09 excluía «Total registrado», pero HU-I-01 se aprobó mostrándolo (PR #148) y el prototipo también lo muestra | Nota de sincronización en 2.4: «Total registrado» se muestra en la tarjeta «Pago», debajo de la lista y separado por una línea; sin pagos, «Ninguno todavía.». Reemplaza esa parte de la decisión del 30/09. Sin renumerar |
| HU-C-10 | Gap — no contractualizada | Añadida sección 2.12 (prioridad) |
| HU-C-11 | Gap — no contractualizada | Retirada del backlog v2; la sección 2.13 se conserva como marcador sin contrato |
| HU-C-12 | Gap — no contractualizada | Añadida sección 2.14.2 (solicitar turno) |
| HU-C-13 | Gap — no contractualizada | Añadida sección 2.14.1 (mis turnos, incluye `CANCELADO`) |
| HU-C-15 | Implementada y remediada (Rev. 3) | Anotada en 2.3: pasa a ser el cuarto paso; sin cambio de contrato |
| HU-C-16 | Cubierta por 2.3 (Sprint 1) | Sin cambio de contrato, solo de posición en el wizard (2.3) |
| HU-C-17 | Gap — no contractualizada | Añadida sección 2.9 (generación masiva; turnos `DISPONIBLE` 0/N) |
| HU-C-18 | Gap — no contractualizada | Reordenamiento del wizard: anotadas 2.1, 2.2, 2.3 y 2.6 sin renumerar |
| HU-K-03 (servicio público de C) | §2.15 describía nombres y emisión individual distintos del código | Sincronizado el contrato de `EventoTurnoPendiente` y `emitirEventosTurno`, el instante único del ajuste y los orígenes de eventos en §4; sin cambiar otros emisores |

Los changelogs detallados de esta y de revisiones anteriores se conservan más abajo (`## Changelog — Revisión 5 (Sprint 2)` y `## Changelog de esta revisión`).

**HU contractualizadas en esta revisión:** HU-C-03 (Configurar turno — **implementada Revisión 3, reabierta en Revisión 4 por la duración configurable, implementada y verificada en navegador el 25/09/2026**, ver `docs/tasks/Sprint 1/HU-C-03.md`), HU-C-04 (Asignar profesor y alumnos / gestionar inscripciones — implementada Revisión 3, sin cambios en esta revisión, ver `docs/tasks/Sprint 1/HU-C-04.md`), HU-C-15 (Asignar aula — implementada/remediada Revisión 3, sin cambios en esta revisión, ver `docs/tasks/Sprint 1/HU-C-15.md`), HU-C-01 (Listar turnos) — Sprint 1.

**HU contractualizadas en la Revisión 5 (Sprint 2):** HU-C-18 (Reordenar el flujo de registro de turno), HU-C-07 (Mostrar horarios disponibles del profesor), HU-C-16 (Mostrar aulas disponibles según horario — sin cambio de contrato, solo de posición), HU-C-17 (Generar turnos a partir del horario del profesor), HU-C-09 (Consultar detalles del turno), HU-C-05 (Cancelar turno), HU-C-06 (Reprogramar turno), HU-C-10 (Asignar prioridad), HU-C-02 (Búsqueda inteligente de turnos), HU-C-08 (Consultar turnos asociados al profesor), HU-C-12 (Solicitar turno propio), HU-C-13 (Consultar turnos propios). Además provee los servicios públicos que consumen HU-K-03, HU-D-07, HU-I-01, HU-E-01, HU-H-01 y HU-J-03 (sección 2.15).

**Backlog v2 del 28/09/2026 (xlsx de los PO, 25 HU · 63 SP).** Respecto del backlog anterior (26 HU · 49 SP) los PO: (1) **retiraron HU-C-11** (Asociar forma de pago al turno): el turno ya no lleva forma de pago y la sección 2.13 queda sin contrato; (2) cambiaron HU-C-17 AC7: los turnos generados nacen **`DISPONIBLE` 0/N**, no `PENDIENTE` (queda resuelto el punto Q11); (3) cambiaron HU-C-07 AC1 y HU-C-17 AC1: el horario **no** depende de la materia (resuelve Q1); (4) HU-C-13 ahora **incluye los turnos `CANCELADO`**; (5) HU-C-12 agrega el aviso "El pago se abona en el centro"; (6) HU-D-07 pide listar los turnos que bloquean la baja de una materia; (7) HU-I-01 registra **qué alumno paga**. **Ajuste del 28/09 (backlog v3, mismos SP):** HU-D-07 AC3 cambia el aviso y agrega un modal "Ver turnos" paginado (2.7); HU-C-13 AC6 pagina "Mis turnos" de a 10 con totales por pestaña (2.14.1); HU-I-01 AC1 pide buscador de alumno (`spec_modulo_I.md`); HU-E-05 AC6 pagina el historial de a 10 (`spec_modulo_E.md`).

**Cambio de flujo (Revisión 5, pedido del cliente vía PO, aprobado 27/09/2026 — ver `docs/adicionales/propuesta-cambio-orden-flujo-turno.md`):** el wizard de Mesa de Entradas pasa a **Elegir Materia → Elegir Profesor → Elegir Fecha y Horario → Elegir Aula → Agregar Alumnos**, y **reemplaza por completo** el orden de la Revisión 4 (Configurar → Aula → Profesor y alumnos). El trabajo de reordenamiento lo absorbe **HU-C-18** (mapa de pantallas §1, "HU-C-03/C-04/C-15 no se reabren"); esta spec ajusta los contratos 2.1, 2.2, 2.3, 2.4 y 2.6 por notas de Revisión 5 dentro de cada sección, sin renumerarlas, y agrega las secciones nuevas 2.7 a 2.15 y las reglas 3.8 a 3.13.

**Cambio de flujo (Revisión 3, pedido explícito del cliente, aprobado por el PO — ver `propuesta-cambio-cupo-aula.md`):** el cupo máximo de un turno deja de ser un valor que Mesa de Entradas escribe a mano (HU-C-03) y pasa a fijarse automáticamente según la capacidad del aula elegida (HU-C-15). Esto invierte el orden de los últimos dos pasos del flujo: **Configurar turno → Asignar aula (fija el cupo) → Asignar profesor y alumnos (ahora el último paso, el que confirma el turno)**. Ver detalle completo en la sección 1 y en 2.1/2.2/2.3.

**Cambio de esta revisión (Revisión 4, pedido explícito del cliente vía PO, aprobado 24/09/2026 — ver `propuesta-cambio-duracion-turno.md`):** la duración de un turno deja de ser fija (`DURACION_ESTANDAR_TURNO_MIN`) y pasa a ser elegida por Mesa de Entradas al configurar el turno (HU-C-03, 2.1), entre tres valores permitidos: **1 hora, 2 horas o 3 horas**, sin valor preseleccionado. `hora_fin = hora_inicio + duracion_min`, donde `duracion_min` ya no es una constante sino un dato del formulario. El parámetro `DURACION_ESTANDAR_TURNO_MIN` se reemplaza por `DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180]`. Ver detalle completo en 2.1 y en la tabla de parámetros configurables al pie del documento. **Nota de sincronización (relevamiento Revisión 4, R4-1):** `DURACION_ESTANDAR_TURNO_MIN` nunca existió como constante en el código: la duración fija era la fila `duracion_turno_estandar_minutos` de `ParametroSistema`. Su reemplazo, `DURACIONES_PERMITIDAS_TURNO_MIN`, es una **constante en código** (`src/server/turnos/turno.schema.ts`), no una fila de `ParametroSistema`, porque cambiar el conjunto requiere una nueva aprobación del PO.

**✅ IMPLEMENTADA Y VERIFICADA EN NAVEGADOR (24-25/09/2026) — Revisión 3.** Relevamiento previo con Claude Code, implementación completa (backend + frontend + migración), los tres niveles de test en verde (296 unit + 8 Postgres real + curl + SQL), y verificación en navegador por el Scrum Master de los 10 puntos de la lista de aceptación — 9 confirmados en la primera pasada, 1 (alta/baja individual con `next dev` + Turbopack) resuelto como limitación conocida del entorno de desarrollo, no del código (funciona con `next dev --webpack` y en el build de producción; documentado en `README.md`). Esta sección refleja el contrato real tal como quedó implementado, no solo el diseño — los ajustes que el relevamiento y la implementación encontraron respecto al diseño original están marcados en cada sección afectada.

**✅ REVISIÓN 4 (duración configurable) — IMPLEMENTADA Y VERIFICADA EN NAVEGADOR (25/09/2026).** Relevamiento previo con Claude Code (`docs/tasks/Sprint 1/HU-C-03.md` §10, decisiones R4-1 a R4-6 aprobadas por el Scrum Master sin cambios), implementación sin migración de Prisma, tests en verde (348 unitarios + 9 contra Postgres real + curl + SQL) y verificación en navegador por el Scrum Master de los 5 puntos de aceptación, sin hallazgos. Evidencia completa: `HU-C-03.md` §11.

**Fuera de alcance de esta spec (explícito):**
- ~~Cancelación de un turno, en cualquier estado (`PENDIENTE`, `DISPONIBLE` o `COMPLETO`).~~ **Incorporada en Revisión 5** (2.10; el descarte de un `PENDIENTE` está aprobado, N-1, ver más abajo).
- ~~Modificación de fecha/hora de un turno que ya no está `PENDIENTE`.~~ **Incorporada en Revisión 5** (2.11).
- Reemplazo del aula de un turno `DISPONIBLE` o `COMPLETO` (el reemplazo de aula solo aplica mientras el turno es `PENDIENTE`, ver 2.3).
- ~~Sugerencia automática de franjas disponibles: la fecha/hora se elige manualmente este sprint.~~ **Incorporada en Revisión 5** (2.8).
- Filtros combinados en el listado (HU-C-01 §7 lo excluye explícitamente; HU-C-02 AC6 los deja para Sprint 3). La **búsqueda simple** sí se incorporó en Revisión 5 (2.7).
- Quitar un alumno individual mientras el turno está `PENDIENTE` — mientras el turno no tiene aula, cualquier cambio en los alumnos se resuelve reemplazando el conjunto completo (2.2), no dando de baja uno solo (la baja individual, 2.5, solo existe a partir de `DISPONIBLE`/`COMPLETO`). Ver **DECISIÓN RESUELTA** al pie de 2.5.
- **Nuevo en Revisión 4:** duraciones de turno distintas a 60/120/180 min. Modificar la duración de un turno que ya no está `PENDIENTE` (mismo criterio que fecha/hora, ver arriba). Cualquier cambio a la fórmula de superposición (3.3) o al diseño de `reservas_turno` (3.4) — el mecanismo existente ya desnormaliza el rango horario por turno y no asume una duración uniforme, no se toca en esta revisión (confirmado en el relevamiento contra el trigger real y en Postgres real, ver nota en 3.4).

**Actualización de alcance — Revisión 5 (Sprint 2):** pasan a estar **dentro de alcance**: cancelar un turno `DISPONIBLE`/`COMPLETO` (2.10), modificar fecha/hora de un turno `DISPONIBLE`/`COMPLETO` (2.11), sugerencia de franjas disponibles (2.8) y búsqueda simple en el listado (2.7). **Aprobado por el PO (N-1):** un turno `PENDIENTE` también puede descartarse (`PENDIENTE → CANCELADO`, 2.10), porque el wizard lo persiste desde el paso 3 (R5-1) y de otro modo queda huérfano. Siguen **fuera de alcance**: cancelación de un turno propio por el alumno (HU-C-14, Sprint 3), cambiar materia, profesor o duración de un turno ya confirmado, reemplazo de aula de un turno confirmado, filtros combinados por estado o rango de fechas (HU-C-02 AC6), notificaciones por cambio de prioridad, y la vista de calendario (módulo J).

---


## ✅ DECISIONES DEL SCRUM MASTER — Revisión 5 (Sprint 2)

Redactadas el 28/09/2026 a partir de `HU-Sprint-2.md`, el mapa de pantallas, la propuesta de orden de flujo, `schema.prisma` y `seed.ts`. **Actualización del 29/09/2026:** el PO respondió las preguntas abiertas de este módulo; cada fila indica su estado (ratificado, ratificado con cambio o aprobado). Las que estaban marcadas como pendientes de ratificación tenían una propuesta por defecto (la que esta spec contractualiza) y una pregunta abierta; **no se implementa lo dudoso por inferencia** (`sdd-metodologia.md`, "Relevar antes de asumir").

| # | Decisión | Estado |
|---|---|---|
| R5-1 | **Cuándo se persiste el turno.** Los pasos 1 a 3 (Materia, Profesor, Fecha/Horario) viven en el estado del cliente. Al confirmar el paso 3 se hace `POST /api/turnos` (2.1, ahora con `profesor_id`) y el turno nace `PENDIENTE`. El paso 4 usa `PATCH .../aula` (2.3) y el paso 5 `PATCH .../participantes` (2.2), que sigue siendo la operación que confirma. No se crea un endpoint combinado. | Decidido |
| R5-2 | **Profesor obligatorio en el alta.** `profesor_id` pasa a ser requerido en 2.1. En 2.2 pasa a ser opcional: si el turno ya tiene profesor no hace falta reenviarlo. Los turnos `PENDIENTE` creados en Revisión 4 (sin profesor, p. ej. `seed-turno-11/18/25`) se completan enviándolo en 2.2. | Decidido |
| R5-3 | **Dónde se elige la duración (1/2/3 h).** Dentro del paso 3, antes de fecha y hora, porque las horas de inicio posibles dependen de ella (`duracion_min` es parámetro obligatorio de 2.8). HU-C-18 y HU-C-07 no la ubican. | **Ratificado por el PO (29/09/2026) — Q2** |
| R5-4 | **Horario del profesor y materia.** `HorarioProfesor` **no tiene** `materiaId` (`schema.prisma`, `spec_modulo_D.md` §2.4/§3.5). Los PO lo reconocieron en el backlog v2: HU-C-07 AC1 y HU-C-17 AC1 ahora dicen "horario de atención de **ese profesor**" y HU-D-07 AC5 aclara que los horarios no dependen de la materia. Se contractualiza como *las franjas de un profesor activo que dicta esa materia*. **El backlog se deja tal cual** (decisión del equipo, 28/09): HU-C-17 conserva en el sub-punto de AC1 ("horarios … para ese profesor y esa materia") y en **AC5** ("el único solapamiento que se valida es el de aula") una redacción que el modelo no sostiene, porque la franja no tiene materia. **Aquí prevalece el modelo de datos:** 2.9 valida también al **profesor**, sin lo cual un choque de profesor aparecería como error técnico de la base en vez de un mensaje claro (el trigger igualmente lo rechazaría). Es una precisión técnica, no un cambio de alcance; cómo se cumple cada criterio de HU-C-17 (AC1, AC5, AC10) está redactado en 2.9. | Resuelto; backlog sin tocar |
| R5-5 | **Estado `CANCELADO`.** Migración aditiva `ALTER TYPE "EstadoTurno" ADD VALUE 'CANCELADO'`, **en una migración propia** (PostgreSQL no permite usar el valor nuevo en la misma transacción que lo agrega; Prisma envuelve cada migración en una). No se usa `migrate reset`: la base ya es compartida por el equipo. Terminal: no vuelve a ningún estado. | Decidido (HU-C-05 pedía coordinarlo con el SM) |
| R5-6 | **Turnos vencidos** (`fecha + hora_inicio` ya pasó, guard `turnoSigueVigente`): **no** admiten cancelar un `DISPONIBLE`/`COMPLETO` (2.10), reprogramar (2.11) ni inscribir/quitar alumnos (2.5, 2.14). **Salvedad N-1:** un `PENDIENTE` vencido **sí** puede descartarse (2.10 paso 2), para no dejar borradores huérfanos. **Sí** admiten prioridad (2.12, HU-C-10 AC5), registrar pago (`spec_modulo_I.md` §2.4) y registrar clase dictada (`spec_modulo_E.md` §2.1). | **Ratificado por el PO (29/09/2026) — Q5** |
| R5-7 | **Búsqueda del listado** (2.7): excepción **documentada** a la Regla N.° 3 (lectura de columnas normalizadas de Alumno, Profesor, Materia y Aula vía relaciones de Prisma, igual que ya hace el presentador `presentar()`); ver 3.11. | Decidido |
| R5-8 | **Generación masiva** (2.9): (a) no se limita por `ANTICIPACION_MAXIMA_DIAS` (=30 en el seed, contradiría "un cuatrimestre"); se limita con dos parámetros nuevos `generacion_maxima_meses` (6) y `generacion_maxima_turnos`; (b) además del aula, valida al **profesor** (R5-4); (c) detecta duplicados: un turno no cancelado del mismo profesor y materia que se superponga con la fecha calculada se informa como conflicto `TURNO_EXISTENTE` (mensaje claro: "ya generaste esas fechas"). Desde que los turnos generados nacen `DISPONIBLE` (R5-9) ya reservan profesor y aula, así que dos corridas idénticas también chocarían contra la exclusión GiST; esta guarda deja de ser la única defensa y pasa a ser solo un mensaje mejor. Se **elimina el advisory lock** de la versión anterior de esta spec. | **Ratificado por el PO (29/09/2026) — Q3, con un cambio: el rango máximo de una generación es de 6 meses, en lugar de 150 días** (Q10 ya no bloquea) |
| R5-9 | **Turnos generados nacen `DISPONIBLE` 0/N.** Decisión de los PO en el backlog v2 (HU-C-17 AC7). No pasan por `PENDIENTE`: se insertan ya con profesor, aula, `cupoMaximoTurno` = capacidad del aula y `estadoTurno = DISPONIBLE`, de modo que el trigger `turno_sincronizar_reservas` reserva profesor y aula en el propio `INSERT` y admiten inscripción desde el primer momento (2.5 y autoservicio 2.14). Es el único camino, además de 2.2, por el que un turno llega a `DISPONIBLE`, y el **único que lo hace con 0 alumnos**. | Resuelto (era Q11) |
| R5-10 | **Modificar un turno `PENDIENTE` que ya tiene aula** (paso "Atrás" del wizard, HU-C-18 AC4): si el nuevo profesor, fecha, hora o duración deja el aula en conflicto, el aula se **desasigna** (`aulaId` y `cupoMaximoTurno` a `null`) y se informa, En la Revisión 3 lo que se desasignaba en este caso era el profesor; desde la Revisión 5 el profesor **no** se desasigna (2.1 paso 8: `409 PROFESOR_NO_DICTA_MATERIA` y el cliente reenvía el profesor) y lo único que se desasigna es el aula (`aula_desasignada: true`, 2.1). | Decidido |
| R5-11 | **RETIRADA.** Definía la forma de pago sugerida de HU-C-11 y el campo `createdAtTurnoAlumno`. Al retirarse HU-C-11 del backlog v2 desaparecen ambos; se conserva el número para no renumerar. | Retirada |
| R5-12 | **Alcance por rol** del listado (C-08), detalle (C-09) y turnos propios (C-13): siempre lo resuelve el servidor a partir de la sesión, nunca del parámetro de la URL (mismo principio que `spec_modulo_J.md` §3.2). | Decidido |
| R5-13 | **Turnos `PENDIENTE` abandonados.** HU-C-05 AC2 dice que un `PENDIENTE` «se descarta sin guardar», pero desde R5-1 se persiste al confirmar el paso 3 y ningún endpoint lo descarta (la Regla N.° 1 impide borrarlo). Se aprobó que 2.10 admita `PENDIENTE → CANCELADO` (sin migración; un `PENDIENTE` no reserva nada). Cómo se lee frente al AC y por qué queda como divergencia justificada: nota N-1 de 2.10. | **Aprobado por el PO (29/09/2026) — N-1** |
| R5-14 | **Cancelar un turno con pagos registrados.** El pago es inmutable y no hay anulación ni corrección hasta que se implemente la HU de corrección que el PO planificó para Sprint 3 (`spec_modulo_I.md` §3.6). Se aprobó permitir la cancelación y avisar en el `AlertDialog` cuántos pagos tiene el turno (2.10). | **Aprobado por el PO (29/09/2026) — N-3** |
| R5-15 | **Tope de anticipación al reprogramar.** Los turnos de 2.9 llegan a `generacion_maxima_meses` (6 meses) y 2.11 aplicaría el tope de 30 días a la nueva fecha. Se aprobó que al reprogramar el tope sea `max(fecha actual del turno, hoy + ANTICIPACION_MAXIMA_DIAS)` (2.11). Decidido junto con Q3. | **Aprobado por el PO (29/09/2026) — N-4** |

---

## Changelog — Revisión 5 (Sprint 2)

| HU / sección | Estado previo (Revisión 4) | Acción (Revisión 5) |
|---|---|---|
| HU-C-18 / flujo | Configurar → Aula → Profesor y alumnos | Nuevo orden Materia → Profesor → Fecha/Horario → Aula → Alumnos (R5-1). Anotadas 2.1, 2.2, 2.3, 2.6 |
| HU-C-03 / 2.1 | `POST /api/turnos` sin profesor | Recibe `profesor_id` obligatorio y valida al profesor (R5-2). Anotada, sin renumerar |
| HU-C-04 / 2.2 | Recibe `alumno_ids` + `profesor_id` obligatorio | `profesor_id` opcional. Nueva precondición `TURNO_SIN_PROFESOR` |
| HU-C-15 / 2.3 | Segundo paso del flujo | Cuarto paso. Sin cambio de contrato (HU-C-16 sin cambio de contenido) |
| HU-C-04 / 2.6 | Filtra el selector de profesor por horario del turno | Ya no es parte del wizard nuevo; se conserva para completar turnos `PENDIENTE` sin profesor (R5-2) |
| HU-C-01 / 2.4 | Listado sin búsqueda ni prioridad | El presentador agrega `prioridad`; el detalle agrega `creado_por` (email) y los pagos con su alumno (`spec_modulo_I.md`) |
| HU-C-07 | Gap | Nueva sección 2.8 |
| HU-C-17 | Gap | Nueva sección 2.9. Turnos generados `DISPONIBLE` 0/N (AC7 del backlog v2) |
| HU-C-02 / HU-C-08 | Gap | Nueva sección 2.7 |
| HU-C-05 / HU-C-06 / HU-C-10 | Gap | Nuevas secciones 2.10 a 2.12 |
| HU-C-11 | Gap | **Retirada del backlog v2.** La sección 2.13 se conserva como marcador sin contrato (sin renumerar) |
| HU-C-12 / HU-C-13 | Gap | Nueva sección 2.14 |
| Servicios públicos | Solo consumía servicios de otros módulos | Nueva sección 2.15: provee 7 funciones y el helper `emitirEventosTurno` (incluye `listarTurnosParaCalendario`, que consume HU-J-03, y `listarTurnosFuturosDeProfesorPorMateria`, que consume el modal «Ver turnos» de HU-D-07) |
| §3.1 máquina de estados | 3 estados | 4 estados: agrega `CANCELADO` terminal (y la transición `PENDIENTE → CANCELADO`, N-1) |
| Enum `EstadoTurno` | `PENDIENTE`, `DISPONIBLE`, `COMPLETO` | + `CANCELADO` (R5-5) |
| Modelo `Turno` | Sin prioridad | + `prioridadTurno` (enum `PrioridadTurno`, default `NORMAL`). **Sin** forma de pago (HU-C-11 retirada) |
| §3.4 `reservas_turno` | Trigger verificado ante cambios de duración | Relevado: ya cubre fecha, hora, estado, profesor y aula. Sin migración; pendiente prueba con `turno.reservas.pg.test.ts` |
| §4 eventos | 9 eventos | + 4 eventos nuevos y 3 ampliados (ver tabla) |
| Parámetros | — | + `generacion_maxima_meses`, `generacion_maxima_turnos` |
| Re-auditoría del 29/09/2026 | El listado 2.7 llevaba `materia_id`/`estados`/`solo_futuros`; códigos de error del profesor sin fijar; el descarte de un `PENDIENTE` sin redacción de cumplimiento; sin contrato de «Atrás»; 2.9 sin errores de las rutas de franjas ni pasos del modo masivo | Se quitan esos filtros del listado y se agrega `listarTurnosFuturosDeProfesorPorMateria` (2.15); códigos del profesor unificados (Convenciones); 2.1 documenta «Atrás»; 2.9 documenta pasos, componentes compartidos, errores y cumplimiento de AC1/AC5/AC10; 2.10 reordena el guard y redacta el descarte (N-1); 2.12 lee antes de escribir |

**Alcance de HU-C-18 sobre HU-C-03, HU-C-04 y HU-C-15 (HU-C-18 AC5).** Esas tres HU permanecen Done de Sprint 1 y **no se reabren en el backlog**: HU-C-18 es la historia que absorbe el trabajo de reordenamiento. No se les agrega ninguna regla de negocio propia: las validaciones de horario, superposición, cupo y duración son las mismas y solo cambia dónde y cuándo se piden (las validaciones de profesor de 2.2 pasan a ejecutarse también en 2.1 y se conservan en 2.2 como revalidación). Lo que sí cambia es el **contrato** de esas operaciones: 2.1 (`profesor_id` obligatorio, pasos 1b y 5b, `aula_desasignada`), 2.2 (`profesor_id` opcional, `TURNO_SIN_PROFESOR`) y 2.3 (pasa a ser el cuarto paso). Ese cambio de contrato, sus tests y la actualización de los tests existentes de C-03, C-04 y C-15 se implementan **dentro de HU-C-18**, sin reabrir aquellas HU. La estimación de HU-C-18 (5 SP) debe revisarse con esa carga (H-15 de la auditoría).

**Migraciones de la Revisión 5** (cada una en su propio archivo; el orden importa):
1. `ALTER TYPE "EstadoTurno" ADD VALUE 'CANCELADO'` — sola, sin más sentencias.
2. `CREATE TYPE "PrioridadTurno" AS ENUM ('NORMAL','ALTA','URGENTE')` + `turnos.prioridadTurno NOT NULL DEFAULT 'NORMAL'` + `turnos.modificadoPorUsuarioId` y `turnos.updatedAtTurno`, **solo si todavía no existen** en `schema.prisma` (a verificar contra el código; 2.10 a 2.12 los escriben).
3. `INSERT` en `parametros_sistema` y en `roles_permisos` (también en `seed.ts`, ver `spec_modulo_A.md` §2.4).

**Triggers de `reservas_turno`: no requieren migración.** Relevados en `20260924150000_turnos_reservas_recursos_v2`: ya reaccionan a `estadoTurno`, `fechaTurno`, `horaInicioTurno`, `duracionMinutosTurno`, `profesorId` y `aulaId` (2.10 y 2.11). Solo falta probarlo contra Postgres real.

---

## ✅ DECISIÓN RESUELTA — Gap crítico de concurrencia (abierto en HU-C-03, resuelto en la implementación real de HU-C-15, ratificado por el Scrum Master el 24/09)

El relevamiento previo a HU-C-03 había confirmado que los *exclusion constraints* que proponía la sección 3.4 (Revisión 2) nunca se migraron. La implementación real de HU-C-15 no siguió esa propuesta: en vez de `EXCLUDE USING gist` directamente sobre `turnos` (que no puede cubrir el caso de superposición por alumno, ya que un turno ahora tiene varios), se construyó una tabla unificada `reservas_turno` — un registro por recurso reservado (profesor, aula o alumno) con el rango horario del turno desnormalizado, y una única exclusión GiST sobre esa tabla, mantenida por triggers. Cubre los tres tipos de recurso con un solo mecanismo.

Este diseño **reemplaza por completo** la propuesta de la sección 3.4 de esta spec (ver 3.4 actualizada abajo) y queda ratificado como el diseño definitivo de concurrencia del módulo. Detalle completo del relevamiento y la ratificación: `docs/tasks/Sprint 1/HU-C-15.md` §3.5 y §4 (hallazgo D8).

---

## ✅ DECISIÓN RESUELTA — Origen y alcance del pedido de duración configurable (Revisión 4, no relevar de nuevo)

Pedido explícito del cliente, informado y ampliado por el PO el 24/09/2026 (el pedido original hablaba de 1h/2h; el PO amplió a 1h/2h/3h antes de que se redactara esta revisión). Propuesta formal aprobada — ver `propuesta-cambio-duracion-turno.md`, sección 5. No requiere una segunda ronda de aprobación salvo que cambie el conjunto de valores permitidos.

---

## Changelog de esta revisión

| HU / sección | Estado previo (Revisión 1) | Acción (Revisión 2) |
|---|---|---|
| HU-C-03 | Sin campo de cupo; el turno no era grupal | Se agrega `cupoMaximoTurno` (obligatorio, entero > 0, tope `2147483647` — ver nota en 2.1) al formulario y al modelo `Turno`. **Implementada 24/09.** |
| HU-C-03 / HU-C-01 | Máquina de 2 estados (`PENDIENTE` → `AGENDADO`) | Máquina de 3 estados (`PENDIENTE` → `DISPONIBLE` ⇄ `COMPLETO`), con transición automática Disponible⇄Completo según inscripciones vs. cupo. Enum migrado en base real (`prisma migrate reset --force`, consentimiento del Scrum Master, 24/09) |
| HU-C-04 | Un turno tenía exactamente un alumno (comentario del schema: "en Sprint 1 se reemplazan todos los vínculos y se crea uno solo") | Turno grupal desde este sprint: uno o varios alumnos (N:M vía `TurnoAlumno`, ya presente en `schema.prisma` pero documentada como transitoria — deja de serlo) |
| HU-C-04 | `asignarParticipantesTurno()` recibía `alumno_id` único | Pasa a recibir `alumno_ids: string[]` (carga/reemplazo inicial, 2.2); se agrega una operación nueva de alta/baja individual (2.5). **Nota:** HU-C-03 solo ajustó el código de error y el filtro de estado de esta función para que compilara con el enum nuevo — la firma sigue siendo `alumno_id` único hasta que HU-C-04 la reescriba |
| HU-C-15 | La asignación de aula transicionaba a `AGENDADO` | Transiciona a `DISPONIBLE` o directamente a `COMPLETO` (si los alumnos ya asignados alcanzan el cupo en ese mismo momento) |
| HU-C-01 | Columna "Alumno" (nombre de una persona) | Columna "Alumnos inscriptos" como ocupación sobre cupo (`"3/5"`). **Nota:** HU-C-03 adelantó la corrección del texto de estado (antes decía "Agendado" para cualquier turno no pendiente) vía `ETIQUETA_ESTADO_TURNO` en `turno.types.ts`, y agregó `cupo_maximo` al detalle — el resto del listado (`alumnos_inscriptos`, badge) sigue siendo de esta HU |
| §3.4 (constraints) | `turno_alumno_sin_superposicion` sobre `Turno.alumno_id` + `WHERE (estado = 'AGENDADO')` en las tres constraints — **documentadas como implementadas, pero el relevamiento de HU-C-03 confirmó que nunca se migraron** (ver aviso arriba) | Se redefinen para `WHERE (estado IN ('DISPONIBLE', 'COMPLETO'))`; la de alumno no puede seguir viviendo en `Turno` (ya no hay columna `alumno_id`) — ver nota en 3.4. Migración real: pendiente, a resolver en HU-C-15 |
| §3 (nueva 3.7) | No existía | Guarda de concurrencia para el cupo, con dos patrones distintos según el caso (ver 3.7) |
| Rutas de servicio/actions | Esta spec (Revisión 1) documentaba `lib/services/turnos/turno.service.ts` y `app/(dashboard)/turnos/actions.ts` | **Nota de sincronización:** el código real vive en `src/server/turnos/turno.service.ts`, `turno.schema.ts`, `turno.validaciones.ts` (Regla N.° 11). El relevamiento de HU-C-03 confirmó además que **`src/server/turnos/actions.ts` nunca se creó** — el frontend llama directamente a los Route Handlers (`fetch` a `/api/turnos/...`), sin capa de Server Action intermedia. Se documenta como divergencia aceptada (no se crea un archivo sin uso solo para cumplir la spec) — todo endpoint de esta spec que mencione "Server Action equivalente" debe leerse como aspiracional/no implementado, salvo que una task futura decida agregarlo |
| — | El formulario de configuración de turno no integraba `DirtyStateContext` (sí lo usan Alumnos, Aulas, Materias, Profesores) | HU-C-03 lo agregó al formulario, alineado con el criterio 9 (Cancelar descarta sin perder los demás valores). Implementado sin confirmación al cancelar, mismo patrón que `aula-form.tsx` |
| Convenciones generales / `ETIQUETA_ESTADO_TURNO` | Documentado en Revisión 2 (primera versión) como ubicado en `src/types/turno.types.ts` | **Corrección (relevamiento HU-C-04, 24/09):** la ubicación real es `src/app/(dashboard)/turnos/turno.types.ts` (colocated con la ruta de Turno, no en `src/types/`). Se documenta acá donde realmente vive; sin cambios de código, solo corrección de la spec |
| Guard de vigencia (2.2/2.3) | Solo se exigía explícitamente para operaciones sobre un turno `PENDIENTE` | **Decisión A (relevamiento HU-C-04, 24/09):** se extiende también a las altas/bajas individuales de 2.5 (turnos `DISPONIBLE`/`COMPLETO`). Motivo: los turnos de seed 01–06 están `DISPONIBLE`/`COMPLETO` pero con fecha ya pasada (21–24/09); sin la guarda, se podría seguir modificando la inscripción de una clase que ya ocurrió. Ver 2.5 y "Convenciones generales" |
| `HU-C-04` | **Implementada y verificada en navegador (24/09).** Backend por curl+tests, frontend verificado con los 3 roles relevantes (Mesa de Entrada, Gerente). Ver `docs/tasks/Sprint 1/HU-C-04.md` §8 para el detalle completo, incluida una segunda ronda de correcciones (mensajes de éxito, detalle del turno, `DirtyStateContext`) | — |
| `DirtyStateContext` (fuera del Módulo C) | Solo `LogoutButton` chequeaba el contexto; la navegación por el menú, el logo y otros links salía sin avisar, en todos los formularios del proyecto que usan el contexto (no solo Turno) | **Corregido durante HU-C-04 (24/09), fuera del alcance formal de esta HU pero como fix transversal necesario:** `DirtyStateProvider` ahora centraliza el diálogo de confirmación y un nuevo `<LinkProtegido>` protege toda navegación que no sea el botón explícito "Cancelar" de cada formulario (que sigue sin confirmar, por decisión ya tomada en HU-C-03). Incluye `beforeunload` para recarga/cierre de pestaña. Limitación aceptada: el botón "atrás" del navegador no se puede interceptar en App Router. Archivos tocados fuera de Turno: `src/components/sesion/dirty-state-context.tsx`, `link-protegido.tsx` (nuevo), `proteger-cache-navegador.tsx`, `src/lib/salida-sin-confirmar.ts` (nuevo), `fetch-autenticado.ts`, `src/components/layout/SidebarNav.tsx`, y links de "Volver…" en Alumnos y Profesores |
| HU-C-15 | Implementada externamente (PR #66, "Emir1481", 24/09) sin relevamiento, sin task doc y sin revisión — incluida una reescritura unilateral de esta spec y de los criterios de aceptación | **Auditada y remediada retroactivamente (24-25/09).** Ver `docs/tasks/Sprint 1/HU-C-15.md` para el detalle completo de la auditoría (17 divergencias, D1-D21) y el plan de remediación. Esta Revisión 3 reconcilia la spec con lo que quedó implementado tras la remediación: servicio real en `turno.aula.service.ts` (no en `turno.service.ts`, corrige D2), consulta a Aulas vía servicios públicos en vez de `prisma.aula` directo (D9), eventos vía `emitirEventoTurno()` (D11), tres códigos de error separados en vez de uno genérico (D10), permiso agregado al seed además de la migración (D12), diseño de concurrencia `reservas_turno`+GiST ratificado como definitivo (D8, reemplaza 3.4) |
| HU-C-03 | `cupo_maximo` es un campo obligatorio del formulario de configuración, ingresado a mano | **Revisión 3 (pedido del cliente, aprobado por el PO):** se elimina el campo del formulario y del contrato de 2.1. El cupo pasa a fijarse automáticamente al asignar aula (2.3) |
| HU-C-15 | La asignación de aula valida que la capacidad del aula alcance un cupo ya cargado (`AULA_CAPACIDAD_INSUFICIENTE`) | **Revisión 3:** ya no hay cupo previo que validar — al asignar aula, `cupoMaximoTurno = capacidadAula` se fija automáticamente. Se agrega una validación nueva para el caso de reasignar aula con alumnos ya cargados: si la nueva aula tiene menos capacidad que los alumnos ya inscriptos, se rechaza (ver 2.3) |
| HU-C-04 | El selector de profesor muestra todos los activos asociados a la materia, sin filtrar por horario; el conflicto se informa recién al confirmar | **Revisión 3:** el selector filtra de entrada — solo lista profesores con disponibilidad registrada que cubre el horario del turno y sin conflicto de reserva. Nuevo endpoint `GET /api/turnos/profesores/opciones?turno_id=` (ver 2.6, nueva) |
| HU-C-04 | Es el paso 2 del flujo (después de configurar, antes de aula); no confirma el turno por sí solo | **Revisión 3:** pasa a ser el último paso — el que confirma el turno y dispara la transición a `Disponible`/`Completo`. Se agrega un resumen de solo lectura (fecha, hora, materia, aula, cupo, estado) arriba del formulario, mismo patrón que ya usaba la pantalla de aula |
| HU-C-15 | Es el último paso del flujo; confirma el turno | **Revisión 3:** pasa a ser el segundo paso (justo después de configurar); ya no confirma el turno, solo fija el aula y el cupo — la confirmación se mueve a HU-C-04. **Reemplazado por la Revisión 5:** es el cuarto paso del wizard (R5-1) |
| Frontend, pantallas de HU-C-03 y HU-C-15 | Dos pantallas separadas (`/turnos/nuevo` y `/turnos/[id]/aula`), navegación en dos saltos | **Revisión 3 (decisión de UI, Scrum Master 24/09):** se fusionan en una sola pantalla — fecha/hora/materia arriba, la sección de aula se habilita al completar esos campos. Sigue habiendo dos llamadas al backend en secuencia (crear turno, luego asignar aula); no se crea un endpoint combinado nuevo. **Reemplazado por la Revisión 5:** wizard de 5 pasos, sin pantalla fusionada (R5-1) |
| §3.4 (constraints) | Propuesta de `EXCLUDE USING gist` directamente sobre `turnos`, nunca migrada, con el caso de alumno sin resolver | **Reemplazada por el diseño real ratificado (D8):** tabla `reservas_turno` con exclusión GiST unificada para profesor/aula/alumno, mantenida por triggers. Ver el aviso al inicio del documento y la 3.4 actualizada |
| HU-C-01 | Criterio 3: "...asignar profesor y alumnos (HU-C-04) o asignar aula (HU-C-15)" | **Revisión 3:** el orden se invierte — "...asignar aula (HU-C-15) o asignar profesor y alumnos (HU-C-04)", según el nuevo orden del flujo |
| HU-C-03 / §2.1 (**Revisión 4**) | `hora_fin = hora_inicio + DURACION_ESTANDAR_TURNO_MIN` (constante fija, no editable) | Se agrega `duracion_min` (obligatorio, uno de `DURACIONES_PERMITIDAS_TURNO_MIN`, sin default) al `ConfigurarTurnoSchema`. `hora_fin = hora_inicio + duracion_min`. **Implementada y verificada en navegador (25/09/2026), ver `HU-C-03.md` §11.** |
| Parámetros configurables (**Revisión 4**) | `DURACION_ESTANDAR_TURNO_MIN` (en el código real, fila `duracion_turno_estandar_minutos` de `ParametroSistema`) | Se reemplaza por `DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180]`, **constante en código** en `turno.schema.ts` (R4-1). La fila de `ParametroSistema` deja de leerse y se quitó del seed (R4-2) — ver tabla al pie del documento |
| Modelo de referencia, `Turno.duracionMinutosTurno` (**Revisión 4**) | Columna existente en el modelo, pero siempre derivada del parámetro fijo. Además, `modificarConfiguracionTurno()` la pisaba con el parámetro en cada edición de un turno `PENDIENTE` (bug hallado en el relevamiento) | Pasa a persistir el valor elegido por Mesa de Entradas, también al modificar (bug corregido). Sin cambio de columna ni migración: `INTEGER NOT NULL`, sin `DEFAULT` ni `CHECK`. Solo se actualizó el comentario en `schema.prisma` |
| §2.1, validación de horario operativo (**Revisión 4**) | Se validaba `[hora_inicio, hora_fin)` contenido en `HORA_APERTURA`/`HORA_CIERRE`, con `hora_fin` siempre a una distancia fija de `hora_inicio` | Misma fórmula de validación, sin cambios — pero ahora `hora_fin` varía según `duracion_min`, por lo que una franja de 2h o 3h puede rechazarse cerca del cierre operativo donde una de 1h no se rechazaría. Se agrega como caso de prueba explícito (ver 2.1, Testing) |
| §2.1, modificación de turno `PENDIENTE` (**Revisión 4**) | No contemplaba modificar la duración (no existía como campo) | Mientras el turno sigue `PENDIENTE`, `duracion_min` puede modificarse igual que `fecha`/`hora_inicio`/`materia_id`, sujeto a las mismas validaciones de horario operativo y vigencia |
| Evento `turno:configurado` (sección 4, **Revisión 4**) | Payload: `turno_id, fecha, hora_inicio, hora_fin, materia_id, usuario_id` | Se agrega `duracion_min` al payload. Además, `turno:configuracion_modificada` incluye `"duracion_min"` en `campos_modificados` cuando cambia la duración |
| Nombres de campo de duración (**Revisión 4**, R4-4) | — | **Inconsistencia documentada, no corregida:** input, respuestas de 2.1 y eventos usan `duracion_min`; el presentador de 2.4 (`presentar()`, HU-C-01) sigue exponiendo `duracion_minutos`. No se renombró para no tocar HU-C-01 |
| §3.4 (**Revisión 4**, nota de sincronización) | La forma conceptual nombraba `rango_horario`, `turno_id`, `tipo_recurso` y `recurso_id` | Nombres reales de columnas en `reservas_turno`: `inicioReserva`/`finReserva` (`timestamp(6)`; el rango se arma en la exclusión como `tsrange("inicioReserva", "finReserva", '[)')`), `turnoId`, `tipoRecurso` y `recursoId`. Solo corrección de documentación, sin cambio de código — ver 3.4 |

**Decisión de equipo, a partir de definición del PO (no relevar de nuevo):** el valor de enum `AGENDADO` se **reemplaza** por `DISPONIBLE` y `COMPLETO` (no se agrega como un cuarto estado). Como el proyecto está en Sprint 1 sin datos productivos, la migración de Prisma se aplica vía reseteo del entorno de desarrollo (`prisma migrate reset`), no vía migración de datos con `ALTER TYPE`. **Aplicado 24/09** (`prisma migrate reset --force`, consentimiento explícito del Scrum Master documentado en la conversación de la task).

**DECISIÓN RESUELTA (HU-C-03, no relevar de nuevo):** el reemplazo del enum se aplicó en HU-C-03 (no se pospuso a HU-C-15), porque es una columna compartida y posponerlo solo trasladaba el mismo trabajo de compilación forzada. Esto obligó a tocar, en la misma task, archivos fuera de `src/server/turnos/`: `src/server/calendario/calendario.service.ts` (filtro `estadoTurno`, Regla de negocio 3.2 — un turno pendiente no aparece en calendarios), su test, `src/types/calendario.types.ts`, `src/components/shared/evento-calendario.tsx`, y `prisma/seed.ts` (turnos de seed quedaron con `cupoMaximoTurno` y distribuidos en los 3 estados: 1 pendiente, 6 disponibles, 4 completos, para poder verificarlos visualmente).

**DECISIÓN RESUELTA (HU-C-04, relevamiento 24/09, no relevar de nuevo):**
- **A — Guard de vigencia en 2.5:** `turnoSigueVigente()` se aplica también a `agregarAlumnoTurno()` y `quitarAlumnoTurno()`, con `409 TURNO_VENCIDO`. Ver detalle en 2.5 y en "Convenciones generales".
- **B — Quitar el último alumno de un turno `DISPONIBLE`:** permitido. El turno queda `DISPONIBLE` con `0/N` alumnos; la spec no lo prohíbe y un turno sin alumnos sigue siendo válido para recibir inscripciones.
- **C — Identificación del alumno en conflicto (criterio 8, `ALUMNO_NO_DISPONIBLE`):** el mensaje literal exigido por la HU ("El alumno ya tiene un turno agendado en ese horario") se mantiene sin cambios; el detalle `{ alumno_id }` viaja en el `ServiceError`, la ruta lo reenvía en la respuesta y la UI lo usa solo para marcar visualmente el chip del alumno correspondiente — sin violar la Regla N.° 3 (aislamiento de módulos), porque el detalle es un dato que Turno ya tiene (no se consulta a otro módulo para obtenerlo).
- **D — Prueba de concurrencia (guarda de cupo, §3.7):** se exige en dos niveles — (1) un test unitario con mocks que verifica el orden de ejecución (`FOR UPDATE` antes del conteo), y (2) una prueba real contra la base, con dos `POST /alumnos` simultáneos sobre un turno con 1 lugar libre, esperando un `200` y un `409 CUPO_INSUFICIENTE`.

---

## 1. Visión General

El Módulo C es el núcleo operativo del sistema: gestiona el ciclo de vida de un `Turno` desde su configuración inicial hasta quedar completamente reservado y, opcionalmente, completo de inscripciones. Es una **máquina de cuatro estados** (`PENDIENTE`, `DISPONIBLE`, `COMPLETO` y, desde la Revisión 5, `CANCELADO`, ver el párrafo siguiente):

**Orden del flujo (reemplazado en la Revisión 5, R5-1):** Materia → Profesor → Fecha y Horario → Aula (fija el cupo automáticamente) → Alumnos (confirma el turno). El orden de las Revisiones 3 y 4 (Configurar → Aula → Profesor y alumnos) ya no rige. Ver nota de cambio de flujo al inicio del documento.

**Revisión 5 — cuarto estado.** La máquina pasa a cuatro estados: `DISPONIBLE ⇄ COMPLETO` siguen siendo automáticos y reversibles; `DISPONIBLE | COMPLETO → CANCELADO` (2.10) es manual y **terminal**. `PENDIENTE` **puede descartarse** (`PENDIENTE → CANCELADO`, 2.10; aprobado por el PO, N-1), porque desde R5-1 el turno se persiste al confirmar el paso 3 y no hay otra forma de sacarlo del listado. Un turno `CANCELADO` no reserva recursos (3.2), no aparece en calendarios ni en las franjas ocupadas de 2.8 y 2.3, y **conserva su historial completo** (no se borra, Regla N.° 1). Además, desde esta revisión el turno lleva `profesorId` desde el alta (R5-2) y una **prioridad** (2.12). **Excepción a "solo se sale de `PENDIENTE` en 2.2":** la generación masiva (2.9) inserta los turnos ya `DISPONIBLE` con 0 alumnos (R5-9).

```
PENDIENTE ──(asignar aula, HU-C-15, 2.3 — fija cupoMaximoTurno = capacidad del aula)──▶ sigue PENDIENTE (aún sin profesor/alumnos)
PENDIENTE ──(asignar profesor + ≥1 alumno, con aula ya asignada, HU-C-04, 2.2)──▶ DISPONIBLE o COMPLETO
DISPONIBLE ──(una inscripción alcanza el cupo máximo, HU-C-04, 2.5)──▶ COMPLETO
COMPLETO ──(se libera un lugar, HU-C-04, 2.5)──▶ DISPONIBLE
(generación masiva, 2.9)──▶ DISPONIBLE con 0 alumnos (no pasa por PENDIENTE)
DISPONIBLE | COMPLETO ──(cancelar, HU-C-05, 2.10)──▶ CANCELADO (terminal)
PENDIENTE ──(descartar, 2.10 — N-1)──▶ CANCELADO (terminal)
```

No existe ningún camino de vuelta a `PENDIENTE` una vez que el turno tiene profesor y alumnos confirmados — esa parte de la máquina de estados sigue sin reversión, igual que en la Revisión 1. Lo que sí es reversible, y automático, es la alternancia `DISPONIBLE ⇄ COMPLETO` según la cantidad de alumnos inscriptos activos comparada contra `cupoMaximoTurno`.

**Regla central que atraviesa todo el módulo:** *un turno `PENDIENTE` no reserva ningún recurso.* Dos turnos `PENDIENTE` pueden compartir el mismo profesor, alumno o aula en el mismo horario sin que eso sea un conflicto — el conflicto solo existe entre turnos `DISPONIBLE` o `COMPLETO`. Esto se traduce técnicamente en que toda validación de disponibilidad (secciones 2.2, 2.3 y 2.5) consulta exclusivamente turnos con `estadoTurno IN ("DISPONIBLE", "COMPLETO")`. **La defensa de esta regla a nivel de motor de base de datos (sección 3.4) está descripta e implementada — ver 3.4.**

**Modelo de referencia** (`model Turno` en `schema.prisma`, migrado y verificado en base real): `idTurno`, `fechaTurno`, `horaInicioTurno`, `duracionMinutosTurno` (**Revisión 4: persiste el valor elegido por Mesa de Entradas entre `DURACIONES_PERMITIDAS_TURNO_MIN`, no un parámetro fijo. La columna ya existía (`INTEGER NOT NULL`, sin `DEFAULT` ni `CHECK`): confirmado en el relevamiento, sin migración**), `materiaId` (NOT NULL), `profesorId` (nullable en la base; obligatorio en el alta desde la Revisión 5, R5-2), `aulaId` (nullable), **`cupoMaximoTurno` (nullable hasta asignar aula desde la Revisión 3; entero > 0, tope `2147483647`, cuando existe)**, `estadoTurno` — `PENDIENTE` | `DISPONIBLE` | `COMPLETO` | `CANCELADO` (Revisión 5), `createdAtTurno`, `creadoPorUsuarioId`, y las columnas que la Revisión 5 agrega o supone: `prioridadTurno` (`NORMAL` | `ALTA` | `URGENTE`), `modificadoPorUsuarioId` y `updatedAtTurno` *(a verificar contra `schema.prisma`; si no existen, las agrega la migración 2 de la Revisión 5)*. Un turno tiene **a lo sumo** un profesor (FK simple `profesorId`) y **uno o varios** alumnos, hasta `cupoMaximoTurno`, vía la tabla intermedia `TurnoAlumno` (N:M) — a diferencia de la Revisión 1, esta relación deja de ser transitoria: es el modelo definitivo de Sprint 1 (el comentario del schema sobre "etapa futura" ya fue actualizado en la migración de HU-C-03).

**Servicios públicos consumidos de otros módulos** (Regla N.° 3 de aislamiento — C no valida ni escribe directamente tablas de Alumno, Profesor, Materia o Aula; las lecturas acotadas del listado y del detalle son las excepciones expresas de §3.11, no una dispensa general de aislamiento):
- `verificarMateriaActiva(materiaId)` — Módulo L.
- `verificarAlumnoActivo(alumnoId)` (2.2 y 2.5, Mesa de Entrada; **no** la usa el autoservicio 2.14), `buscarAlumnosActivos(query)`, `obtenerAlumnoDeUsuario(usuarioId)` (2.14: identidad y `activo` del alumno) — Módulo B.
- `listarProfesoresActivosPorMateria(materiaId)`, `profesorActivoDictaMateria(profesorId, materiaId)`, `estaDentroDeHorarioAtencion(profesorId, fecha, horaInicio, horaFin)`, `obtenerHorariosDeAtencion(profesorId, db?)` (2.8.2 y franjas de 2.9), `obtenerHorarioDeProfesor(profesorId, horarioId, db?)` (2.9), `listarOpcionesProfesoresActivos()` (2.7, selector del Gerente y Mesa de Entrada), `obtenerOpcionProfesorActivo(profesorId)` (2.1 y 2.2: existencia y actividad del profesor), `obtenerOpcionProfesorDeUsuario(usuarioId)` (2.4 y 2.7: profesor vinculado a la sesión, R5-12) — Módulo D (`spec_modulo_D.md` §2.8).
- `verificarAulaActiva(aulaId)`, `hayAulasActivas()`, `existeAula(aulaId)`, `listarAulasActivasParaTurno(capacidadMinima)` (2.3, opciones de aula) — Módulo K (`hayAulasActivas` y `existeAula` se agregaron en la remediación de HU-C-15, D9, para no consultar `prisma.aula` directamente).
- `obtenerEmailDeUsuario(usuarioId)` (2.4, `creado_por`) — Módulo A. `obtenerClaseDictadaDeTurno(turnoId)` (2.4, `clase_dictada`) — Módulo E. `listarPagosDeTurno(turnoId)` (2.4, `pagos`) — Módulo I.

**Nota de trazabilidad (resuelta):** `buscarAlumnosActivos()` (búsqueda parcial por nombre/apellido/DNI, ahora usada también para agregar alumnos de a uno vía 2.5) está contractualizada en `spec_modulo_B.md` §2.8 (HU-B-04 la excluía). Se documenta acá solo como contrato consumido, no se implementa su lógica dentro de este módulo. **Confirmado en relevamiento de HU-C-04 (24/09):** la función ya existe (`alumno.service.ts:113`) con una ruta `GET /api/turnos/participantes/alumnos?q=` (permiso `turnos:asignar_participantes`), y su comportamiento coincide exactamente con lo requerido: activación desde 2 caracteres, coincidencia parcial sobre columnas normalizadas de nombre (sin mayúsculas ni acentos), DNI por coincidencia parcial, respuesta `{ id, nombre, apellido, dni }`, máximo 10 resultados. No hace falta tocar el Módulo B para HU-C-04.

**Alcance de esta revisión:** las secciones **2.1 a 2.6** son preexistentes (Sprint 1) y se ajustan mediante notas de Revisión 5 dentro de cada una, **sin renumerarlas**, porque otras specs, tasks y tests ya las referencian por número (`docs/adicionales/sdd-metodologia.md`). Las secciones **2.7 a 2.15** son nuevas y aditivas (búsqueda y filtro por profesor, disponibilidad del wizard, generación masiva, cancelar, reprogramar, prioridad, autoservicio del alumno y servicios públicos); **2.13** se conserva como marcador sin contrato (HU-C-11 retirada del backlog v2). Las reglas **3.8 a 3.13** son aditivas. Los contratos, códigos de error y decisiones de las Revisiones 3 y 4 no cambian salvo lo señalado en cada nota.

---

## 2. Interfaces y Contratos (Route Handlers / Server Actions)

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores persistidos de `Turno`, `Materia`, `Alumno`, `Profesor` y `Aula` son CUID según `schema.prisma`.
- **Ubicación de archivos (Regla N.° 11):** tipos de dominio en `src/types/turno.types.ts`; capa de servicios en `src/server/turnos/` (`turno.service.ts` y los colaboradores por área que lista la sección 3, además de `turno.schema.ts`, `turno.validaciones.ts` y `turno.disponibilidad.ts`); Route Handlers en `app/api/turnos/**/route.ts` (no le aplica la Regla N.° 11, que solo rige tipos/actions/services). **Server Actions (`src/server/turnos/actions.ts`): no implementadas — ver nota de sincronización en el changelog.** El frontend de Turno llama directamente a los Route Handlers. Imports siempre con el alias `@/`.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("turnos:<accion>")` (Regla N.° 10): `turnos:crear` (configurar y modificar configuración), `turnos:asignar_participantes` (asignación inicial y alta/baja individual de alumnos, HU-C-04), `turnos:asignar_aula`, `turnos:leer` — todas exclusivas de Mesa de Entrada salvo `turnos:leer`, disponible también para Gerente y Profesor (este último acotado a sus propios turnos, ya implementado en `listarTurnos`/`obtenerTurno`). Confirmado en relevamiento de HU-C-03: la matriz no cambia. **Reconfirmado en relevamiento de HU-C-04 (24/09):** `turnos:asignar_participantes` sigue siendo exclusivo de Mesa de Entrada, sin cambios.
- **Guard de vigencia (reutilizado por 2.2, 2.3 y, desde HU-C-04, también por 2.5 — no reimplementado por separado):** toda operación sobre un turno `PENDIENTE` revalida que `fechaTurno + horaInicioTurno` siga siendo un momento futuro (`turnoSigueVigente()`, ya implementada en `turno.validaciones.ts`). Si ya pasó: `409 TURNO_VENCIDO`, exige corregir la configuración (2.1) antes de continuar. **Decisión A (relevamiento HU-C-04, 24/09):** aunque el texto original de esta guarda solo hablaba de operaciones sobre un turno `PENDIENTE`, se extiende también a `agregarAlumnoTurno()` y `quitarAlumnoTurno()` (2.5, turnos `DISPONIBLE`/`COMPLETO`) — motivada por el hallazgo concreto de que los turnos de seed 01–06 son `DISPONIBLE`/`COMPLETO` pero con fecha ya pasada (21–24/09): sin esta guarda, se podría seguir dando de alta o de baja alumnos en una clase que ya ocurrió. Responde con el mismo `409 TURNO_VENCIDO`.
- **Guard de estado no-pendiente (nuevo):** toda validación de disponibilidad (profesor, alumno, aula) contra "turnos ya reservados" filtra `estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }` en vez de `estadoTurno: "AGENDADO"`.
- **Etiquetas de texto del estado** (`ETIQUETA_ESTADO_TURNO`, agregado en HU-C-03; ubicación corregida en relevamiento de HU-C-04, 24/09: vive en `src/app/(dashboard)/turnos/turno.types.ts`, no en `src/types/turno.types.ts`): `PENDIENTE → "Pendiente"`, `DISPONIBLE → "Disponible"`, `COMPLETO → "Completo"`, `CANCELADO → "Cancelado"` (Revisión 5). Usado en `turnos-listado.tsx` y `turno-detalle.tsx`; el resto del diseño visual del listado (badge, columna `alumnos_inscriptos`) sigue siendo responsabilidad de HU-C-01.
- **Módulo compartido `turno.disponibilidad.ts` (nuevo, Revisión 3):** `src/server/turnos/turno.disponibilidad.ts` agrupa los helpers de superposición de horario (intervalo del turno, profesores y aula con turno superpuesto) que usan en común 2.2, 2.3 y 2.6. Se creó como módulo aparte, en vez de agregar las funciones a `turno.aula.service.ts` o a `turno.profesor.service.ts` directamente, para evitar un import circular: `turno.aula.service.ts` ya importa `emitirEventoTurno` desde `turno.service.ts`, y varios de estos helpers los necesitan ambos servicios.
- **Códigos de error por estado del turno (Revisión 5, unificados).** Una situación, un código, en todas las secciones:

  | Situación | Código |
  |---|---|
  | El turno no existe | `404 TURNO_NO_ENCONTRADO` (en `GET /api/turnos/[id]`, el rol Profesor recibe `403 SIN_PERMISO`, ver más abajo) |
  | La operación no aplica a un `PENDIENTE` | `409 TURNO_PENDIENTE` |
  | El turno está `CANCELADO` | `409 TURNO_CANCELADO` (reemplaza a `TURNO_YA_CANCELADO` de 2.10) |
  | El turno ya pasó (`turnoSigueVigente`) | `409 TURNO_VENCIDO` |
  | El turno ya está confirmado y la operación exige `PENDIENTE` | `409 TURNO_YA_DISPONIBLE` |
  | `COMPLETO`, sin cupo | `409 CUPO_INSUFICIENTE` |
  | El turno cambió entre la lectura y la escritura (Regla N.° 7) | `409 TURNO_MODIFICADO` |
  | Autoservicio del alumno (2.14.2), turno `PENDIENTE` o `CANCELADO` | `409 TURNO_NO_DISPONIBLE` (traducción deliberada, no exponer el estado interno al alumno) |

  Códigos propios de otros módulos, que se conservan: `TURNO_NO_ADMITE_PAGO` (`spec_modulo_I.md` §2.4) y `TURNO_NO_ADMITE_CLASE` (`spec_modulo_E.md` §2.1), ambos para `PENDIENTE` o `CANCELADO`.
- **Revisión 5 — permisos nuevos** (`RolPermiso`, sembrados en migración y en `seed.ts`; matriz completa en `spec_modulo_A.md` §2.4): `turnos:cancelar`, `turnos:reprogramar`, `turnos:priorizar` (Mesa de Entrada); `turnos:leer_propios` y `turnos:solicitar_propio` (Alumno). `turnos:leer`, `turnos:crear`, `turnos:asignar_participantes` y `turnos:asignar_aula` no cambian.
- **Revisión 5 — archivos nuevos** (Regla N.° 11, todos en `src/server/turnos/`): `turno.generacion.service.ts` (2.9), `turno.cancelacion.service.ts` (2.10), `turno.reprogramacion.service.ts` (2.11), `turno.publico.ts` (2.15). `turno.disponibilidad.ts` y `turno.profesor.service.ts` se amplían (2.8). **`turno.publico.ts` no importa de otros módulos**; son los módulos consumidores los que importan de él.
- **Revisión 5 — ids de turno en rutas:** las rutas nuevas que reciben el `id` del turno por URL **no** lo validan como CUID (mismo criterio y motivo que la nota de sincronización de HU-C-04: los turnos de seed tienen ids `seed-turno-NN`); un id inexistente responde `404 TURNO_NO_ENCONTRADO`. **Excepción para el rol PROFESOR (respuesta neutra, alineada con `spec_modulo_J.md` §2.1):** en `GET /api/turnos/[id]` (2.4) un Profesor recibe `403 SIN_PERMISO` tanto si el turno no existe como si no es suyo, así no puede distinguir un id inexistente de uno ajeno; Gerente y Mesa de Entrada reciben `404`. El resto de los ids (alumno, profesor, aula, forma de pago, horario) sí se validan como CUID, incluido el `profesor_id` del filtro de 2.7.
- **Revisión 5 — códigos de error del profesor (unificados en 2.1, 2.2, 2.6, 2.8.2, franjas y 2.9).** Una situación, un código:

  | Situación | Código |
  |---|---|
  | Profesor inexistente **o** inactivo | `404 PROFESOR_NO_ENCONTRADO` |
  | El profesor no dicta la materia | `409 PROFESOR_NO_DICTA_MATERIA` |
  | El intervalo del turno queda fuera de su horario de atención | `409 PROFESOR_FUERA_DE_HORARIO` |
  | El profesor tiene otro turno `DISPONIBLE`/`COMPLETO` superpuesto | `409 PROFESOR_NO_DISPONIBLE` |
  | La materia no tiene ningún profesor activo asociado (selector) | `404 SIN_PROFESORES_PARA_MATERIA` |

  El módulo D distingue `PROFESOR_INACTIVO` en sus propias rutas; en Turnos se usa un solo código para inexistente/inactivo porque los servicios públicos que Turnos consume (`obtenerOpcionProfesorActivo`, `profesorActivoDictaMateria`) no distinguen ambos casos. En la generación masiva (2.9) los choques por fecha se informan como motivos (`PROFESOR_OCUPADO`, `AULA_OCUPADA`, `TURNO_EXISTENTE`), no con estos códigos.
- **Limitación conocida del entorno de desarrollo (Turbopack, Revisión 3):** con `next dev` (Turbopack, modo por defecto) la ruta `DELETE /api/turnos/[id]/alumnos/[alumnoId]` (2.5) deja de registrarse una vez que existe la carpeta `api/turnos/profesores/` (2.6), y responde con la página 404 de Next en vez de ejecutar el handler — sin que el código esté roto: funciona correctamente con `next dev --webpack` y en el build de producción. Causa raíz no diagnosticada en profundidad (asumida como un bug de ruteo de Turbopack en modo desarrollo). Workaround documentado en `README.md` ("Puesta en marcha", paso 8): usar `npx next dev --webpack` para desarrollo local. No se modificó el contrato de rutas ni `package.json` para evitar este problema.
- **Nota de sincronización (HU-C-04, 24/09):** las rutas `PATCH .../participantes`, `POST .../alumnos` y `DELETE .../alumnos/[alumnoId]` no validan el `id` del turno en la URL contra el formato CUID (a diferencia del resto de la spec). Motivo: los turnos de seed usan ids no-CUID (`seed-turno-10`, etc.) y la validación los rechazaba con `400` antes de llegar al servicio, impidiendo probar el criterio 6 contra el seed. Un id inexistente ahora responde `404` desde el servicio, igual que `GET /api/turnos/[id]`. El `alumnoId` de la URL y el `alumno_id` del body sí se siguen validando como CUID. Si se decide endurecer esto en el futuro, debe aplicarse parejo en las 4 rutas de Turno que reciben el id por URL, no solo en estas 3.

---

### 2.1. Configurar turno (HU-C-03) — IMPLEMENTADA (Revisión 3), REABIERTA EN REVISIÓN 4, IMPLEMENTADA Y VERIFICADA (Revisión 4, 25/09/2026)

> **Revisión 5 (HU-C-18, R5-1/R5-2/R5-3/R5-10).** El alta se dispara al confirmar el **paso 3** del wizard, no al empezar. `ConfigurarTurnoSchema` **agrega `profesor_id: z.string().cuid()` (obligatorio)**; `duracion_min` sigue igual. Comportamiento adicional, dentro de la misma transacción y sobre turnos `DISPONIBLE`/`COMPLETO` únicamente (3.2):
> - Paso 1b: el profesor debe existir y estar activo (`obtenerOpcionProfesorActivo(profesor_id)`, Módulo D): si no, `404 PROFESOR_NO_ENCONTRADO`; y debe dictar la materia (`profesorActivoDictaMateria(profesor_id, materia_id, tx)`, con `FOR SHARE`): si no, `409 PROFESOR_NO_DICTA_MATERIA`.
> - Paso 5b: revalidación del profesor con los mismos chequeos que 2.2 paso 5 y **con los mismos códigos fijos** (Convenciones): intervalo del turno fuera de su horario de atención (`estaDentroDeHorarioAtencion`) → `409 PROFESOR_FUERA_DE_HORARIO`, «El profesor no atiende en ese horario»; superposición con otro turno `DISPONIBLE`/`COMPLETO` del profesor (`intervalosSeSuperponen`) → `409 PROFESOR_NO_DISPONIBLE`, «El profesor ya tiene un turno en ese horario». **Se reutiliza la validación de profesor que ya implementa 2.2 paso 5; no se reescribe:** si el código real devolviera otros nombres para estos dos casos, prevalecen los de esta spec y se ajusta el código (a confirmar contra el código). Es la **revalidación de buena fe** de lo que ofreció 2.8 (HU-C-07 AC4); la defensa de motor sigue siendo `reservas_turno` al confirmar (2.2).
> - Modificación (`PATCH .../configuracion`, solo `PENDIENTE`): admite cambiar `profesor_id` además de fecha, hora, duración y materia (el cuerpo lleva siempre el `ConfigurarTurnoSchema` completo, no cambios parciales). Si cambia la materia y el profesor ya no la dicta, se rechaza con `409 PROFESOR_NO_DICTA_MATERIA` (en Revisión 4 se lo desasignaba; ahora es obligatorio, así que el cliente debe enviar el profesor nuevo en el mismo request). Si el cambio de profesor, fecha, hora o duración deja el **aula ya asignada** en conflicto (2.3 paso 2), el aula se desasigna y la respuesta lleva `"aula_desasignada": true` (R5-10).
> - Respuesta `201` agrega `"profesor_id"`. El evento `turno:configurado` agrega `profesor_id` al payload.
> - Turnos `PENDIENTE` de Revisión 4 sin profesor: siguen siendo válidos; no se migran.

**Contrato de «Atrás» y del cambio de profesor (HU-C-18 AC4).** Es lógica de cliente más el contrato de esta sección; el servidor nunca «limpia» datos, solo revalida (409) y desasigna el aula en conflicto:
1. **«Atrás» conserva** los valores de todos los pasos siguientes (en el estado del cliente mientras el turno no está persistido; en el turno `PENDIENTE` persistido una vez confirmado el paso 3). Solo se invalida lo que el cambio vuelve inválido; volver a un paso no borra nada por sí mismo.
2. **Cambiar el Profesor (paso 2) limpia el horario ya elegido** (fecha y hora de inicio del paso 3) **y lo recalcula:** el cliente vuelve a pedir `GET /api/turnos/profesores/[profesorId]/disponibilidad` (2.8.2) con el nuevo profesor y la **duración ya elegida** (que se conserva, R5-3) y obliga a elegir de nuevo fecha y hora. Hasta que se reconfirma el paso 3 **no se llama a `PATCH .../configuracion`**: el turno persistido sigue con el profesor y el horario anteriores (válidos) y el paso 3 no puede confirmarse.
3. **Cambiar la Materia (paso 1):** si el profesor elegido sigue dictando la nueva materia (2.8.1) se conservan profesor y horario; si no, se limpia el Profesor y, por dependencia (regla 2), el horario. El servidor lo respalda con `409 PROFESOR_NO_DICTA_MATERIA` (paso 8).
4. **Cambiar fecha, hora o duración (paso 3)** conserva profesor, aula y alumnos. Si el aula ya asignada queda en conflicto, el servidor la desasigna (`aula_desasignada: true`, R5-10) y el cliente informa que hay que elegir otra aula y vuelve al paso 4.
5. **Cambiar el Aula (paso 4)** conserva los alumnos ya cargados en el paso 5; el cupo se revalida al confirmar (2.2). Como los alumnos no se persisten hasta 2.2, «Atrás» desde el paso 5 no requiere llamada al servidor.

**Ruta (alta):** `POST /api/turnos`
**Ruta (modificación, mientras `PENDIENTE`):** `PATCH /api/turnos/[id]/configuracion`
**Server Action equivalente:** — (no implementada: `src/server/turnos/actions.ts` no existe y el frontend llama directamente al Route Handler, ver Convenciones generales; nombre previsto `configurarTurnoAction()`, a confirmar contra el código)
**Servicio:** `src/server/turnos/turno.service.ts` → `configurarTurno()` / `modificarConfiguracionTurno()`
**Permiso requerido:** `turnos:crear`

**Estado de esta sección:** el contrato descripto a continuación (Revisión 4, con `duracion_min`) está **implementado y verificado en navegador (25/09/2026)**. Relevamiento previo en `docs/tasks/Sprint 1/HU-C-03.md` §10 (decisiones R4-1 a R4-6), evidencia en §11.

**Cambio de Revisión 3:** se elimina `cupo_maximo` del formulario y del contrato de esta HU. El cupo ya no se ingresa a mano — se fija automáticamente al asignar aula (2.3). `cupoMaximoTurno` en el modelo pasa a ser `NULL` hasta que se asigna un aula (columna deja de ser `NOT NULL` a nivel de constraint aplicativo; a nivel de base, ver nota de migración pendiente en el plan de implementación).

**Cambio de Revisión 4:** se agrega `duracion_min` al formulario y al contrato de esta HU. Mesa de Entradas elige la duración del turno entre los valores de `DURACIONES_PERMITIDAS_TURNO_MIN` (ver tabla de parámetros al pie), sin valor preseleccionado — la elección es obligatoria en cada turno nuevo. `hora_fin` deja de calcularse contra una constante fija y pasa a calcularse contra el valor elegido.

```typescript
// src/server/turnos/turno.schema.ts
export const ConfigurarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema,          // utilidad compartida, spec_modulo_B.md §2.1
  hora_inicio: horaSchema,                     // utilidad compartida, spec_modulo_D.md §2.4
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  // duracion_min: NUEVO en Revisión 4 — obligatorio, sin default, uno de DURACIONES_PERMITIDAS_TURNO_MIN
  // (constante en este mismo archivo, R4-1). Número JSON: un string como "120" se rechaza, no se coerciona.
  duracion_min: z.number({ error: "Elegí la duración del turno" })
    .int("Elegí una duración válida (1, 2 o 3 horas)")
    .refine(esDuracionPermitida, "Elegí una duración válida (1, 2 o 3 horas)"),
  // cupo_maximo: ELIMINADO en Revisión 3 — ver 2.3, se fija automáticamente al asignar aula.
});
export type ConfigurarTurnoInput = z.infer<typeof ConfigurarTurnoSchema>;
```

**Comportamiento esperado (`configurarTurno` / `modificarConfiguracionTurno`), sin cambios de fondo respecto a Revisión 3 salvo lo marcado:**
1. Verificar `materia_id` activa (`verificarMateriaActiva()`). Si no hay materias activas en el sistema, el frontend lo indica antes de mostrar el formulario ("No hay materias activas para configurar turnos"); si igualmente se envía una inactiva: `409 MATERIA_NO_DISPONIBLE`.
2. Validar que `fecha` no sea pasada; si `fecha` es hoy, `hora_inicio` debe ser posterior a la hora actual.
3. Validar día operativo del centro (`DIAS_OPERATIVOS`).
4. **Revisión 4:** validar `duracion_min` contra `DURACIONES_PERMITIDAS_TURNO_MIN` (ya cubierto por el schema Zod, pero se revalida en el servicio como defensa en profundidad, mismo criterio que el resto de la spec). Calcular `hora_fin = hora_inicio + duracion_min`. `hora_fin` nunca es editable directamente por el cliente — es siempre derivada de `hora_inicio` + `duracion_min`.
5. Validar `[hora_inicio, hora_fin)` completamente contenido en el horario operativo (`HORA_APERTURA`, `HORA_CIERRE`). **Revisión 4:** con `hora_fin` variable, esta validación puede rechazar una franja de 2h o 3h que una de 1h con el mismo `hora_inicio` no rechazaría — comportamiento esperado, no un caso especial nuevo a programar aparte.
6. Validar que `fecha` no supere `ANTICIPACION_MAXIMA_DIAS`.
7. **Alta:** insertar con `estadoTurno: "PENDIENTE"`, `profesorId: profesor_id` (Revisión 5: obligatorio, ver la nota al inicio de esta sección; en Revisiones 3 y 4 era `null`), `aulaId: null`, `cupoMaximoTurno: null` (Revisión 3 — antes recibido del formulario), **`duracionMinutosTurno: duracion_min`** (Revisión 4 — antes era siempre la constante fija), sin alumnos vinculados. Un turno `PENDIENTE` recién creado no aparece en ningún calendario y no reserva ningún recurso.
8. **Modificación** (el turno debe existir, `404 TURNO_NO_ENCONTRADO`, y estar `PENDIENTE`; si ya es `DISPONIBLE`/`COMPLETO`, `409 TURNO_YA_DISPONIBLE`; si es `CANCELADO`, `409 TURNO_CANCELADO`): si cambia `materia_id` y el turno ya tiene `profesorId`, verificar que ese profesor siga asociado a la nueva materia (`profesorActivoDictaMateria`); si no, `409 PROFESOR_NO_DICTA_MATERIA` (Revisión 5: **ya no se desasigna automáticamente**; el cliente reenvía el profesor nuevo en el mismo request). **Revisión 3:** ya no existe `cupo_maximo` para modificar acá — el código `CUPO_MENOR_A_INSCRIPTOS` y el patrón de verificación de 3.7 para este caso quedan sin uso (el cupo ahora solo cambia al reasignar aula, ver 2.3). **Revisión 4:** si cambia `duracion_min` (con o sin cambio de `hora_inicio`), recalcular `hora_fin` y revalidar el horario operativo (paso 5) igual que en el alta — mismo tratamiento que un cambio de `hora_inicio`.
9. Emitir `turno:configurado` o `turno:configuracion_modificada` (sección 4), vía `emitirEventoTurno()` (`prisma.eventoTurno.create`), verificado en `eventos_turno`. **Revisión 3:** el payload de `turno:configurado` ya no lleva `cupo_maximo` (ver sección 4 actualizada). **Revisión 4:** el payload de `turno:configurado` agrega `duracion_min`.

**Respuesta `201 Created` (alta):**
```json
{ "data": { "id": "cuid", "fecha": "2026-04-10", "hora_inicio": "10:00", "hora_fin": "12:00", "duracion_min": 120, "profesor_id": "cuid", "cupo_maximo": null, "estado": "PENDIENTE" }, "error": null }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — fallo del `ConfigurarTurnoSchema` (fecha, `hora_inicio`, `materia_id`, `duracion_min` fuera de `DURACIONES_PERMITIDAS_TURNO_MIN`, `profesor_id` mal formado) y validaciones de los pasos 2 a 6 (fecha pasada, día no operativo, franja fuera de `HORA_APERTURA`/`HORA_CIERRE`, fecha que supera `ANTICIPACION_MAXIMA_DIAS`; código exacto a confirmar contra el código).
- `403 SIN_PERMISO` — falta `turnos:crear`.
- `404 PROFESOR_NO_ENCONTRADO` — profesor inexistente o inactivo (paso 1b).
- `404 TURNO_NO_ENCONTRADO` — en la modificación, turno inexistente.
- `409 MATERIA_NO_DISPONIBLE` — materia inactiva.
- `409 PROFESOR_NO_DICTA_MATERIA` — el profesor no dicta la materia (alta, o modificación que cambia la materia).
- `409 PROFESOR_FUERA_DE_HORARIO` — el intervalo queda fuera del horario de atención del profesor (paso 5b).
- `409 PROFESOR_NO_DISPONIBLE` — el profesor tiene otro turno `DISPONIBLE`/`COMPLETO` superpuesto (paso 5b).
- `409 TURNO_YA_DISPONIBLE` — modificación de un turno ya `DISPONIBLE`/`COMPLETO`.
- `409 TURNO_CANCELADO` — modificación de un turno `CANCELADO`.

**Frontend — Revisión 5 (vigente; reemplaza a la pantalla fusionada de las Revisiones 3 y 4):** los pasos 1 a 3 del wizard (Materia, Profesor, Fecha y Horario) viven en el cliente y el `POST /api/turnos` se hace al **confirmar el paso 3** (R5-1). El aula es el paso 4 (pantalla propia, `PATCH .../aula`, 2.3) y los alumnos el paso 5 (2.2). Ya no existe la vista fusionada de fecha/hora/materia + aula ni la llamada encadenada `POST` + `PATCH .../aula`. **Selector de duración (Revisión 4, R4-3; ubicación en Revisión 5, R5-3):** grupo de radios nativo «Duración *» (tres opciones, sin preselección) dentro del paso 3, antes de fecha y hora, en `turno-configuracion.tsx` (sin componente nuevo). Las horas de inicio ofrecidas dependen de la duración elegida (la última es `cierre − duración`). Si cambiar la duración deja fuera la hora ya elegida, esa hora se limpia con un aviso, igual que al cambiar la fecha. El paso 4 (aula) se habilita recién con el turno persistido en el paso 3.

**A verificar cuando se implemente la Revisión 3 (ya verificado):** que el formulario ya no muestre el campo de cupo, que el mensaje de éxito ofrezca continuar con la asignación de aula (no con participantes), y que la modificación de un turno `PENDIENTE` sin aula todavía no muestre ningún dato de cupo.

**A verificar cuando se implemente la Revisión 4 (✅ verificado el 25/09/2026, todos los puntos: los de UI en navegador por el Scrum Master, los de backend/motor con tests, curl y SQL — ver `HU-C-03.md` §11):**
- Que el formulario exija elegir una de las tres duraciones antes de habilitar el envío (sin default).
- Que la validación de horario operativo rechace correctamente una franja de 2h/3h cerca de `HORA_CIERRE` que sí sería válida como turno de 1h — caso de prueba explícito.
- Que la modificación de un turno `PENDIENTE` permita cambiar `duracion_min` y recalcule `hora_fin` correctamente, revalidando horario operativo.
- Que `reservas_turno` (3.4) arme `rango_horario` a partir de `hora_inicio`/`hora_fin` reales del turno (no de una constante) — confirmar contra el trigger real, no asumir.
- Que el evento `turno:configurado` lleve `duracion_min` en el payload real, no solo en la spec.
- Que HU-C-01 (listado) y el calendario (`spec_modulo_J.md`) sigan funcionando sin cambios con turnos de distinta duración — verificación de regresión, no de funcionalidad nueva.

---

### 2.2. Asignar profesor y alumnos al turno — carga inicial y confirmación (HU-C-04) — IMPLEMENTADA, REABIERTA EN REVISIÓN 3, sin cambios en Revisión 4

> **Nota posterior (08/10/2026).** Sin cambios de contrato. Al pasar a `DISPONIBLE` el bloqueo suma al profesor y se relee que siga activo (HU-D-08), y el alumno se relee ya bloqueado (HU-B-07): ver 2.21.3.

> **Revisión 6 (Sprint 3, convención 8 a).** Ruta, cuerpo, respuesta y `code` de error **sin cambios**. Por dentro, el paso 7 deja de hacer `deleteMany` + `createMany` de `TurnoAlumno`: reconcilia las inscripciones (las que salen del conjunto quedan `QUITADA_CENTRO`, las nuevas se crean con `crearInscripcion` y las que se mantienen no se tocan; ver 2.16.6). Se suman los errores `422 MATERIA_SIN_TARIFA` (HU-L-06, criterio 5) y, solo como resguardo, `409 INSCRIPCION_REQUIERE_PAGO` (2.18.3). Los pasos 4 y 5 consideran solo inscripciones vigentes. Desde HU-C-24 las inscripciones quedan como reserva con plazo y la respuesta suma `inscripciones` (2.18.3). El paso 8 sigue siendo la única salida de `PENDIENTE` (3.16).


> **Revisión 5 (HU-C-18, R5-2).** Sigue siendo la operación que **confirma** el turno y el **quinto y último paso** del wizard (Agregar Alumnos). Cambios: (1) `AsignarParticipantesTurnoSchema.profesor_id` pasa a **opcional**; (2) si el turno ya tiene `profesorId` y no se envía, se usa el existente; si se envía uno distinto, se revalida como en el paso 5 y reemplaza al anterior (solo mientras `PENDIENTE`); (3) si el turno no tiene profesor y no se envía: `409 TURNO_SIN_PROFESOR`, "Elegí un profesor antes de confirmar el turno"; (4) el paso 4 **revalida siempre** que el profesor (enviado o ya asignado) exista y esté activo (`404 PROFESOR_NO_ENCONTRADO`) y siga dictando la materia (`409 PROFESOR_NO_DICTA_MATERIA`); `SIN_PROFESORES_PARA_MATERIA` (404) solo aplica cuando se envía un profesor nuevo. El resto de los pasos, la transición y los eventos **no cambian**. Precondición existente `TURNO_SIN_AULA` se mantiene: el aula ahora se elige en el paso 4, antes de este.

Esta operación es el **combo inicial**: carga profesor + el conjunto completo de alumnos de una sola vez. **Cambio de Revisión 3: pasa a ser el último paso del flujo** (antes era el segundo; ahora requiere que el turno ya tenga aula asignada, ver 2.3) — es la operación que **confirma** el turno y dispara la transición a `Disponible`/`Completo` (antes esa transición ocurría al asignar aula). Para agregar o quitar un alumno de a uno una vez que el turno ya está confirmado, ver **2.5** (sin cambios).

**Ruta:** `PATCH /api/turnos/[id]/participantes`
**Server Action equivalente:** — (no implementada: `src/server/turnos/actions.ts` no existe y el frontend llama directamente al Route Handler, ver Convenciones generales; nombre previsto `asignarParticipantesTurnoAction()`, a confirmar contra el código)
**Servicio:** `src/server/turnos/turno.service.ts` → `asignarParticipantesTurno()`
**Permiso requerido:** `turnos:asignar_participantes` (exclusivo de Mesa de Entrada)

**Frontend (Revisión 3):** la pantalla agrega un resumen de solo lectura arriba del formulario, con fecha, hora, materia, **aula y cupo ya asignados** (2.3) y el badge de estado — mismo patrón que ya usaba la pantalla de aula en Revisión 2. **Revisión 5:** el profesor ya viene elegido del paso 2 (2.8.1); el selector de profesor con filtro por disponibilidad (2.6) solo se muestra para completar un `PENDIENTE` de la Revisión 4 que no tiene profesor.

```typescript
export const AsignarParticipantesTurnoSchema = z.object({
  // CAMBIA: antes z.string().cuid() único, ahora arreglo (HU-C-04 criterio 1)
  alumno_ids: z.array(z.string().cuid())
    .min(1, "Agregá al menos un alumno")
    .refine((ids) => new Set(ids).size === ids.length, "El mismo alumno no puede agregarse dos veces"),
  // Revisión 5 (R5-2): opcional. Si el turno ya tiene profesor (paso 2 del wizard), se usa el existente;
  // si no lo tiene y no se envía, el servicio responde 409 TURNO_SIN_PROFESOR (no lo decide el schema).
  profesor_id: z.string().cuid().optional(),
});
export type AsignarParticipantesTurnoInput = z.infer<typeof AsignarParticipantesTurnoSchema>;
```

**Comportamiento esperado (dentro de la misma `prisma.$transaction` que ya usa `asignarParticipantesTurno`):**
1. Leer el `Turno`; debe existir (`404 TURNO_NO_ENCONTRADO`) y estar `PENDIENTE` (si ya `DISPONIBLE`/`COMPLETO`: `409 TURNO_YA_DISPONIBLE`; si `CANCELADO`: `409 TURNO_CANCELADO`). **Revisión 3, precondición nueva:** el turno debe tener `aula_id` ya asignado — si no, `409 TURNO_SIN_AULA`, "Asigná un aula antes de confirmar el turno" (sin aula no hay `cupoMaximoTurno` contra el cual validar). Aplicar el guard de vigencia (`turnoSigueVigente`). **Ajuste de implementación (Revisión 3):** dado que este paso ahora es el que confirma el turno, revalida también `MATERIA_NO_DISPONIBLE` (la materia sigue activa) y `AULA_INACTIVA` (el aula asignada en 2.3 sigue activa) — estas dos validaciones vivían únicamente en 2.1 y 2.3 respectivamente cuando la confirmación ocurría en la asignación de aula (Revisión 2); al mover la confirmación acá, se preservan ambas garantías revalidándolas también en este paso, por si algo cambió entre que se configuró/asignó aula y que se confirma.
2. Validar `alumno_ids.length <= turno.cupoMaximoTurno`. Si excede: `409 CUPO_INSUFICIENTE`, "El turno alcanzó su cupo máximo" (HU-C-04 criterio 5) — se informa sin persistir nada.
3. Verificar cada `alumno_id` activo (`verificarAlumnoActivo()`, Módulo B: `404 ALUMNO_NO_ENCONTRADO` / `409 ALUMNO_INACTIVO`). Ante cualquier alumno inválido, se informa cuál.
4. **Revalidar el profesor (Revisión 5, corrige un hueco: `spec_modulo_D.md` §2.7 depende de este paso).** El profesor efectivo es el enviado o, si no se envía, `turno.profesorId`. En este orden: (a) si se envía un profesor nuevo y la materia no tiene ningún profesor activo asociado (`listarProfesoresActivosPorMateria()` vacío): `404 SIN_PROFESORES_PARA_MATERIA`; (b) el profesor efectivo debe existir y estar activo (`obtenerOpcionProfesorActivo()`): si no, `404 PROFESOR_NO_ENCONTRADO`; (c) **siempre**, sea nuevo o ya asignado, invocar `profesorActivoDictaMateria(profesor_id, turno.materiaId, tx)` (Módulo D, con `FOR SHARE`); si es `false`: `409 PROFESOR_NO_DICTA_MATERIA`. *Test obligatorio:* turno `PENDIENTE` con profesor → quitarle la materia (HU-D-07) → confirmar → `409 PROFESOR_NO_DICTA_MATERIA`. **Revisión 3:** dado que el selector de frontend ya filtra por disponibilidad (2.8.2 en el wizard nuevo; 2.6 solo para completar un `PENDIENTE` sin profesor), llegar acá con un `profesor_id` fuera de horario o en conflicto solo pasa si el frontend está desactualizado respecto al momento de la carga — igual se revalida en el paso 5.
5. **Validación de disponibilidad (aplicativa, contra turnos `DISPONIBLE`/`COMPLETO` únicamente):**
   - Profesor: intervalo del turno contenido en su horario de atención (`estaDentroDeHorarioAtencion`; si no, `409 PROFESOR_FUERA_DE_HORARIO`), y sin superposición con otro turno `DISPONIBLE`/`COMPLETO` de ese profesor (fórmula de `spec_modulo_D.md` §3.4, ya implementada en `intervalosSeSuperponen`; si no, `409 PROFESOR_NO_DISPONIBLE`). Son los mismos códigos de 2.1 paso 5b.
   - Cada alumno de `alumno_ids`: no debe tener otro turno `DISPONIBLE`/`COMPLETO` que se superponga con el mismo intervalo (HU-C-04 criterio 4): `409 ALUMNO_NO_DISPONIBLE` con `{ alumno_id }` (Decisión C de 2.5). Si cualquiera falla, se identifica cuál.
   - Aula: revalidar que sigue disponible en ese horario (puede haber cambiado desde que se asignó en 2.3): `409 AULA_NO_DISPONIBLE`.
   - Si hay conflicto: `409` con el código del recurso puntual (`PROFESOR_FUERA_DE_HORARIO`, `PROFESOR_NO_DISPONIBLE`, `ALUMNO_NO_DISPONIBLE` o `AULA_NO_DISPONIBLE`). El turno conserva su estado y valores anteriores.
6. **Defensa final de concurrencia:** protegida por la exclusión GiST de `reservas_turno` (ver 3.4 actualizada) — a diferencia de Revisión 2, esta ya no es solo una validación de buena fe: el mecanismo de motor existe y está ratificado (D8).
7. `updateMany` del `profesorId` (`where: { idTurno: turnoId, estadoTurno: "PENDIENTE" }`, `count === 0` ⇒ `409 TURNO_MODIFICADO`), luego `deleteMany` de `TurnoAlumno` del turno y `createMany` con el nuevo conjunto de `alumno_ids`.
8. **Revisión 3 — evaluar la transición (antes vivía en 2.3):** con profesor, aula y `alumno_ids` ya confirmados, calcular `nuevoEstado = alumno_ids.length >= cupoMaximoTurno ? "COMPLETO" : "DISPONIBLE"` y `UPDATE turno SET estadoTurno = nuevoEstado WHERE idTurno = turnoId AND estadoTurno = "PENDIENTE"`. Este es ahora el único punto del flujo donde el turno sale de `PENDIENTE`.
9. Mientras el turno siga `PENDIENTE` (por ejemplo, si se guardó sin llegar a completar el combo), este mismo endpoint permite **reemplazar** el combo completo las veces que haga falta.
10. Emitir `turno:participantes_asignados` y, si hubo transición, `turno:disponibilizado` o `turno:completado` según `nuevoEstado`, ambos después del `COMMIT` — antes estos dos últimos se emitían desde 2.3.

**Nota Revisión 4:** la validación de disponibilidad del paso 5 (fórmula `intervalosSeSuperponen`) ya opera sobre el intervalo real `[hora_inicio, hora_fin)` del turno, sea cual sea su duración — no requiere cambios de código para soportar duraciones de 1h/2h/3h. **Confirmado en el relevamiento** (`HU-C-03.md` §10.2): `intervaloTurno()` suma el `duracionMinutosTurno` persistido. Sin cambios en esta sección. Consecuencia de comportamiento, no de código: como `estaDentroDeHorarioAtencion()` (Módulo D) exige un único bloque de atención, con turnos de 2h/3h es más frecuente que no haya profesor disponible.

**Respuesta `200 OK` (confirma el turno):**
```json
{ "data": { "id": "cuid", "alumno_ids": ["cuid1", "cuid2"], "profesor_id": "cuid", "cupo_maximo": 5, "estado": "DISPONIBLE" }, "error": null }
```

**Respuesta `409 Conflict` (sin aula asignada):**
```json
{ "data": null, "error": { "code": "TURNO_SIN_AULA", "message": "Asigná un aula antes de confirmar el turno" } }
```

**Respuesta `409 Conflict` (cupo insuficiente para el combo):**
```json
{ "data": null, "error": { "code": "CUPO_INSUFICIENTE", "message": "El turno alcanzó su cupo máximo" } }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — `alumno_ids` vacío o con duplicados, ids que no son CUID.
- `403 SIN_PERMISO` — falta `turnos:asignar_participantes`.
- `404 TURNO_NO_ENCONTRADO` — turno inexistente.
- `404 ALUMNO_NO_ENCONTRADO` — algún alumno no existe.
- `404 SIN_PROFESORES_PARA_MATERIA` — se envía un profesor nuevo y la materia no tiene profesores activos.
- `404 PROFESOR_NO_ENCONTRADO` — profesor inexistente o inactivo.
- `409 TURNO_YA_DISPONIBLE` / `409 TURNO_CANCELADO` / `409 TURNO_VENCIDO` — estado o vigencia del turno.
- `409 TURNO_SIN_AULA` — el turno no tiene aula asignada.
- `409 TURNO_SIN_PROFESOR` — el turno no tiene profesor y no se envió uno.
- `409 MATERIA_NO_DISPONIBLE` / `409 AULA_INACTIVA` — la materia o el aula dejaron de estar activas.
- `409 CUPO_INSUFICIENTE` — `alumno_ids.length` supera `cupoMaximoTurno`.
- `409 ALUMNO_INACTIVO` — algún alumno está inactivo.
- `409 PROFESOR_NO_DICTA_MATERIA` / `409 PROFESOR_FUERA_DE_HORARIO` / `409 PROFESOR_NO_DISPONIBLE` — revalidación del profesor.
- `409 ALUMNO_NO_DISPONIBLE` — alumno con otro turno superpuesto (con `{ alumno_id }`).
- `409 AULA_NO_DISPONIBLE` — el aula quedó ocupada en ese horario.
- `409 TURNO_MODIFICADO` — el turno cambió entre la lectura y la escritura (Regla N.° 7).

---

### 2.3. Asignar aula al turno — fija el cupo automáticamente (HU-C-15) — REMEDIADA, REABIERTA EN REVISIÓN 3, sin cambios en Revisión 4

> **Revisión 5 (HU-C-16, HU-C-18).** **Sin cambios de contrato ni de comportamiento en `PATCH .../aula` ni en la ruta de opciones (HU-C-16 AC5: sin cambios de contenido respecto de lo implementado en Sprint 1); solo cambia la posición en el wizard.** Pasa de ser el segundo al **cuarto paso** del wizard. Como el turno ya existe (`PENDIENTE`, con profesor, fecha, hora y duración) cuando se llega acá (R5-1), el frontend usa siempre `GET /api/turnos/aula/opciones?turno_id=` con el `turno_id` real, que filtra por disponibilidad horaria; el modo sin `turno_id` (H1, Revisión 3) **se conserva** en el contrato, sin cambios, aunque el wizard ya no lo usa (ver «Ruta de opciones»). HU-C-16 AC1 a AC4 ya están cubiertos por 2.3: cada opción muestra nombre/número y capacidad, "No hay aulas disponibles para este horario" ante lista vacía con oferta de volver al paso 3, y revalidación al confirmar.

**Cambio de Revisión 3 (reemplazado por la Revisión 5: es el cuarto paso, ver la nota de arriba):** en la Revisión 3 pasó a ser el segundo paso del flujo (antes era el último y confirmaba el turno; la confirmación se movió a 2.2). Ya no valida contra un cupo preexistente — **lo fija automáticamente** a partir de la capacidad del aula elegida.

**Ruta:** `PATCH /api/turnos/[id]/aula`
**Ruta de opciones:** `GET /api/turnos/aula/opciones?turno_id=` — contractualizada en la Revisión 3 (ya existía en la implementación real, no estaba documentada, D3). **Revisión 5:** sin cambios de contrato (HU-C-16 AC5). `turno_id` sigue siendo opcional: el wizard siempre lo envía, porque el turno se persiste al confirmar el paso 3 (R5-1); el modo sin `turno_id` de la Revisión 3 (H1: listar todas las aulas activas cuando todavía no existía el turno) se conserva tal como está implementado, sin consumidor en el wizard actual. Si el equipo decide retirarlo, es un cambio de contrato de HU-C-16 que hay que acordar con el PO. Filtra por disponibilidad horaria y por capacidad: `capacidadMinima = max(1, alumnos.length)` (relevante para reasignar aula con alumnos ya cargados, ver paso 3 más abajo). `capacidadMinima` es una **cota inferior** (`capacidad >= capacidadMinima`) y **no** el cupo del turno, que no existe hasta elegir aula; se pasa a `listarAulasActivasParaTurno(capacidadMinima)` del Módulo K (en `spec_modulo_K.md` ese parámetro se llama `cupoMaximo`, nombre que induce a error: debe leerse y renombrarse como capacidad mínima). **Errores esperados (ruta de opciones):** `400` (`turno_id` ausente) · `403 SIN_PERMISO` · `404 TURNO_NO_ENCONTRADO` · `404 SIN_AULAS_ACTIVAS` (`hayAulasActivas()`, mismo criterio que el paso 2 de `PATCH`) · `409 TURNO_YA_DISPONIBLE` (turno `DISPONIBLE`/`COMPLETO`) · `409 TURNO_CANCELADO`. Si hay aulas pero ninguna libre y con capacidad suficiente en ese horario: `200` con `data: []`; la UI muestra «No hay aulas disponibles para este horario» y ofrece volver al paso 3. No aplica el guard de vigencia (es solo lectura; lo aplica el `PATCH`).
**Server Action equivalente:** — (no implementada: `src/server/turnos/actions.ts` no existe y el frontend llama directamente al Route Handler, ver Convenciones generales; nombre previsto `asignarAulaTurnoAction()`, a confirmar contra el código)
**Servicio:** `src/server/turnos/turno.aula.service.ts` → `asignarAulaTurno()` / `listarOpcionesAulaTurno()` (corrige D2 — no vive en `turno.service.ts` como decía Revisión 2)
**Permiso requerido:** `turnos:asignar_aula`

```typescript
export const AsignarAulaTurnoSchema = z.object({
  aula_id: z.string().cuid(),
});
export type AsignarAulaTurnoInput = z.infer<typeof AsignarAulaTurnoSchema>;
```

**Comportamiento esperado, íntegramente dentro de una única `prisma.$transaction`:**
1. Leer el `Turno`; debe existir (`404 TURNO_NO_ENCONTRADO`). Si ya es `DISPONIBLE`/`COMPLETO`: `409 TURNO_YA_DISPONIBLE`; si es `CANCELADO`: `409 TURNO_CANCELADO`. Aplicar el guard de vigencia.
2. Verificar `aula_id` (remediación D9/D10 — cuatro casos, ya no uno genérico):
   - No hay ninguna aula activa en el sistema (`hayAulasActivas()`): `404 SIN_AULAS_ACTIVAS`.
   - El `aula_id` recibido no existe (`existeAula()`): `404 AULA_NO_ENCONTRADA`.
   - El `aula_id` existe pero está inactiva: `409 AULA_INACTIVA`, "El aula seleccionada no está activa".
   - El aula está activa pero ocupada en ese horario por otro turno `DISPONIBLE`/`COMPLETO`: `409 AULA_NO_DISPONIBLE` (este código queda reservado solo para el conflicto de horario desde la remediación).
   - En los cuatro casos el turno permanece sin cambios.
3. **Revisión 3 — fijar el cupo:** `cupoMaximoTurno = aula.capacidadAula`. Si el turno **ya tiene alumnos cargados** (reasignación de aula) y la nueva capacidad es menor a la cantidad de alumnos ya inscriptos: `409 AULA_CAPACIDAD_INSUFICIENTE`, "El aula elegida tiene menos capacidad que los alumnos ya inscriptos en este turno" — no se guarda el cambio. Si el turno todavía no tiene alumnos (caso normal: el aula es el cuarto paso del wizard), no aplica esta validación. **Nota (H3, relevamiento Revisión 3):** en el flujo normal de esta revisión, esta validación es en la práctica **inalcanzable** — un turno `PENDIENTE` nunca llega a tener alumnos confirmados, porque 2.2 (la única operación que carga alumnos) siempre transiciona el turno fuera de `PENDIENTE` al confirmar con éxito, y esta ruta (2.3) solo opera sobre turnos `PENDIENTE`. Se implementa y documenta igual, como defensa en profundidad ante cambios futuros del flujo, no porque el caso ocurra hoy.
4. Actualizar `aula_id` y `cupoMaximoTurno` (`updateMany` con `where: { idTurno, estadoTurno: "PENDIENTE" }`, `count === 0` ⇒ `409 TURNO_MODIFICADO`). El turno permanece `PENDIENTE` — **ya no transiciona acá** (Revisión 3: la transición se movió a 2.2, ver ese punto 8).
5. Emitir `turno:aula_asignada`, vía `emitirEventoTurno()` (remediación D11 — antes era un `prisma.eventoTurno.create` directo).
6. **Reemplazo de aula mientras sigue `PENDIENTE`:** este mismo endpoint permite reemplazar el `aula_id` (y recalcular `cupoMaximoTurno`) las veces que haga falta, sujeto a la validación del paso 3 si ya hay alumnos.

**Nota Revisión 4:** la validación de disponibilidad de aula (paso 2, contra turnos `DISPONIBLE`/`COMPLETO` superpuestos) ya opera sobre el intervalo real del turno — no requiere cambios. **Confirmado en el relevamiento** (`HU-C-03.md` §10.2): `aulaConTurnoSuperpuesto()` y `validarIntervalo()` no suponen una duración fija.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "aula_id": "cuid", "cupo_maximo": 30, "estado": "PENDIENTE" }, "error": null }
```

**Respuesta `409 Conflict` (capacidad insuficiente al reasignar con alumnos ya cargados):**
```json
{ "data": null, "error": { "code": "AULA_CAPACIDAD_INSUFICIENTE", "message": "El aula elegida tiene menos capacidad que los alumnos ya inscriptos en este turno" } }
```

**Errores esperados (`PATCH .../aula`):**
- `400 VALIDATION_ERROR` — `aula_id` ausente o que no es CUID.
- `403 SIN_PERMISO` — falta `turnos:asignar_aula`.
- `404 TURNO_NO_ENCONTRADO` — turno inexistente.
- `404 SIN_AULAS_ACTIVAS` — no hay ninguna aula activa.
- `404 AULA_NO_ENCONTRADA` — el `aula_id` no existe.
- `409 TURNO_YA_DISPONIBLE` / `409 TURNO_CANCELADO` / `409 TURNO_VENCIDO` — estado o vigencia del turno.
- `409 AULA_INACTIVA` — el aula existe pero está inactiva.
- `409 AULA_NO_DISPONIBLE` — el aula está ocupada en ese horario.
- `409 AULA_CAPACIDAD_INSUFICIENTE` — la nueva capacidad es menor a los alumnos ya inscriptos.
- `409 TURNO_MODIFICADO` — el turno cambió entre la lectura y la escritura (Regla N.° 7).

---

### 2.4. Listado y detalle de turnos (HU-C-01) — sin cambios en Revisión 4

> **Revisión 6.** `alumnos_inscriptos` y la lista `alumnos` cuentan solo inscripciones **vigentes**, y `estado` se decide con la ocupación real (2.16.5). El detalle suma por alumno `inscripcion` y `puede_registrar_pago` (2.18.4). Sin otros cambios de contrato. Esos campos por alumno **no se envían al Profesor** (no ve precios, HU-L-06 criterio 7): solo con `pagos:leer`. `puede_ver_historial` conserva el campo, pero su valor para el Profesor lo calcula C con la primera condición de la convención 8 g (`PR-0.md` §2.9): el alumno es un inscripto vigente de una clase suya, dato que el detalle ya tiene, así que **no llama a E** (Regla N.° 3; `spec_modulo_E.md` 2.5.3). Reemplaza a `profesorAtendioAlumno` (Q7b), que E conserva exportada pero ya no usa. El alcance del Gerente al detalle (modo consulta) lo fija `PR-0.md` §2.9.


> **Revisión 5 (HU-C-09, HU-C-10, HU-C-02, HU-C-08).** El presentador `presentar()` agrega: `prioridad` (`"NORMAL" | "ALTA" | "URGENTE"`), y `creado_en`. **El detalle** (`GET /api/turnos/[id]`) agrega además: `creado_por` (email vía `obtenerEmailDeUsuario()`; `null` si no hay dato, nunca el id), `cupo_maximo`, `duracion_minutos`, el listado completo de `alumnos`, `pagos` (`listarPagosDeTurno()`, cada uno con su **alumno**, monto, forma de pago y fecha, solo si el rol tiene `pagos:leer`), `clase_dictada` (`{ id, registrada_en } | null`, vía `obtenerClaseDictadaDeTurno()` de `spec_modulo_E.md` §2.4) y `acciones_habilitadas` (lista de las acciones que el estado y el rol permiten: `cancelar` (turno `DISPONIBLE`/`COMPLETO` vigente, permiso `turnos:cancelar`; **nunca** para un `PENDIENTE`, HU-C-05 AC2), `descartar` (solo `PENDIENTE`, permiso `turnos:cancelar`, N-1, 2.10), `reprogramar` (`DISPONIBLE`/`COMPLETO` vigente, permiso `turnos:reprogramar`), `prioridad` (cualquier estado salvo `CANCELADO`, permiso `turnos:priorizar`), `registrar_pago` (condición de `spec_modulo_I.md` §2.4) y `registrar_clase` (condición de `spec_modulo_E.md` §2.1 paso 4: turno `DISPONIBLE`/`COMPLETO`, `fecha + hora_fin ≤ ahora`, sin clase dictada previa y, para el Profesor, solo sus propios turnos)). Cada alumno inscripto lleva el enlace "Ver historial" cuando el rol tiene `historial:leer` (`spec_modulo_E.md` §2.3, Q13 ratificado por el PO el 29/09/2026). Cada elemento de `alumnos[]` lleva `puede_ver_historial: boolean`: para Gerente y Mesa de Entrada es `true`; para el Profesor es el resultado de `profesorAtendioAlumno()` (`spec_modulo_E.md` §2.4, Q7b) y el enlace se oculta cuando es `false`. Es el punto de entrada del Gerente y del Profesor a la ficha del alumno. Un profesor que consulta un turno que no es suyo recibe `403 SIN_PERMISO`, y recibe **el mismo** `403` si el id no existe (respuesta neutra, igual que `spec_modulo_J.md` §2.1: no puede distinguir un turno inexistente de uno ajeno); Gerente y Mesa de Entrada reciben `404 TURNO_NO_ENCONTRADO` ante un id inexistente. Los datos no asignados de un `PENDIENTE` se muestran `"Sin asignar"` (D4). **`creado_por`:** `Usuario` no tiene nombre (solo `emailUsuario`) y el personal de mesa de entrada no tiene ficha; se muestra el **email** vía el servicio público de Módulo A `obtenerEmailDeUsuario()` (nunca un `SELECT` sobre `usuarios`). Si `creadoPorUsuarioId` es `null` (p. ej. turnos de seed) o el servicio devuelve `null` (cuenta inexistente), `creado_por` es `null` en la API y la UI muestra «Sin registrar». El listado agrega los parámetros de 2.7 (`q`, `profesor_id`) y muestra el indicador visual de prioridad `ALTA`/`URGENTE` (texto o ícono, no solo color). Vista de la pantalla: mapa de pantallas §1, fila "Detalle de turno".
>
> Decisiones del PO (30/09/2026): «Creado por» muestra el email; no se implementa «Total registrado» (no figura en los criterios de HU-C-09 ni de HU-I-01). `creado_por` no se incluye en el listado en esta entrega (decisión del SM, 30/09/2026).
>
> **Nota de sincronización — «Total registrado» (01/10/2026):** la decisión del 30/09/2026 de no mostrar «Total registrado» quedó reemplazada por la implementación aprobada de HU-I-01 (PR #148) y por el prototipo de pantallas. La tarjeta «Pago» del detalle muestra «Total registrado» debajo de la lista de pagos, separado por una línea, y «Ninguno todavía.» sin total cuando no hay pagos. Es la suma de los pagos registrados: no representa saldo, precio esperado ni validación del monto (`spec_modulo_I.md`, presentación del 01/10/2026). Las demás decisiones del 30/09 siguen vigentes.

**Ruta (listado):** `GET /api/turnos` · **Ruta (detalle):** `GET /api/turnos/[id]`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `src/server/turnos/turno.service.ts` → `listarTurnos()` / `obtenerTurno()` (ya implementadas, ver función `presentar()`)
**Permiso requerido:** `turnos:leer`

**Comportamiento esperado (cambia el presentador `presentar()`):**
- Incluye turnos en los 4 estados (`PENDIENTE`, `DISPONIBLE`, `COMPLETO`, `CANCELADO`). Cada ítem: `fecha`, `hora_inicio`–`hora_fin`, **`alumnos_inscriptos`** (`"3/5"`, ocupación sobre `cupoMaximoTurno` — reemplaza el campo `alumno`/`alumnos` de nombres de Revisión 1), `profesor` (`"Apellido, Nombre"` o `"Sin asignar"`), `materia`, `aula` (ídem o `"Sin asignar"`), `estado` (texto: `Pendiente` | `Disponible` | `Completo` | `Cancelado`, ya disponible vía `ETIQUETA_ESTADO_TURNO`, adelantado por HU-C-03). **Nota:** HU-C-03 ya agregó `cupo_maximo` al `presentar()` (para precargar el formulario de modificación) y lo mostró también en el detalle del turno; `alumnos_inscriptos` en sí sigue pendiente de esta HU-C-01. **D4 (Revisión 3):** mientras el turno no tiene aula (`cupoMaximoTurno` es `null`), no hay ocupación que mostrar — `alumnos_inscriptos` muestra el texto `"Sin asignar"` en vez de `"0/N"`, ya que todavía no existe un `N` contra el cual expresar la ocupación.
- Orden por defecto: `fecha, hora_inicio` ascendente desde la fecha actual en adelante; `profesor_id` como segundo criterio de desempate — sin cambios respecto a `listarTurnos()` actual.
- Los turnos `PENDIENTE` se distinguen con la etiqueta "Pendiente" y ofrecen continuar su configuración — **Revisión 3, orden invertido (HU-C-01 criterio 3):** primero asignar aula (2.3) si todavía no la tiene, y recién si ya la tiene, asignar profesor y alumnos (2.2). **Revisión 5:** el orden de continuación es el del wizard nuevo (el profesor y la fecha/horario ya están; falta aula, 2.3, y después alumnos, 2.2) y el listado ofrece también «Descartar» (2.10, N-1).
- Paginación server-side con metadatos, sin cambios respecto a lo ya implementado.
- El detalle sigue mostrando el listado completo de alumnos inscriptos (`turno.alumnos`, ya incluido en `turnoInclude`), no solo la ocupación.

**Decisión HU-C-09 / Regla N.° 3 (29/09/2026):** el `GET` del detalle puede reutilizar el `turnoInclude` y el presentador compartido para leer **solo** los datos básicos ya mostrados: Alumno (`id`, nombre, apellido, DNI) de todos los `TurnoAlumno`; Materia (`id`, nombre, código); Profesor (`id`, nombre, apellido, DNI); Aula (`id`, nombre, capacidad). Esta excepción es **solo de lectura** y se aplica al listado existente y al detalle `/turnos/[id]` después de la autorización y el alcance por rol. No autoriza consultas de contacto, cuentas, pagos, historial u otros campos internos, nuevas búsquedas/joins de negocio, validaciones sobre esos módulos ni escrituras. Esos usos siguen requiriendo servicios públicos. Si se amplían campos o superficies, debe revisarse expresamente la excepción. El alcance y motivo se documentan en §3.11.

**Nota Revisión 4:** el listado ya muestra `hora_inicio`–`hora_fin` calculados; con duración variable, simplemente va a mostrar rangos de distinto ancho — no requiere cambio de contrato ni de presentador. **Regresión verificada en navegador (25/09/2026):** el listado muestra bien turnos de 2h y 3h, y la agenda por profesor del calendario dibuja un bloque de 2h con el ancho correcto (`HU-C-03.md` §11). El presentador sigue exponiendo `duracion_minutos` (no `duracion_min`, ver changelog, R4-4).

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "id": "cuid", "fecha": "2026-04-10", "hora_inicio": "10:00", "hora_fin": "11:00",
        "alumnos_inscriptos": "3/5", "profesor": "Gómez, Ana", "materia": "Matemática", "aula": "Aula 2", "estado": "DISPONIBLE",
        "prioridad": "NORMAL", "creado_en": "2026-04-01T13:20:00Z" },
      { "id": "cuid", "fecha": "2026-04-11", "hora_inicio": "14:00", "hora_fin": "15:00",
        "alumnos_inscriptos": "Sin asignar", "profesor": "Sin asignar", "materia": "Física", "aula": "Sin asignar", "estado": "PENDIENTE",
        "prioridad": "NORMAL", "creado_en": "2026-04-02T10:05:00Z" }
    ],
    "paginacion": { "total": 15, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 20 }
  },
  "error": null
}
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — parámetros de paginación inválidos en el listado.
- `403 SIN_PERMISO` — falta `turnos:leer`; además, el rol Profesor recibe este código en el detalle de un turno ajeno **o inexistente** (respuesta neutra) y si su cuenta no tiene ficha de profesor.
- `404 TURNO_NO_ENCONTRADO` — detalle de un id inexistente (Gerente y Mesa de Entrada).

---

### 2.5. Agregar o quitar un alumno individual (HU-C-04, ampliación) — IMPLEMENTADA, sin cambios en Revisión 4

> **Revisión 6.** Rutas, respuestas y `code` sin cambios. «Agregar» usa `crearInscripcion` y «quitar» **ya no hace baja física**: la inscripción pasa a `QUITADA_CENTRO` (3.14 y 2.16.6). Condiciones nuevas: `422 MATERIA_SIN_TARIFA` y, desde HU-C-24, `409 INSCRIPCION_REQUIERE_PAGO` (2.18.3), con los campos opcionales `inscripcion` y `ofrecer_pago` en la respuesta de agregar. La «Decisión resuelta» y el paso 2 de «quitar» que hablan de baja física de la fila intermedia quedan superados por 3.14.


> **Revisión 5 (HU-C-12).** El cuerpo de "agregar" se extrae a `inscribirAlumnoEnTurno(turnoId, alumnoId, { origen, alumnoActivo? }, tx)`, que 2.14 reutiliza para la autoinscripción del alumno (`alumnoActivo` solo lo envía el autoservicio, ver paso 2). Sin cambios de comportamiento ni de contrato para Mesa de Entrada (`origen: "MESA_ENTRADA"`). Un turno `CANCELADO` responde `409 TURNO_CANCELADO` tanto al agregar como al quitar.

**DECISIÓN RESUELTA (no relevar de nuevo):** esta operación existe **solo** cuando `estadoTurno ∈ {DISPONIBLE, COMPLETO}` — es decir, una vez que el turno ya tiene aula. Mientras el turno está `PENDIENTE`, cualquier cambio en los alumnos se resuelve reemplazando el conjunto completo vía 2.2. Motivo: HU-C-04 criterio 6 describe explícitamente "si el turno estaba en Completo, al quitar un alumno vuelve a Disponible" — esa transición solo existe una vez que el turno dejó de ser `PENDIENTE`.

**Ruta (agregar):** `POST /api/turnos/[id]/alumnos`
**Ruta (quitar):** `DELETE /api/turnos/[id]/alumnos/[alumnoId]`
**Server Action equivalente:** — (no implementada: `src/server/turnos/actions.ts` no existe y el frontend llama directamente al Route Handler, ver Convenciones generales; nombre previsto `agregarAlumnoTurnoAction()`, a confirmar contra el código) / `quitarAlumnoTurnoAction()` (mismo caso)
**Servicio:** `src/server/turnos/turno.service.ts` → `agregarAlumnoTurno()` / `quitarAlumnoTurno()` (funciones nuevas; el núcleo de «agregar» es `inscribirAlumnoEnTurno()`, Revisión 5)
**Permiso requerido:** `turnos:asignar_participantes`

```typescript
export const AgregarAlumnoTurnoSchema = z.object({
  alumno_id: z.string().cuid(),
});
```

**Comportamiento esperado — agregar (dentro de `prisma.$transaction`):**
1. Leer el `Turno` con lock de fila (ver 3.7); debe existir y estar `DISPONIBLE` (si `PENDIENTE`: `409 TURNO_PENDIENTE`, usar 2.2; si `COMPLETO`: `409 CUPO_INSUFICIENTE`). **Aplicar el guard de vigencia (`turnoSigueVigente`) — Decisión A: `409 TURNO_VENCIDO`** si `fechaTurno + horaInicioTurno` ya pasó.
2. Verificar `alumno_id` activo (`verificarAlumnoActivo()`, Módulo B: `404 ALUMNO_NO_ENCONTRADO` / `409 ALUMNO_INACTIVO`). Con `origen: "AUTOSERVICIO"` (2.14) este paso **se omite**: la ruta ya resolvió el `activo` con `obtenerAlumnoDeUsuario()` y lo pasa en `alumnoActivo`; el núcleo no vuelve a consultarlo.
3. Verificar que no esté ya en el turno: `409 ALUMNO_YA_ASIGNADO`.
4. Verificar disponibilidad del alumno contra otros turnos `DISPONIBLE`/`COMPLETO` superpuestos: `409 ALUMNO_NO_DISPONIBLE`. **Decisión C:** el mensaje literal de este código es «El alumno ya tiene un turno agendado en ese horario» (el autoservicio 2.14.2 lo traduce a segunda persona sin cambiar el `code`); el `ServiceError` lleva `{ alumno_id }` como detalle; la ruta lo reenvía en la respuesta y la UI lo usa únicamente para marcar el chip del alumno en conflicto — el mensaje literal de la HU no cambia.
5. **Guarda de cupo atómica (3.7):** con la fila ya bloqueada en el paso 1, contar `TurnoAlumno` actuales; si `count >= cupoMaximoTurno`, `409 CUPO_INSUFICIENTE`.
6. Insertar `TurnoAlumno`.
7. Si `count + 1 === cupoMaximoTurno`: `UPDATE turno SET estadoTurno = 'COMPLETO' WHERE idTurno = turnoId AND estadoTurno = 'DISPONIBLE'`.
8. Emitir `turno:alumno_agregado` y, si hubo transición, `turno:completado`.

**Comportamiento esperado — quitar:**
1. Leer el `Turno` con lock de fila; debe existir y estar `DISPONIBLE` o `COMPLETO` (si `PENDIENTE`: `409 TURNO_PENDIENTE`). **Aplicar el guard de vigencia (`turnoSigueVigente`) — Decisión A: `409 TURNO_VENCIDO`** si `fechaTurno + horaInicioTurno` ya pasó.
2. Eliminar el `TurnoAlumno` correspondiente (baja física de la fila intermedia — no aplica Regla N.° 1 de `RULES.md`, que protege entidades de dominio como `Turno`, no vínculos de inscripción). Si no existía: `404 ALUMNO_NO_ASIGNADO`.
3. Si el turno estaba `COMPLETO`: `UPDATE turno SET estadoTurno = 'DISPONIBLE' WHERE idTurno = turnoId AND estadoTurno = 'COMPLETO'`.
4. **Decisión B:** se permite quitar al último alumno de un turno `DISPONIBLE`, dejándolo en `0/N` pero seguirá `DISPONIBLE` (la spec no lo prohíbe; un turno sin alumnos inscriptos sigue siendo válido para recibir inscripciones).
5. Emitir `turno:alumno_quitado` y, si hubo transición, `turno:disponible_nuevamente`.

**Respuesta `200 OK` (agregar, sin alcanzar cupo):**
```json
{ "data": { "id": "cuid", "alumnos_inscriptos": "4/5", "estado": "DISPONIBLE" }, "error": null }
```

**Respuesta `409 Conflict` (cupo alcanzado):**
```json
{ "data": null, "error": { "code": "CUPO_INSUFICIENTE", "message": "El turno alcanzó su cupo máximo" } }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — `alumno_id` (body) o `alumnoId` (URL) que no es CUID.
- `403 SIN_PERMISO` — falta `turnos:asignar_participantes`.
- `404 TURNO_NO_ENCONTRADO` — turno inexistente.
- `404 ALUMNO_NO_ENCONTRADO` — el alumno no existe (agregar).
- `404 ALUMNO_NO_ASIGNADO` — el alumno no estaba inscripto (quitar).
- `409 TURNO_PENDIENTE` — el turno está `PENDIENTE`; usar 2.2.
- `409 TURNO_CANCELADO` — turno `CANCELADO`.
- `409 TURNO_VENCIDO` — el turno ya pasó (Decisión A).
- `409 CUPO_INSUFICIENTE` — turno `COMPLETO` o cupo alcanzado (agregar).
- `409 ALUMNO_INACTIVO` — alumno inactivo (agregar).
- `409 ALUMNO_YA_ASIGNADO` — el alumno ya está en el turno (agregar).
- `409 ALUMNO_NO_DISPONIBLE` — el alumno tiene otro turno superpuesto (agregar; con `{ alumno_id }`, Decisión C).

---

### 2.6. Listar profesores disponibles para el turno (HU-C-04, ampliación — NUEVA en Revisión 3), sin cambios en Revisión 4

> **Revisión 5 (R5-2).** Este endpoint **deja de formar parte del wizard nuevo**: el profesor se elige en el paso 2 sin filtrar por horario (2.8, `GET /api/turnos/profesores/por-materia`), y la disponibilidad se aplica después, en el paso 3. Se **conserva sin cambios** para un único caso: completar un turno `PENDIENTE` de Revisión 4 que todavía no tiene profesor (`POST .../participantes` con `profesor_id`, 2.2).

Filtra de entrada el selector de profesor de 2.2, en vez de validar recién al confirmar. Mismo patrón que 2.3 usa para las opciones de aula.

**Ruta:** `GET /api/turnos/profesores/opciones?turno_id=`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `src/server/turnos/turno.profesor.service.ts` → `listarOpcionesProfesorTurno()` (relevamiento Revisión 3 confirmó el archivo — colaborador propio, no vive en `turno.service.ts`, mismo criterio de separación que `turno.aula.service.ts`)
**Permiso requerido:** `turnos:asignar_participantes`

**Comportamiento esperado:**
1. Leer el `Turno` por `turno_id`; debe existir y tener `materiaId` y `fecha`/`hora_inicio` ya definidos (siempre los tiene, se configuran en 2.1). Si no existe: `404 TURNO_NO_ENCONTRADO`. Debe estar `PENDIENTE`: `DISPONIBLE`/`COMPLETO` → `409 TURNO_YA_DISPONIBLE`; `CANCELADO` → `409 TURNO_CANCELADO`.
2. Listar profesores activos asociados a la materia del turno (`listarProfesoresActivosPorMateria()`, ya existente). **Ajuste de implementación (Revisión 3):** si la materia no tiene **ningún** profesor activo asociado (lista vacía en este punto, antes de aplicar el filtro de disponibilidad): `404 SIN_PROFESORES_PARA_MATERIA` — distingue este caso ("no hay profesores que dicten la materia") del caso "hay profesores pero ninguno está libre en ese horario" (paso 4), que responde `200` con lista vacía. Mismo patrón que `SIN_AULAS_ACTIVAS` en 2.3.
3. De esa lista, quedarse solo con los que:
   - Tienen el horario del turno `[hora_inicio, hora_fin)` contenido en su horario de atención registrado (`estaDentroDeHorarioAtencion()`, ya existente — mismo criterio que 2.2 paso 5 usa para revalidar).
   - No tienen otro turno `DISPONIBLE`/`COMPLETO` que se superponga con ese horario (misma fórmula de `intervalosSeSuperponen()`).
4. Devolver la lista filtrada. Si queda vacía (había profesores para la materia, pero ninguno libre en ese horario): `200 OK` con lista vacía — el frontend interpreta eso como "No hay profesores disponibles para este horario" (HU-C-04 criterio 2, ampliado).

**Nota Revisión 4:** el filtro de disponibilidad (paso 3) ya opera sobre el intervalo real del turno — no requiere cambios.

**Respuesta `200 OK`:**
```json
{ "data": [{ "id": "cuid", "nombre": "Ana", "apellido": "Gómez" }], "error": null }
```
**Corrección (D7, relevamiento Revisión 3):** el formato de respuesta es `{ "data": [...] }` (array directo), no `{ "data": { "items": [...] } }` — se alineó con el formato que ya usa el endpoint hermano de aula (2.3) en vez de introducir una forma distinta.

**Respuesta `404 Not Found` (sin profesores para la materia):**
```json
{ "data": null, "error": { "code": "SIN_PROFESORES_PARA_MATERIA", "message": "No hay profesores asociados a esta materia" } }
```

**Nota de alcance:** esta lista es de buena fe, igual que la de aulas (2.3) — el turno todavía no reserva nada hasta confirmarse en 2.2, así que un profesor listado acá puede dejar de estar disponible si otro turno lo toma antes de que este se confirme. Por eso 2.2 revalida igual en su paso 5, con la defensa final de `reservas_turno` (3.4) como garantía de motor.

**Errores esperados:**
- `400 VALIDATION_ERROR` — `turno_id` ausente.
- `403 SIN_PERMISO` — falta `turnos:asignar_participantes`.
- `404 TURNO_NO_ENCONTRADO` — turno inexistente.
- `404 SIN_PROFESORES_PARA_MATERIA` — la materia no tiene ningún profesor activo asociado.
- `409 TURNO_YA_DISPONIBLE` — turno `DISPONIBLE`/`COMPLETO`.
- `409 TURNO_CANCELADO` — turno `CANCELADO`.

---

### 2.7. Búsqueda en el listado y filtro por profesor (HU-C-02, HU-C-08) — NUEVA en Revisión 5

> **Revisión 6.** Contrato sin cambios. El filtro de búsqueda por alumno (relación `alumnos`) considera solo inscripciones **vigentes** (`sqlVigenteEn`): un alumno quitado o con una reserva vencida no hace aparecer la clase.


**Ruta:** la misma de 2.4, `GET /api/turnos` — **no es una pantalla nueva** (mapa de pantallas §1, filas HU-C-02 y HU-C-08).
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `turno.service.ts` → `listarTurnos()` (se amplía, no se duplica).
**Permiso requerido:** `turnos:leer` (sin cambios: Mesa de Entrada, Gerente y Profesor).

```typescript
// src/server/turnos/turno.schema.ts — se amplía ListarTurnosQuerySchema
export const ListarTurnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
  q: z.string().trim().max(100).optional(),        // HU-C-02
  profesor_id: z.string().cuid().optional(),        // HU-C-08 (CUID como el resto de los ids de profesor, ver Convenciones)
  // Sin `materia_id`, `estados` ni `solo_futuros`: HU-C-02 AC6 excluye los filtros por estado, fecha u otro criterio.
  // `.strict()` los rechaza con 400. El modal «Ver turnos» de HU-D-07 usa listarTurnosFuturosDeProfesorPorMateria (2.15).
}).strict();
```

**Comportamiento esperado — búsqueda (`q`):**
1. Si `q` tiene menos de 2 caracteres tras el `trim`, se **ignora** (equivale a no filtrar). La UI no lo envía; la regla del servidor evita que un `q` de un carácter devuelva una lista rara. Mismo umbral que HU-B-05 y el selector de HU-C-04.
2. Se normaliza con `normalizarTexto(q)` (minúsculas, sin acentos) y se parte en **tokens** por espacios (máximo 5; el resto se descarta).
3. **Cada token** debe coincidir (parcialmente, `contains`) con **al menos uno** de estos campos: apellido o nombre normalizado de algún alumno inscripto, apellido o nombre normalizado del profesor, `nombreNormalizadaMateria`, `nombreNormalizadaAula`. Entre tokens es **AND**; entre campos, **OR**. Así "Ana" devuelve los turnos donde coincide una alumna o una profesora (HU-C-02 AC2).
4. Devuelve los turnos en cualquier estado, con el mismo formato de fila de 2.4, mismo orden por defecto (fecha/hora ascendente desde hoy, `profesor_id` como desempate) y paginación sobre el resultado filtrado (la UI vuelve a la página 1 al escribir).
5. Sin coincidencias: `200` con `items: []`. Los mensajes "No se encontraron turnos para «texto»" y el vaciado de la búsqueda son responsabilidad de la UI.
6. **Actualización al escribir (HU-C-02 AC3):** mientras el usuario escribe (mínimo 2 caracteres, con *debounce* de 300 ms), la UI vuelve a consultar `GET /api/turnos?q=` y reemplaza solo el listado, **sin recargar la pantalla completa**; al vaciar el campo se consulta sin `q` y vuelve el listado original.

**Comportamiento esperado — filtro por profesor (`profesor_id`):**
1. **Alcance por rol, resuelto siempre en el servidor** (R5-12): un `PROFESOR` ve automáticamente **solo sus turnos** (el profesor vinculado a la sesión, `obtenerOpcionProfesorDeUsuario()`; si su cuenta no tiene ficha de profesor: `403 SIN_PERMISO`). Si envía `profesor_id`, el propio se acepta y equivale a no enviarlo; **uno ajeno (o inexistente) responde `403 SIN_PERMISO`**, sin revelar si existe: el parámetro no se «ignora». `GERENTE` y `MESA_ENTRADA` pueden enviar el `profesor_id` de cualquier profesor activo (`404 PROFESOR_NO_ENCONTRADO` si no existe o está inactivo).
2. Se combina con `q` y con la paginación.
3. Incluye turnos en **cualquier estado** (`PENDIENTE`, `DISPONIBLE`, `COMPLETO`, `CANCELADO`), a diferencia del calendario (que solo muestra `DISPONIBLE`/`COMPLETO`). Esa es la diferencia que justifica HU-C-08 (AC3).
4. Sin resultados con `profesor_id` y sin `q`: la UI muestra "Este profesor no tiene turnos registrados".

**Uso por HU-D-07 (Profesor, `spec_modulo_D.md` §2.7):** el modal «Ver turnos» que aparece cuando la baja de una materia se rechaza por turnos futuros **no usa este listado**: HU-C-02 AC6 excluye del listado los filtros por estado, fecha o materia, así que `materia_id`, `estados` y `solo_futuros` no existen aquí y `.strict()` los rechaza con `400`. El modal usa la ruta propia de D, `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros?pagina=n` (permiso `profesores:leer`, `por_pagina` fijo en 10, backlog del 28/09), que llama a `listarTurnosFuturosDeProfesorPorMateria()` (2.15). Cada fila trae fecha, hora, aula, ocupación (p. ej. 3/5) y estado, con enlace al Detalle de turno **en una pestaña nueva**, donde Mesa de Entrada puede cancelarlo (HU-C-05). Los turnos pasados, cancelados y `PENDIENTE` no bloquean la baja ni se listan (HU-D-07 AC3).

**Selector de profesores (solo Gerente y Mesa de Entrada):** `GET /api/turnos/filtros/profesores` (`withPermission("turnos:leer")` **más** verificación de rol en el handler: solo `GERENTE` y `MESA_ENTRADA`; el rol `PROFESOR`, que también tiene `turnos:leer`, recibe `403 SIN_PERMISO`, porque su listado ya está acotado a sus turnos y no tiene selector, HU-C-08 AC1 y R5-12) devuelve `[{ id, nombre, apellido }]` de los profesores activos vía `listarOpcionesProfesoresActivos()` (Módulo D, 2.8; unificada con la de 2.5, `nombreParaMostrar` se ignora acá). No se usa `profesores:leer` porque el Gerente no lo tiene (`seed.ts`, `ACCIONES_SOLO_MESA_ENTRADA`).

**Nota de sincronización — excepción a la Regla N.° 3:** la búsqueda filtra por columnas normalizadas de otros módulos vía relaciones de Prisma. Ver R5-7 y 3.11.

**Nota de sincronización — `por_pagina` (redactada para revisión del SM, 01/10/2026):** el schema de arriba indica `por_pagina: ….default(20)`, pero el código conserva `por_pagina: z.coerce.number().int().positive().max(20).optional()` y, si no se envía, `listarTurnos()` usa el parámetro `paginacion_limite_default` (10 en el seed). Es la decisión de HU-C-02 (task, 1.7 punto 5: «se deja como está», con la deuda anotada) y HU-C-08 no la cambia. El resto del schema (`q`, `profesor_id`, `.strict()`) coincide con el código.

**Respuesta `200 OK`:** igual a 2.4, con los campos ampliados por la nota de Revisión 5.

**Errores esperados:** `400` (parámetro inválido o ajeno al schema: `pagina`, `por_pagina`, `q`, `profesor_id` mal formado, `materia_id`, `estados`, `solo_futuros`) · `403 SIN_PERMISO` (incluye el `profesor_id` ajeno de un Profesor) · `404 PROFESOR_NO_ENCONTRADO` (solo Gerente y Mesa de Entrada).

---

### 2.8. Profesores por materia y disponibilidad para "Fecha y Horario" (HU-C-07) — NUEVA en Revisión 5

Es el mecanismo que calcula las opciones de los pasos 2 y 3 del wizard. **Cambia de naturaleza respecto del backlog original** (propuesta de orden de flujo, §3): ya no es una ayuda visual dentro del selector de profesor, es el paso central "Elegir Fecha y Horario".

**Servicio:** `src/server/turnos/turno.profesor.service.ts` (`listarProfesoresPorMateria()`, `calcularDisponibilidadProfesor()`), con el cálculo puro en `turno.disponibilidad.ts` (módulo compartido, ver "Convenciones generales").
**Server Action equivalente:** — (solo Route Handler)
**Permiso requerido:** `turnos:crear`.

#### 2.8.1. Paso 2 — Profesores de la materia

**Ruta:** `GET /api/turnos/profesores/por-materia?materia_id=`
**Cobertura (decisión del PO, 29/09/2026):** este paso 2 no tiene AC propio en el backlog; se implementa y se prueba como tarea técnica dentro de HU-C-07 / HU-C-18, sin agregar criterios al backlog.

1. Verificar `materia_id` activa (`verificarMateriaActiva()`); si no: `409 MATERIA_NO_DISPONIBLE`.
2. Listar profesores activos asociados (`listarProfesoresActivosPorMateria()`, Módulo D). Si la lista está vacía: `404 SIN_PROFESORES_PARA_MATERIA`. **No** se filtra por horario: eso ocurre en el paso 3.

**Respuesta `200 OK`:** `{ "data": [{ "id": "cuid", "nombre": "Ana", "apellido": "Gómez" }], "error": null }` (array directo, mismo formato que 2.3 y 2.6).

**Errores esperados (2.8.1):**
- `400 VALIDATION_ERROR` — `materia_id` ausente.
- `403 SIN_PERMISO` — falta `turnos:crear`.
- `404 SIN_PROFESORES_PARA_MATERIA` — la materia no tiene profesores activos asociados.
- `409 MATERIA_NO_DISPONIBLE` — materia inactiva.

#### 2.8.2. Paso 3 — Fechas y horarios disponibles del profesor

**Ruta:** `GET /api/turnos/profesores/[profesorId]/disponibilidad?materia_id=&duracion_min=&desde=&hasta=`

```typescript
export const DisponibilidadProfesorQuerySchema = z.object({
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  duracion_min: z.coerce.number({ error: "Elegí la duración del turno" })
    .int().refine(esDuracionPermitida, "Elegí una duración válida (1, 2 o 3 horas)"), // R5-3
  desde: fechaCalendarioValidaSchema.optional(), // por defecto, hoy
  hasta: fechaCalendarioValidaSchema.optional(), // por defecto y como máximo, hoy + ANTICIPACION_MAXIMA_DIAS
});
```

**Comportamiento esperado:**
1. Verificar materia activa (`409 MATERIA_NO_DISPONIBLE`), profesor activo (`404 PROFESOR_NO_ENCONTRADO`) y que dicte la materia (`profesorActivoDictaMateria()`, `409 PROFESOR_NO_DICTA_MATERIA`).
2. Rango efectivo `[max(desde, hoy), min(hasta, hoy + ANTICIPACION_MAXIMA_DIAS)]`. Si `desde > hasta` tras el ajuste: `400`. Los valores fuera de tope se recortan, no se rechazan.
3. Para cada **día operativo** del rango (`DIAS_OPERATIVOS`), tomar las franjas de atención del profesor cuyo `dia_semana` coincide (`obtenerHorariosDeAtencion()`, Módulo D, 2.8). Las franjas son recurrentes y **no tienen materia** (R5-4).
4. De cada franja, **restar** los intervalos de los turnos `DISPONIBLE`/`COMPLETO` del profesor en esa fecha (3.2, misma fórmula `intervalosSeSuperponen`, 3.3). Los `PENDIENTE` y `CANCELADO` **no restan** (HU-C-07 AC2). El resultado son los **tramos libres**.
5. Dentro de cada tramo libre, las **horas de inicio ofrecidas** son las alineadas a `GRANULARIDAD_MINUTOS` tales que `inicio ≥ inicio del tramo` y `inicio + duracion_min ≤ fin del tramo`, y contenidas en `[HORA_APERTURA, HORA_CIERRE]`. Para hoy, solo las posteriores a la hora actual (`America/Argentina/Buenos_Aires`).
6. Se omiten las fechas sin ninguna hora de inicio posible.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "profesor": { "id": "cuid", "nombre_completo": "Gómez, Ana" },
    "duracion_min": 120,
    "rango": { "desde": "2026-09-29", "hasta": "2026-10-28" },
    "fechas": [
      { "fecha": "2026-09-29", "dia_semana": "MARTES",
        "franjas": [ { "hora_inicio": "08:00", "hora_fin": "12:00",
                       "tramos_libres": [{ "desde": "08:00", "hasta": "12:00" }],
                       "inicios": ["08:00", "08:30", "09:00", "09:30", "10:00"] } ] }
    ]
  },
  "error": null
}
```
`fechas: []` significa que no hay ningún horario libre en el rango: la UI muestra "Este profesor no tiene horarios disponibles para esta materia en este momento" y ofrece volver al paso 2 (HU-C-07 AC3). Es `200`, no un error.

**Errores esperados (2.8.2):**
- `400 VALIDATION_ERROR` — `materia_id` ausente, `duracion_min` no permitida, `desde`/`hasta` inválidas o `desde > hasta` tras el ajuste del rango.
- `403 SIN_PERMISO` — falta `turnos:crear`.
- `404 PROFESOR_NO_ENCONTRADO` — profesor inexistente o inactivo.
- `409 MATERIA_NO_DISPONIBLE` — materia inactiva.
- `409 PROFESOR_NO_DICTA_MATERIA` — el profesor no dicta la materia.

**Alcance de buena fe (HU-C-07 AC4):** igual que 2.3 y 2.6, la lista no reserva nada. Se **revalida** en 2.1 (al crear) y otra vez en 2.2 al confirmar, con `reservas_turno` (3.4) como defensa final.

**Fuera de alcance de esta sección:** la vista de calendario (`spec_modulo_J.md`) y la generación masiva (2.9), que reutiliza las funciones puras de 3.10 pero vive dentro de `/turnos/nuevo`, sin pantalla propia (HU-C-17 AC10).

---

### 2.9. Generar turnos a partir del horario del profesor (HU-C-17) — NUEVA en Revisión 5

> **Nota posterior (08/10/2026).** Sin cambios de contrato. El bloqueo suma al profesor y se relee que siga activo (HU-D-08, 2.21.3).

> **Revisión 6 (HU-C-21).** Los criterios 4 y 6 de HU-C-17 («una sola aula para todo el rango», «un conflicto se resuelve cambiando el aula para todo el rango») y la última viñeta del criterio 5 quedan reemplazados por 2.9.1, que agrega campos **opcionales**. Sin ellos, esta sección rige tal cual. También quedan superadas las frases «nunca un aula por fecha» y «una sola para todo el rango» de los pasos 5 y 6 y de «Reglas que no cambian», y «aula distinta por fecha» del «Fuera de alcance». «Cualquier proceso programado» del «Fuera de alcance» sigue valiendo para la generación (el proceso de 2.18.1 no genera clases).


**Pantalla:** no tiene ruta propia ni ítem de menú aparte: vive en `/turnos/nuevo` detrás del control «Turno individual / Generar varios turnos» (decisión de PO 27/09, mapa de pantallas §1; HU-C-17 AC10). Página completa, feedback por banner.

**Pasos del modo «Generar varios turnos» (HU-C-17 AC1; HU-C-18 AC6):** 1. Materia → 2. Profesor → 3. Franja → 4. Duración → 5. Hora de inicio → 6. Aula → 7. Rango de fechas (desde–hasta) → Vista previa → Confirmar. Este modo **ya nace con el orden Materia → Profesor de HU-C-18** y no depende de esa historia, pero **comparte con el modo individual los mismos componentes de los pasos Materia y Profesor** (no hay una versión propia para el modo masivo), alimentados por los mismos orígenes: Materia, con las materias activas que ya usa el modo individual (2.1 paso 1); Profesor, con `GET /api/turnos/profesores/por-materia?materia_id=` (2.8.1, permiso `turnos:crear`), que devuelve solo a quienes dictan la materia elegida. Cambiar la materia o el profesor limpia los pasos siguientes (misma regla que «Atrás» en 2.1). Desde el paso 3 el modo masivo se separa del individual: la franja sale del endpoint de franjas (abajo) y no de 2.8.2; la duración usa el mismo `DURACIONES_PERMITIDAS_TURNO_MIN`; el aula es una sola para todo el rango (AC4).

**Cómo se cumple «franjas para ese profesor y esa materia» (AC1):** el profesor se elige **solo entre quienes dictan la materia** (2.8.1) y, una vez elegido, se muestran **sus franjas recurrentes**. La franja no tiene materia (R5-4): la relación franja–materia la establece el profesor, y por eso el endpoint de franjas exige `materia_id` y rechaza con `409 PROFESOR_NO_DICTA_MATERIA` a un profesor que no la dicte. Las franjas ofrecidas son, entonces, las registradas en HU-D-04 para ese profesor cuando dicta esa materia. La hora de inicio no está fijada al comienzo de la franja: puede elegirse cualquier inicio alineado a `GRANULARIDAD_MINUTOS` dentro de ella (paso 2).

**Rutas:**
- `POST /api/turnos/generacion/vista-previa` — calcula y valida, **no persiste nada**.
- `POST /api/turnos/generacion` — confirma y persiste.
**Server Action equivalente:** — (no implementada: `src/server/turnos/actions.ts` no existe y el frontend llama directamente al Route Handler, ver Convenciones generales; nombre previsto `generarTurnosAction()`, a confirmar contra el código) (y `vistaPreviaGeneracionAction()` para la vista previa)
**Servicio:** `src/server/turnos/turno.generacion.service.ts` (`vistaPreviaGeneracion()`, `generarTurnos()`).
**Permiso requerido:** `turnos:crear`.
**Franjas del profesor (paso 3):** `GET /api/turnos/profesores/[profesorId]/franjas?materia_id=` (permiso `turnos:crear`). `materia_id` es obligatorio y **solo se usa para validar** que el profesor dicta esa materia (las franjas no tienen materia, R5-4); no filtra las franjas. Devuelve `{ "data": [{ "horario_id", "dia_semana", "hora_inicio", "hora_fin" }], "error": null }` (array directo, como 2.6 y 2.8.1) con las franjas **recurrentes** del profesor vía `obtenerHorariosDeAtencion()` (Módulo D, orden día y hora). Un profesor sin franjas responde `200` con `data: []` y la UI muestra «Este profesor no tiene horarios de atención registrados». **Errores esperados** (mismos códigos y mismo orden que 2.8.2 y 2.1 paso 1b): `400` (`materia_id` ausente) · `403 SIN_PERMISO` · `409 MATERIA_NO_DISPONIBLE` · `404 PROFESOR_NO_ENCONTRADO` · `409 PROFESOR_NO_DICTA_MATERIA`.

```typescript
export const GenerarTurnosSchema = z.object({
  materia_id: z.string().trim().min(1),
  profesor_id: z.string().cuid(),
  horario_id: z.string().cuid(),                 // la franja recurrente elegida (HorarioProfesor)
  duracion_min: z.number().int().refine(esDuracionPermitida, "Elegí una duración válida (1, 2 o 3 horas)"), // corrige el "1 o 2 horas" del criterio original: DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180]
  hora_inicio: horaSchema,                       // cualquier inicio dentro de la franja (AC1)
  aula_id: z.string().cuid(),                    // una sola para todo el rango (AC4)
  fecha_desde: fechaCalendarioValidaSchema,
  fecha_hasta: fechaCalendarioValidaSchema,
}).strict().refine((d) => d.fecha_desde <= d.fecha_hasta, { message: "La fecha hasta debe ser posterior o igual a la fecha desde", path: ["fecha_hasta"] });
```

**Comportamiento esperado (ambas rutas ejecutan el mismo cálculo; la de confirmación lo repite dentro de la transacción y nunca confía en una lista enviada por el cliente):**
1. Materia activa (`409 MATERIA_NO_DISPONIBLE`); profesor existente y activo (`404 PROFESOR_NO_ENCONTRADO`) que dicte la materia (`409 PROFESOR_NO_DICTA_MATERIA`); `horario_id` pertenece a ese profesor (`obtenerHorarioDeProfesor()`, Módulo D; `404 HORARIO_NO_ENCONTRADO`); aula activa (`404 SIN_AULAS_ACTIVAS` / `404 AULA_NO_ENCONTRADA` / `409 AULA_INACTIVA`, mismos códigos que 2.3). La capacidad del aula no se compara contra inscriptos (no hay ninguno al generar), por lo que `AULA_CAPACIDAD_INSUFICIENTE` no aplica.
2. **Encaje en la franja (AC2):** `hora_inicio` alineada a `GRANULARIDAD_MINUTOS` y `franja.hora_inicio ≤ hora_inicio` y `hora_inicio + duracion_min ≤ franja.hora_fin`. Si no: `400 FUERA_DE_FRANJA`. El tramo sobrante de la franja **no se consume** (AC3): la franja sigue completa para otra generación posterior, en la misma corrida o en una futura, con otra `hora_inicio`. En el modo masivo el endpoint de franjas devuelve la franja entera, sin descontar tramos ocupados, y lo ya generado se detecta al pedir la vista previa como conflicto de esa fecha (paso 5: `PROFESOR_OCUPADO` o `TURNO_EXISTENTE`). En el modo individual el tramo sobrante lo ofrece 2.8.2, porque solo los turnos `DISPONIBLE`/`COMPLETO` restan tramos (3.2).
3. **Rango (R5-8a):** (i) `fecha_desde ≥ hoy`; si no: `400 RANGO_EXCEDIDO`, «La fecha desde no puede ser anterior a hoy» (no hay un máximo que indicar). (ii) `fecha_hasta ≤ fecha_desde + generacion_maxima_meses` (meses calendario; el rango no puede superar 6 meses) y cantidad de fechas calculadas `≤ generacion_maxima_turnos`; si no: `400 RANGO_EXCEDIDO` indicando el máximo superado. (iii) Evaluado después del paso 4: si el rango no contiene ninguna fecha generable (ninguna ocurrencia del día de la franja, ninguna es día operativo, o la única es la de hoy ya vencida): `400 SIN_FECHAS_EN_RANGO`, «No hay fechas para generar en el rango elegido»; ni la vista previa ni la confirmación responden con 0 turnos (`201` vacío). **No aplica** `ANTICIPACION_MAXIMA_DIAS`.
4. **Fechas puntuales (AC5):** todas las fechas de `[fecha_desde, fecha_hasta]` cuyo día de la semana es el de la franja y que sean día operativo. Las de hoy cuya `hora_inicio` ya pasó se **omiten** y se informan en `fechas_omitidas_vencidas`. Cada fecha se valida **por separado** (dos lunes distintos no comparten resultado).
5. **Validación de disponibilidad por fecha puntual (AC5)**, contra el intervalo real `[hora_inicio, hora_inicio + duracion_min)`. La validación que el paso presenta al usuario —y la única que se resuelve cambiando algo del formulario— es la del **aula**:
   - `AULA_OCUPADA`: el aula tiene un turno `DISPONIBLE`/`COMPLETO` superpuesto en esa fecha (`aulaConTurnoSuperpuesto()`). La vista previa la señala explícitamente (AC6); se resuelve cambiando el aula para todo el rango o acotando el rango.

   Además, dos **resguardos de integridad**, que no son un criterio visible del paso. El AC da por sentado que el único solapamiento posible es el de aula, porque HU-D-04 impide dos materias en la misma franja; pero HU-D-04 solo impide franjas superpuestas, no turnos ya creados por otras vías ni corridas anteriores. Sin estos resguardos, un choque de profesor o una corrida duplicada llegarían como error técnico de la base (`23P01`):
   - `PROFESOR_OCUPADO`: el profesor tiene un turno `DISPONIBLE`/`COMPLETO` superpuesto en esa fecha (agregado por el SM, R5-4). Se resuelve acotando el rango o eligiendo otra hora de inicio, no cambiando el aula.
   - `TURNO_EXISTENTE`: existe un turno **no cancelado** del mismo profesor y materia superpuesto, en cualquier estado incluido `PENDIENTE` (R5-8c). Evita duplicar una corrida ya hecha («ya generaste esas fechas»). Si además aplican `AULA_OCUPADA` o `PROFESOR_OCUPADO`, se informa **solo** `TURNO_EXISTENTE` (es la causa; los otros son consecuencia).
6. **Vista previa (AC6):** devuelve cantidad, fechas y, por fecha, `estado: "OK" | "CONFLICTO"` con `motivos` (los códigos del paso 5, que la UI traduce a texto: «Aula ocupada», «El profesor ya tiene un turno en esa fecha», «Ya existe un turno de esta materia y profesor en esa fecha»). Un conflicto se resuelve cambiando el aula **para todo el rango** o acotando el rango; nunca un aula por fecha (AC4).

**Errores esperados (vista previa y confirmación; mismos códigos que 2.1, 2.3 y 2.8):** `400` (validación Zod, `FUERA_DE_FRANJA`, `RANGO_EXCEDIDO`, `SIN_FECHAS_EN_RANGO`) · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` (inexistente o inactivo) · `404 HORARIO_NO_ENCONTRADO` · `404 SIN_AULAS_ACTIVAS` / `404 AULA_NO_ENCONTRADA` · `409 MATERIA_NO_DISPONIBLE` · `409 PROFESOR_NO_DICTA_MATERIA` · `409 AULA_INACTIVA` · `409 GENERACION_CON_CONFLICTOS` (solo la confirmación; la vista previa informa los conflictos con `200`).

**Respuesta `200 OK` (vista previa):**
```json
{
  "data": {
    "cantidad": 15,
    "fechas": [
      { "fecha": "2026-10-05", "estado": "OK", "motivos": [] },
      { "fecha": "2026-10-12", "estado": "CONFLICTO", "motivos": ["AULA_OCUPADA"] }
    ],
    "hay_conflictos": true,
    "fechas_omitidas_vencidas": 0
  },
  "error": null
}
```

**Confirmación (`POST /api/turnos/generacion`), dentro de una única `prisma.$transaction`:**
1. Recalcular 1 a 5 **dentro de la transacción**. **Si existe al menos un conflicto: no se crea ningún turno** y responde `409 GENERACION_CON_CONFLICTOS` con el mismo detalle por fecha. La generación es **todo o nada por corrida** (AC6); no se saltean fechas conflictivas.
2. Sin conflictos: insertar un `Turno` por fecha (`tx.turno.create` en bucle; el tope de `generacion_maxima_turnos` lo acota) **ya confirmado** (HU-C-17 AC7 del backlog v2, R5-9): `estadoTurno: "DISPONIBLE"`, `materiaId`, `profesorId`, `aulaId`, `cupoMaximoTurno = capacidad del aula`, `duracionMinutosTurno`, fecha y hora, `prioridadTurno: "NORMAL"`, `creadoPorUsuarioId`. **Sin alumnos (0/N).** No pasa por `PENDIENTE` ni por 2.2. Es la **única excepción** a "el turno sale de `PENDIENTE` solo en 2.2" (3.1), y la única forma de tener un `DISPONIBLE` con 0 alumnos por alta.
3. **Defensa de motor:** el trigger `turno_sincronizar_reservas` (`AFTER INSERT`) reserva profesor y aula en cada `INSERT`. Si la exclusión GiST rechaza alguno (`23P01`; una reserva concurrente se coló entre el cálculo y la inserción), **toda la transacción se revierte** y se responde `409 GENERACION_CON_CONFLICTOS` pidiendo repetir la vista previa; se traduce con `esConflictoDeReserva()` / `errorDeReserva()` de `turno.reserva-error.ts`, sin reescribirlos. Esto reemplaza al advisory lock de la versión anterior de esta spec: ya no hace falta, porque los turnos generados reservan.
4. Tras el `COMMIT`, emitir por cada turno `turno:configurado` (con `generacion_id`), `turno:aula_asignada` y `turno:disponibilizado` (con `alumno_ids: []`), en un único `createMany` sobre `eventos_turno`.

**Respuesta `201 Created`:** `{ "data": { "generacion_id": "cuid", "cantidad": 15, "turno_ids": ["cuid", "…"] }, "error": null }` — la UI informa la cantidad creada (AC7).

**Reglas que **no** cambian (AC8, AC9):** no hay excepciones de disponibilidad del profesor por fecha (una licencia se resuelve cancelando ese turno puntual con 2.10, sin tocar el horario recurrente ni los demás turnos) y la generación siempre la dispara una persona; no existe proceso automático de fondo.

**Fuera de alcance:** aula distinta por fecha, excepciones por licencia, generación con alumnos, y cualquier proceso programado.

#### 2.9.1. Aula distinta por fecha ocupada y exclusión de fechas (HU-C-21) — NUEVA en Revisión 6

> **Compatibilidad.** Extiende 2.9 **sin cambiar** sus rutas, sus códigos de error ni el comportamiento de un pedido que no use los campos nuevos: sin `aulas_por_fecha`, sin `fechas_excluidas` y sin `resolver_automaticamente`, la vista previa y la confirmación son exactamente las de Sprint 2 (una sola aula para todo el rango; cualquier conflicto bloquea la generación). Los campos nuevos son **opcionales**. HU-C-21 **reemplaza** el criterio 4 de HU-C-17 («una sola aula para todo el rango»), el criterio 6 («un conflicto se resuelve cambiando el aula para todo el rango») y la última viñeta del criterio 5 («Elegí otra aula para todo el rango»); en 2.9 esas frases quedan superadas por esta sección. Sigue siendo **todo o nada** sobre las fechas incluidas.

**Qué cambia en el pedido** (`GenerarTurnosSchema`, `.strict()`; `aula_id` sigue siendo obligatorio y es el aula por defecto de todo el rango):

```typescript
// Campos nuevos, todos opcionales (vista previa y confirmación):
aulas_por_fecha: z.array(z.object({ fecha: fechaCalendarioValidaSchema, aula_id: z.string().cuid() })).optional(),  // aula distinta solo para esas fechas (criterio 2)
fechas_excluidas: z.array(fechaCalendarioValidaSchema).optional(),                                                  // fechas que no se generan (criterio 4)
// Solo en la vista previa (la confirmación lo rechaza con 400 VALIDATION_ERROR):
resolver_automaticamente: z.boolean().optional() // "Resolver todas" (criterio 3)
```
Ambas listas quedan acotadas por `generacion_maxima_turnos` (las fechas calculadas ya lo están). Una fecha de `aulas_por_fecha` o de `fechas_excluidas` que no pertenece a las fechas calculadas del rango, o repetida: `400 VALIDATION_ERROR`. Una fecha no puede estar a la vez en las dos listas.

**Cálculo (vista previa y confirmación, mismo cálculo):**
1. Las fechas de `fechas_excluidas` **no se validan ni se crean**. Si después de excluir no queda ninguna fecha: `400 SIN_FECHAS_EN_RANGO` (el mismo código de 2.9 paso 3).
2. Para cada fecha incluida, el aula es la de `aulas_por_fecha` si existe y, si no, `aula_id`. Cada aula elegida se valida como en 2.9 paso 1 (`404 AULA_NO_ENCONTRADA` / `409 AULA_INACTIVA`) y su disponibilidad se valida **por fecha** (`AULA_OCUPADA`) contra el intervalo real, con la misma fórmula de 3.3.
3. Los resguardos de profesor (`PROFESOR_OCUPADO`) y de duplicado (`TURNO_EXISTENTE`) de 2.9 paso 5 **no cambian**. Esas fechas no se resuelven cambiando el aula: solo se pueden **excluir** (criterio 5). La interfaz las rotula «Profesor con otra clase»; el aviso «Elegí otra aula para todo el rango» se reemplaza por el de esta historia.
4. **Cupo (criterio 6):** el cupo de cada clase es la **capacidad de su aula**; si el aula de una fecha tiene distinta capacidad que el aula por defecto, la fila lo indica (por ejemplo, «cupo 6 en lugar de 8»).
5. **«Resolver todas» (criterio 3, solo vista previa con `resolver_automaticamente: true`):** a cada fecha con `AULA_OCUPADA` le asigna el aula activa libre en ese horario de **menor capacidad que sea igual o mayor a la del aula por defecto**; ante empate, la primera por nombre. No pisa las fechas que ya tienen aula en `aulas_por_fecha` ni las fechas excluidas: solo resuelve las que siguen en conflicto. Las fechas que no se pueden resolver quedan en `CONFLICTO` para elegir a mano. El resultado vuelve en la respuesta; el cliente lo reenvía como `aulas_por_fecha` en la confirmación. **La confirmación nunca resuelve por su cuenta**: valida lo que recibe.
6. **Sin aulas libres (criterio 4):** una fecha con `AULA_OCUPADA` para la que no existe ninguna aula activa libre en ese horario se marca `sin_aulas_libres: true` («Sin aulas libres en este horario») y solo puede excluirse.

**Vista previa — `POST /api/turnos/generacion/vista-previa`.** Cada elemento de `fechas[]` conserva `fecha`, `estado` y `motivos`, y suma:
```json
{ "fecha": "2026-10-12", "estado": "OK", "motivos": [],
  "aula": { "id": "cuid", "nombre": "Aula 3" }, "aula_cambiada": true,
  "cupo": 6, "cupo_aula_por_defecto": 8,
  "excluida": false, "sin_aulas_libres": false, "solo_excluible": false }
```
- `estado`: `OK` | `CONFLICTO` (`motivos` con los códigos de 2.9: `AULA_OCUPADA`, `PROFESOR_OCUPADO`, `TURNO_EXISTENTE`). Una fecha excluida tiene `excluida: true` y no tiene conflictos (`estado: "OK"`, `motivos: []`).
- `solo_excluible`: `true` si el conflicto no se resuelve cambiando el aula (`PROFESOR_OCUPADO` o `TURNO_EXISTENTE`).
- El resumen de la respuesta suma `cantidad_incluida`, `con_aula_cambiada` y `excluidas`. `hay_conflictos` considera solo las fechas incluidas.

**Aulas libres de una fecha (criterio 2) — `GET /api/turnos/generacion/aulas-libres?fecha=&hora_inicio=&duracion_min=`** (permiso `turnos:crear`; solo lectura). Devuelve `{ "data": [{ "id", "nombre", "capacidad" }], "error": null }` con **solo las aulas activas libres** en esa fecha y horario, con su capacidad, ordenadas por capacidad y nombre. Reutiliza `listarAulasActivasParaTurno` y la disponibilidad de 2.3 (Módulo K y `aulaConTurnoSuperpuesto`), sin reimplementarlas. Errores: `400` (parámetros) · `403 SIN_PERMISO`. Al elegir una, la fila pasa a «Libre · <Aula nueva> (cambiada)» y las demás fechas mantienen el aula original.

**Confirmación — `POST /api/turnos/generacion`.** Mismo flujo de 2.9 (recalcular dentro de la transacción; todo o nada; defensa de motor con la exclusión GiST y `esConflictoDeReserva()`), con estas diferencias:
- Crea un `Turno` `DISPONIBLE` por cada fecha **incluida**, con el `aulaId` y el `cupoMaximoTurno` de **su** aula (criterio 6). Las excluidas no se crean.
- **Revalida la disponibilidad de cada aula elegida y la del profesor en cada fecha incluida** (criterio 7): si queda algún conflicto, `409 GENERACION_CON_CONFLICTOS` con el detalle por fecha, y no se crea ninguna.
- `201 Created`: `{ "data": { "generacion_id", "cantidad", "turno_ids", "aulas_cambiadas": 2, "fechas_excluidas": 1 }, "error": null }` (criterio 8: cuántas clases se generaron, en cuántas se cambió el aula y cuántas fechas se excluyeron). Los campos de Sprint 2 se conservan.
- Eventos (§4): por turno, `turno:configurado` (con `generacion_id`), `turno:aula_asignada` (con el aula y el cupo de **esa** clase) y `turno:disponibilizado`, como en 2.9.

**Confirmación de HU-C-25:** «Confirmar generación» es una acción modificada en este sprint, así que la interfaz pide antes la confirmación con los datos concretos (materia, profesor, cantidad de clases, cuántas con aula cambiada y cuántas fechas excluidas).

**Plan de recorte (convención 7, paso 4):** «Resolver todas» se implementa como una opción **independiente** (`resolver_automaticamente`), de modo que se pueda recortar sin tocar el cambio de aula por fecha ni la exclusión.

**Cómo se cumplen los criterios:** HU-C-21 1 y 2 → vista previa y «aulas libres»; 3 → paso 5; 4 → paso 6 y `fechas_excluidas`; 5 → paso 3; 6 → paso 4; 7 → confirmación; 8 → respuesta `201`.

---

### 2.10. Cancelar un turno (HU-C-05) — NUEVA en Revisión 5

> **Nota posterior (08/10/2026).** Sin cambios. `turnos:cancelar` sigue siendo exclusivo de Mesa de Entrada. La cancelación que hace el Gerente desde la baja de un profesor (HU-D-08) usa una función aparte con el mismo núcleo (2.21.2).

> **Revisión 6.** Ruta, respuesta y `code` sin cambios. El paso 1 suma `marcarVencidas` después del bloqueo. El paso 4 sigue sin tocar las inscripciones: las vigentes siguen vigentes y sus reservas dejan de vencer (2.18.6). Los textos de pantalla salen del archivo central de HU-C-23 (HU-C-19 cambia «turno» por «clase»). La cancelación de un turno propio por el alumno (HU-C-14) está en 2.19 y la anulación o corrección de pagos (HU-I-06) existe desde el Sprint 3: la advertencia de N-3 («no se reembolsan automáticamente») se conserva.


**Ruta:** `POST /api/turnos/[id]/cancelacion` (sin body)
**Server Action equivalente:** — (no implementada: `src/server/turnos/actions.ts` no existe y el frontend llama directamente al Route Handler, ver Convenciones generales; nombre previsto `cancelarTurnoAction()`, a confirmar contra el código)
**Servicio:** `src/server/turnos/turno.cancelacion.service.ts` → `cancelarTurno()`
**Permiso requerido:** `turnos:cancelar` (exclusivo de Mesa de Entrada)
**Presentación (turno `DISPONIBLE` o `COMPLETO`; el descarte de un `PENDIENTE` se describe en la nota N-1):** `AlertDialog` en el Detalle de turno, mensaje "¿Confirmás cancelar este turno? Esta acción no se puede deshacer." y botón "Cancelar turno"; toast "Turno cancelado correctamente" (mapa de pantallas §4, `DESIGN.md` §6).

> **APROBADO por el PO el 29/09/2026 (N-1). Descartar un `PENDIENTE` y cumplimiento de HU-C-05 AC2** («Un turno Pendiente no tiene esta acción — se descarta simplemente sin guardar»). **La acción «Cancelar turno» no se ofrece a un `PENDIENTE`:** `acciones_habilitadas` (2.4) no incluye `cancelar` para él y ni el detalle ni el listado muestran «Cancelar turno» ni su diálogo. Lo que el `PENDIENTE` ofrece es «Descartar» (`acciones_habilitadas` incluye `descartar`): una sola confirmación, sin pedir datos ni motivo, con el diálogo «¿Confirmás descartar este turno? Esta acción no se puede deshacer.» y el toast «Turno descartado». **El descarte no deja rastro operativo:** un `PENDIENTE` no reserva nada (3.2), así que no hay reservas ni inscripciones que liberar; el turno queda `CANCELADO` y, como cualquier `CANCELADO`, no aparece en calendarios ni en las franjas ocupadas (2.8, 2.3), no cuenta como duplicado en la generación masiva (2.9: `TURNO_EXISTENTE` ignora los cancelados) y no vuelve a ningún estado. **Divergencia irreductible con la letra «sin guardar»:** desde R5-1 el turno ya está guardado —se persiste como `PENDIENTE` al confirmar el paso 3— y la Regla N.° 1 impide borrarlo; la única forma de retirarlo sin migración es marcarlo `CANCELADO`, de modo que la fila permanece (visible como «Cancelado» en el listado y el detalle, y contada entre los cancelados por `contarTurnosPorMes()`, 2.15). Sin esta salida, cada wizard abandonado dejaba un `PENDIENTE` huérfano para siempre.
>
> **APROBADO por el PO el 29/09/2026 (N-3).** **Turno con pagos.** Los pagos son inmutables y no hay anulación ni corrección hasta que se implemente la HU de corrección que el PO planificó para Sprint 3 (`spec_modulo_I.md` §3.6), así que cancelar una clase ya cobrada deja el pago asociado a un turno `CANCELADO`. **Permitirlo y avisarlo**: si el detalle trae `pagos` (el rol tiene `pagos:leer`), el `AlertDialog` agrega «Este turno tiene N pagos registrados; no se reembolsan automáticamente». **Decisión del SM (30/09/2026):** con un solo pago el texto va en singular: «Este turno tiene 1 pago registrado; no se reembolsan automáticamente».
>
> **Decisión del SM (30/09/2026). «Descartar» en el listado.** El listado (2.4) no recibe `acciones_habilitadas` por fila; muestra «Descartar» cuando el usuario tiene `turnos:cancelar` (verificado en el servidor con `verificarPermiso`) y el turno está `PENDIENTE`. Es la misma condición con la que el servidor calcula `acciones_habilitadas.descartar` para el detalle (`capacidades.cancelar && estado === "PENDIENTE"` en `turno.acciones.ts`), así que se acepta como equivalente.

**Comportamiento esperado, dentro de una única `prisma.$transaction`:**
1. **Bloquear y leer el turno** con `SELECT … FOR UPDATE` (mismo patrón que 3.7 y 2.11). No existe: `404 TURNO_NO_ENCONTRADO`; ya `CANCELADO`: `409 TURNO_CANCELADO`.
2. **Guard de vigencia** (R5-6), **antes de mutar nada**: un turno `DISPONIBLE` o `COMPLETO` cuyo `fecha + hora_inicio` ya pasó no se cancela → `409 TURNO_VENCIDO`. **No aplica a un `PENDIENTE`** (salvedad N-1): un borrador vencido también debe poder descartarse. Un turno con clase dictada registrada (`spec_modulo_E.md`) siempre está vencido, así que queda protegido por el mismo guard.
3. **Condición y mutación en una sola sentencia** (Regla N.° 7), ya con la fila bloqueada:
   ```typescript
   const r = await tx.turno.updateMany({
     where: { idTurno: id, estadoTurno: { in: ["PENDIENTE", "DISPONIBLE", "COMPLETO"] } }, // PENDIENTE: N-1
     data: { estadoTurno: "CANCELADO", modificadoPorUsuarioId: usuarioId },
   });
   ```
   `count === 0` ⇒ `409 TURNO_MODIFICADO` (con la fila bloqueada no debería ocurrir; es la defensa de la Regla N.° 7). Como los pasos 1 y 2 no escribieron nada, un rechazo del guard no deja cambios que revertir.
4. **Liberación de recursos (AC3): la hace el trigger, no el servicio.** `turno_sincronizar_reservas` (migración `20260924150000_turnos_reservas_recursos_v2`, verificado leyendo el SQL) escucha `UPDATE OF "estadoTurno"`, borra **todas** las reservas del turno (aula, profesor y alumnos) y solo las reinserta si el estado es `DISPONIBLE` o `COMPLETO`. Al pasar a `CANCELADO` quedan liberadas sin código adicional. Un `PENDIENTE` no tiene reservas (3.2): no hay nada que liberar. **No se hace `DELETE` manual sobre `reservas_turno`** (así no hay una segunda vía que mantener). **No** se borra `TurnoAlumno`: el turno conserva sus inscriptos como historial, y `sincronizar_reserva_alumno` no vuelve a reservar a nadie porque el turno ya no está confirmado.
5. Ningún camino sale de `CANCELADO`.
6. Emitir `turno:cancelado` después del `COMMIT`, también para el descarte de un `PENDIENTE` (`estado_anterior: "PENDIENTE"`).

**Efectos sobre otras consultas (ya cubiertos por 3.2, sin cambios de código):** un `CANCELADO` desaparece de los calendarios (`spec_modulo_J.md` §3.1) y de las franjas ocupadas de 2.8 y 2.3 (todos filtran `IN ("DISPONIBLE","COMPLETO")`). El listado (2.4) y el detalle **lo siguen mostrando** con la etiqueta "Cancelado" y su historial completo (AC5). `ETIQUETA_ESTADO_TURNO` agrega `CANCELADO → "Cancelado"`.

**Relevado (28/09/2026):** el trigger ya contempla el cambio de estado (ver paso 4); no hace falta migración de triggers. **Pendiente solo la prueba** contra Postgres real, con el patrón de `turno.reservas.pg.test.ts`: cancelar un `DISPONIBLE` y comprobar que aula, profesor y alumnos quedan libres para otro turno superpuesto. Ojo: `ALTER TYPE ... ADD VALUE 'CANCELADO'` va en su propia migración (R5-5); el cuerpo del trigger compara contra literales, así que no hay que recrearlo.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "estado": "CANCELADO" }, "error": null }`

**Errores esperados:**
- `403 SIN_PERMISO` — falta `turnos:cancelar`.
- `404 TURNO_NO_ENCONTRADO` — turno inexistente.
- `409 TURNO_CANCELADO` — el turno ya está `CANCELADO`.
- `409 TURNO_VENCIDO` — turno `DISPONIBLE`/`COMPLETO` cuya fecha y hora de inicio ya pasaron.
- `409 TURNO_MODIFICADO` — el turno cambió entre la lectura y la escritura (Regla N.° 7).

**Fuera de alcance:** cancelación de un turno propio por el alumno (HU-C-14, Sprint 3); motivo de cancelación; notificaciones; reactivar un turno cancelado.

---

### 2.11. Reprogramar un turno (HU-C-06) — NUEVA en Revisión 5

> **Nota posterior (08/10/2026).** Sin cambios de contrato. El bloqueo suma al profesor y se relee que siga activo (HU-D-08, 2.21.3). Cambiar el profesor de una clase confirmada sigue fuera de esta ruta: lo hace `cambiarProfesorDeTurno` (2.21.2).

> **Revisión 6.** Ruta, cuerpo, respuesta y `code` sin cambios. Antes de cambiar fecha u hora se llama a `marcarVencidas` con el vencimiento anterior y, después, a `recalcularVencimientos` (2.16.6 y 2.17.3). El paso 4 evalúa a «cada alumno inscripto» = inscripciones vigentes.


**Ruta:** `PATCH /api/turnos/[id]/reprogramacion`
**Server Action equivalente:** — (no implementada: `src/server/turnos/actions.ts` no existe y el frontend llama directamente al Route Handler, ver Convenciones generales; nombre previsto `reprogramarTurnoAction()`, a confirmar contra el código)
**Servicio:** `src/server/turnos/turno.reprogramacion.service.ts` → `reprogramarTurno()`
**Permiso requerido:** `turnos:reprogramar` (exclusivo de Mesa de Entrada)
**Presentación:** `Dialog` en el Detalle de turno con **Fecha** y **Hora de inicio**; toast "Turno reprogramado correctamente".

```typescript
export const ReprogramarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema,
  hora_inicio: horaSchema,
}).strict(); // no admite duracion, profesor ni materia (HU-C-06 AC5)
```

**Comportamiento esperado, dentro de una única `prisma.$transaction`:**
1. Bloquear el turno con `SELECT … FOR UPDATE` (mismo patrón que 3.7). Debe existir y estar `DISPONIBLE` o `COMPLETO`: `PENDIENTE` → `409 TURNO_PENDIENTE` (se modifica con 2.1); `CANCELADO` → `409 TURNO_CANCELADO`.
2. **Guard de vigencia** sobre el turno actual (R5-6): `409 TURNO_VENCIDO`. La nueva fecha/hora también debe ser futura.
3. Validaciones de fecha de 2.1 pasos 2, 3, 5 y 6 (no pasada, día operativo, dentro del horario operativo con la duración **ya persistida**, alineada a `GRANULARIDAD_MINUTOS`). **Tope de anticipación al reprogramar** — **Aprobado por el PO el 29/09/2026 (N-4):** la nueva fecha no puede superar `max(fecha actual del turno, hoy + ANTICIPACION_MAXIMA_DIAS)`. Sin esto, un turno generado por 2.9 (hasta `generacion_maxima_meses` = 6 meses) se podría crear pero no mover, porque su nueva fecha también tendría que caer dentro de los 30 días.
4. **Triple validación (AC2)** contra turnos `DISPONIBLE`/`COMPLETO`, **excluyendo el propio turno** de cada comparación, con la misma fórmula de 3.3:
   - Profesor: `estaDentroDeHorarioAtencion()` y sin superposición.
   - Aula ya asignada: sin superposición.
   - **Cada alumno inscripto**: sin otro turno superpuesto.
   Se evalúan los tres y se informan **todos** los conflictos encontrados: `409 REPROGRAMACION_CONFLICTO` con `conflictos: [{ recurso: "PROFESOR" | "AULA" | "ALUMNO", id }]`. No se guarda nada.
5. `UPDATE` de `fechaTurno` y `horaInicioTurno` (y `modificadoPorUsuarioId`). **Estado, inscripciones, aula, profesor, duración e historial de clases dictadas no cambian** (AC4). El turno conserva `DISPONIBLE` o `COMPLETO`.
6. **Defensa de motor:** `reservas_turno` debe recalcular su rango. Una violación de la exclusión GiST (`23P01`) se traduce al mismo `409 REPROGRAMACION_CONFLICTO`, nunca se propaga como error técnico.
7. Emitir `turno:reprogramado` después del `COMMIT`.

**Relevado (28/09/2026), ya no es bloqueante:** `turno_sincronizar_reservas` escucha `AFTER INSERT OR UPDATE OF "estadoTurno", "fechaTurno", "horaInicioTurno", "duracionMinutosTurno", "profesorId", "aulaId"` y, ante cada cambio, borra las reservas del turno y las regenera con el nuevo intervalo, **incluidas las de los alumnos** (las lee de `turno_alumno`). Reprogramar mueve las reservas sin migración. Para traducir la violación de la exclusión GiST usar los helpers existentes de `turno.reserva-error.ts` (`esConflictoDeReserva`, `recursoEnConflicto`, `errorDeReserva`) en vez de reescribirlos. **Pendiente solo la prueba** contra Postgres real: reprogramar hacia un horario donde el aula, el profesor o un alumno ya están ocupados debe devolver `409 REPROGRAMACION_CONFLICTO` y dejar el turno intacto.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "fecha": "2026-10-06", "hora_inicio": "10:00", "hora_fin": "12:00", "estado": "DISPONIBLE" }, "error": null }`

**Fuera de alcance:** cambiar materia, profesor o duración de un turno confirmado (implicaría reconstruirlo); reprogramar un `PENDIENTE`.

**Errores esperados:**
- `400 VALIDATION_ERROR` — fallo de `ReprogramarTurnoSchema` (incluye campos no admitidos: duración, profesor, materia) y validaciones de fecha de 2.1 pasos 2, 3, 5 y 6 (fecha pasada, día no operativo, fuera del horario operativo, fuera de la granularidad, más allá del tope de anticipación; código exacto a confirmar contra el código).
- `403 SIN_PERMISO` — falta `turnos:reprogramar`.
- `404 TURNO_NO_ENCONTRADO` — turno inexistente.
- `409 TURNO_PENDIENTE` — turno `PENDIENTE` (se modifica con 2.1).
- `409 TURNO_CANCELADO` — turno `CANCELADO`.
- `409 TURNO_VENCIDO` — el turno actual ya pasó.
- `409 REPROGRAMACION_CONFLICTO` — profesor, aula o algún alumno ocupados en el nuevo horario (con `conflictos`), incluida la violación de la exclusión GiST.

---

### 2.12. Asignar prioridad al turno (HU-C-10) — NUEVA en Revisión 5

**Ruta:** `PATCH /api/turnos/[id]/prioridad`
**Server Action equivalente:** — (no implementada: `src/server/turnos/actions.ts` no existe y el frontend llama directamente al Route Handler, ver Convenciones generales; nombre previsto `actualizarPrioridadTurnoAction()`, a confirmar contra el código)
**Servicio:** `turno.service.ts` → `actualizarPrioridadTurno()`
**Permiso requerido:** `turnos:priorizar` (exclusivo de Mesa de Entrada)
**Presentación:** `Dialog` en el Detalle de turno; toast "Prioridad actualizada".

```typescript
export const PRIORIDADES_TURNO = ["NORMAL", "ALTA", "URGENTE"] as const;
export const ActualizarPrioridadSchema = z.object({ prioridad: z.enum(PRIORIDADES_TURNO) }).strict();
```

**Comportamiento esperado:**
1. Dentro de una `prisma.$transaction`, **leer el turno con bloqueo** (`SELECT … FOR UPDATE`, mismo patrón que 3.7 y 2.11): no existe → `404 TURNO_NO_ENCONTRADO`; `CANCELADO` → `409 TURNO_CANCELADO`. Esa lectura entrega la `prioridad_anterior` que exige el evento. Disponible en **cualquier otro estado**, incluido `PENDIENTE` y turnos vencidos (AC5, R5-6).
2. Si la prioridad enviada es la que ya tiene: `200` con `sin_cambios: true`, sin escribir ni emitir evento.
3. Si difiere: `updateMany` con `where: { idTurno: id, estadoTurno: { not: "CANCELADO" } }` y `data: { prioridadTurno, modificadoPorUsuarioId }` (Regla N.° 7; con la fila bloqueada `count === 0` no debería ocurrir y, si ocurre, `409 TURNO_MODIFICADO`).
4. `Normal` es el valor por defecto al crearse; **no se elige en el wizard** de creación.
5. Cambiar la prioridad **no dispara notificaciones** ni altera el orden por defecto del listado (sigue por fecha/hora) (AC3).
6. Emitir `turno:prioridad_actualizada` con la `prioridad_anterior` leída en el paso 1 y la nueva (AC4).

**Visualización:** el listado (2.4) y el calendario (`spec_modulo_J.md` 2.3) muestran un indicador cuando la prioridad es `ALTA` o `URGENTE`, con **texto o ícono, no solo color**.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "prioridad": "ALTA" }, "error": null }` (sin cambios: `{ "data": { "id": "cuid", "prioridad": "ALTA", "sin_cambios": true }, "error": null }`)

**Errores esperados:**
- `400 VALIDATION_ERROR` — `prioridad` fuera de `NORMAL`/`ALTA`/`URGENTE` o campos adicionales (`.strict()`).
- `403 SIN_PERMISO` — falta `turnos:priorizar`.
- `404 TURNO_NO_ENCONTRADO` — turno inexistente.
- `409 TURNO_CANCELADO` — turno `CANCELADO`.
- `409 TURNO_MODIFICADO` — el turno pasó a `CANCELADO` entre la lectura y la escritura (Regla N.° 7).

---

### 2.13. (RETIRADA) Asociar forma de pago al turno — HU-C-11 fuera del Sprint 2

**Esta sección no tiene contrato.** El backlog v2 del 28/09/2026 **retiró HU-C-11** (Asociar forma de pago al turno). Se conserva el número para no renumerar (`sdd-metodologia.md`). Consecuencias, ya aplicadas en el resto de la spec y en las demás:
- `Turno` **no** lleva `formaPagoId`; no existe ruta `PUT /api/turnos/[id]/forma-pago`, ni el permiso `turnos:forma_pago`, ni el evento `turno:forma_pago_actualizada`, ni el campo `forma_pago` en el listado o el detalle.
- `TurnoAlumno` **no** lleva `createdAtTurnoAlumno` (existía solo para definir "primer alumno inscripto").
- La forma de pago vive únicamente en el **pago** (`spec_modulo_I.md` §2.4): HU-I-01 la pide al registrar y la propone por defecto a partir de la **preferida del alumno que paga** (HU-B-03), sin obligarla.
- HU-I-03 ya no menciona turnos: el catálogo se usa para alumnos (HU-B-03) y pagos (HU-I-01).

---

### 2.14. Autoservicio del alumno: solicitar y consultar turnos propios (HU-C-12, HU-C-13) — NUEVA en Revisión 5

> **Revisión 6.** 2.14.1 y 2.14.2 conservan su contrato y se extienden con 2.17 (resumen, reserva y estado de pago). El «Fuera de alcance: que el alumno cancele o cambie su inscripción» queda cubierto por 2.19 (cancelar); cambiar de clase sigue fuera de alcance.


**Aclaración de alcance (propuesta de orden de flujo, §4):** el alumno **no crea turnos**. Se **inscribe en un turno ya existente**, elige Materia → Profesor → Horario entre las combinaciones que ya existen, y **no elige aula** (ya viene con el turno).

**Identidad:** el alumno se resuelve siempre a partir de la sesión: `obtenerAlumnoDeUsuario(session.sub)` (Módulo B, 2.8). Nunca se acepta un `alumno_id` del cliente. Si la cuenta no tiene ficha vinculada: `403 SIN_PERMISO`.

#### 2.14.1. Mis turnos (HU-C-13)

> **Revisión 6.** Cada ítem suma el objeto `inscripcion` (situación de pago, vencimiento, precio y si se puede cancelar) y se listan también las inscripciones finalizadas, una tarjeta por clase (2.17.4). Los campos, los parámetros, la paginación y `totales` de Sprint 2 no cambian.


**Ruta:** `GET /api/turnos/propios?vista=proximos|anteriores&pagina=`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** listado de los turnos propios del alumno en `src/server/turnos/turno.service.ts` (nombre exacto de la función a confirmar contra el código)
**Permiso requerido:** `turnos:leer_propios` (rol ALUMNO)

```typescript
export const MisTurnosQuerySchema = z.object({
  vista: z.enum(["proximos", "anteriores"]).default("proximos"),
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(10).default(10), // HU-C-13 AC6: de a 10, fijo
}).strict();
```
**Pantalla nueva:** "Mis turnos" (mapa de pantallas §2). Página completa.

1. Los turnos donde el alumno autenticado está inscripto (`TurnoAlumno`), **en cualquier estado, incluido `CANCELADO`** (HU-C-13 AC1 del backlog v2: "el alumno necesita enterarse de que su clase se canceló"). Funciona porque 2.10 **conserva** los `TurnoAlumno` al cancelar.
2. Cada ítem: `turno_id` (identificador técnico de la tarjeta), `fecha`, `hora_inicio`–`hora_fin`, `materia`, `profesor`, `aula`, **`estado`** y **`clase_dictada: boolean`** (true si existe un registro `ClaseDictada` para ese turno). **Sin** el dato de alumnos inscriptos (AC2). Turnos obtiene el indicador mediante el servicio público `obtenerClaseDictadaDeTurno()` de Historial (E §2.4), conforme a la Regla N.° 3. La pantalla muestra la etiqueta «Clase dictada» en Anteriores cuando el valor es `true` (decisión del PO, 29/09/2026). La UI destaca los `CANCELADO` con texto o ícono, no solo color.
3. **Dos pestañas (definidas por el backlog v2, AC3):** `proximos` (por defecto): `fecha + hora_inicio ≥ ahora`, **cualquier estado** —un `CANCELADO` se ve acá, destacado, mientras su fecha y hora originales no hayan pasado—, orden ascendente. `anteriores`: `fecha + hora_inicio < ahora`, cualquier estado, orden descendente. El pase de una a otra es automático por fecha/hora contra el momento de la consulta: no mueve datos ni requiere proceso de fondo. Paginación server-side en ambas.
4. **Paginación de a 10 por pestaña (HU-C-13 AC6, backlog del 28/09).** `por_pagina` vale 10 y no admite más. La respuesta trae `paginacion` de la pestaña pedida y **`totales: { proximos, anteriores }`**: el contador de cada pestaña muestra su **total**, no el de la página, y para mostrar los dos contadores a la vez el servidor los calcula siempre, sin importar cuál pestaña se pidió. Con 10 turnos o menos la UI **no muestra la paginación**; al cambiar de pestaña la UI vuelve a pedir `pagina=1`.
   ```json
   { "data": { "items": [], "paginacion": { "total": 23, "pagina_actual": 1, "total_paginas": 3, "por_pagina": 10 },
               "totales": { "proximos": 23, "anteriores": 41 } }, "error": null }
   ```
5. Sin turnos en la pestaña: `200` con `items: []`; la UI muestra "Todavía no tenés turnos" en Próximos (con acceso directo a HU-C-12) o "No tenés turnos anteriores" en Anteriores (AC4).

**Errores esperados (2.14.1):**
- `400 VALIDATION_ERROR` — `vista` distinta de `proximos`/`anteriores`, `pagina` inválida o parámetros adicionales (`.strict()`).
- `403 SIN_PERMISO` — falta `turnos:leer_propios` o la cuenta no tiene ficha de alumno vinculada.

---

#### 2.14.2. Solicitar turno (HU-C-12)

> **Revisión 6.** «Inscribirme» pasa por el resumen de 2.17.1; el `POST` conserva su contrato y deja la inscripción como reserva con plazo desde HU-C-22 (2.17.2). La leyenda «El pago se abona en el centro» de abajo se conserva hasta que se mergee HU-C-22 y después la reemplaza la de la reserva. «Inscripción abierta» se decide con `ocupacion` (2.17.2). Se suman `409 RESERVA_PREVIA_SIN_PAGO` y `422 MATERIA_SIN_TARIFA`. Del «Fuera de alcance» de más abajo, la frase sobre el cobro en línea queda superada: el backlog sacó el pago en línea (el centro cobra en el mostrador) y la tarifa por materia existe desde HU-L-06.


**Pantalla:** "Solicitar turno", **página completa propia** (revisión del 28/09 del mapa de pantallas), accedida desde el botón de "Mis turnos". Tres columnas (Materia / Profesor / Horario), resumen al pie y botón "Inscribirme".
**Server Action equivalente:** — (no implementada: `src/server/turnos/actions.ts` no existe y el frontend llama directamente al Route Handler, ver Convenciones generales; nombre previsto `inscribirseEnTurnoAction()`, a confirmar contra el código)
**Permiso requerido:** `turnos:solicitar_propio` (rol ALUMNO)

**Rutas de opciones (solo lectura):** `GET /api/turnos/inscripcion/opciones?materia_id=&profesor_id=`
- Sin parámetros: materias activas que tienen al menos un turno con inscripción abierta.
- Con `materia_id`: profesores que dictan esa materia y tienen al menos un turno con inscripción abierta.
- Con `materia_id` y `profesor_id`: los **horarios**, es decir, los turnos con inscripción abierta de esa combinación, con `turno_id`, fecha, hora, y cupo libre. No se devuelve el aula (AC1) ni datos de otros alumnos.
- **Inscripción abierta** = `estadoTurno = DISPONIBLE`, con `fecha + hora_inicio` futura y `alumnos_inscriptos < cupoMaximoTurno`, y el alumno no inscripto ya.
- Combinación sin turnos: `200` con lista vacía; la UI muestra "No hay turnos disponibles para esta combinación" y ofrece elegir otra materia/profesor (AC2).

**Ruta de inscripción:** `POST /api/turnos/[id]/inscripcion` (sin body)
**Servicio:** reutiliza el núcleo de 2.5, `inscribirAlumnoEnTurno(turnoId, alumnoId, { origen, alumnoActivo }, tx)` (no se reimplementa), con `origen: "AUTOSERVICIO"` y el `alumnoActivo` que ya devolvió `obtenerAlumnoDeUsuario()`.

**Comportamiento esperado (dentro de `prisma.$transaction`, con `SELECT … FOR UPDATE` del turno, 3.7):**
1. El turno debe existir y estar `DISPONIBLE`: `COMPLETO` → `409 CUPO_INSUFICIENTE`; `PENDIENTE` o `CANCELADO` → `409 TURNO_NO_DISPONIBLE`. Guard de vigencia: `409 TURNO_VENCIDO`. **Traducción de códigos:** el núcleo `inscribirAlumnoEnTurno` lanza los códigos de 2.5 (`TURNO_PENDIENTE`, `TURNO_CANCELADO`, `CUPO_INSUFICIENTE`); esta ruta de autoservicio traduce `TURNO_PENDIENTE` y `TURNO_CANCELADO` a `TURNO_NO_DISPONIBLE` para no exponer al alumno el estado interno del turno. `CUPO_INSUFICIENTE` se conserva.
2. Alumno activo: se usa el `activo` que ya devuelve `obtenerAlumnoDeUsuario()` (2.14, identidad); **no** se vuelve a consultar con `verificarAlumnoActivo()`: la ruta lo pasa al núcleo como `alumnoActivo` y éste omite el paso 2 de 2.5. Si `activo` es `false`: `409 ALUMNO_INACTIVO`. Ya inscripto: `409 ALUMNO_YA_ASIGNADO`.
3. **Revalidación al confirmar (AC3):** el alumno no tiene otro turno `DISPONIBLE`/`COMPLETO` superpuesto: `409 ALUMNO_NO_DISPONIBLE`. El núcleo lanza el literal de 2.5 («El alumno ya tiene un turno agendado en ese horario»); esta ruta lo **traduce** a segunda persona, igual que traduce los estados del paso 1, con el mensaje «Ya tenés otro turno en ese horario» y sin cambiar el `code`. Y el cupo sigue libre (guarda atómica 3.7): `409 CUPO_INSUFICIENTE`.
4. Insertar `TurnoAlumno`. Si `inscriptos + 1 === cupoMaximoTurno`: `DISPONIBLE → COMPLETO` automáticamente (AC5).
5. Emitir `turno:alumno_agregado` con `origen: "AUTOSERVICIO"` y, si hubo transición, `turno:completado`.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "alumnos_inscriptos": "4/5", "estado": "DISPONIBLE" }, "error": null }` — la UI informa "Te inscribiste correctamente" y, junto a ese mensaje, **"El pago se abona en el centro"** (HU-C-12 AC6 del backlog v2: en este sprint la inscripción propia no exige pago previo ni integra pasarela; el pago lo registra Mesa de Entrada con HU-I-01). El banner se muestra al volver a "Mis turnos", como indica el flujo aprobado en el mapa de pantallas.

**Errores esperados (2.14.2):**
- `403 SIN_PERMISO` — falta `turnos:solicitar_propio` o la cuenta no tiene ficha de alumno vinculada.
- `404 TURNO_NO_ENCONTRADO` — turno inexistente.
- `409 TURNO_NO_DISPONIBLE` — turno `PENDIENTE` o `CANCELADO` (traducción de `TURNO_PENDIENTE`/`TURNO_CANCELADO`).
- `409 TURNO_VENCIDO` — el turno ya pasó.
- `409 CUPO_INSUFICIENTE` — turno `COMPLETO` o cupo agotado.
- `409 ALUMNO_INACTIVO` — la ficha del alumno está inactiva.
- `409 ALUMNO_YA_ASIGNADO` — el alumno ya está inscripto.
- `409 ALUMNO_NO_DISPONIBLE` — el alumno tiene otro turno superpuesto («Ya tenés otro turno en ese horario»).

**Turnos generados (R5-9, resuelto):** los que crea 2.9 nacen `DISPONIBLE` 0/N, así que aparecen en estas opciones desde el primer momento, tal como pide el mapa de pantallas.

**Fuera de alcance:** que el alumno cancele o cambie su inscripción (HU-C-14, Sprint 3), crear turnos, elegir aula, y el cobro online previo (Mercado Pago), que pasa a Sprint 3 porque Noctium no modela precios por materia.

---

### 2.15. Servicios públicos del módulo — NUEVA en Revisión 5

> **Nota posterior (08/10/2026).** La tabla de abajo **no cambia**. Las funciones que piden HU-B-07 y HU-D-08 se declaran en 2.21.

> **Revisión 6.** Todas las funciones conservan **firma y forma del resultado**; cambia el origen del dato: cuentan solo inscripciones vigentes (2.16.6) y los estados `DISPONIBLE`/`COMPLETO` se deciden con `ocupacion` (2.16.5). `obtenerAlumnosInscriptosDeTurno` devuelve ids de **alumno** con inscripción vigente (no ids de `TurnoAlumno`, que ahora tiene id propio). En `ajustarCuposPorCapacidadDeAula`, una reserva vencida sin marcar no genera conflicto de capacidad.


Conforme a la Regla N.° 3: se declaran en `src/server/turnos/turno.publico.ts`. Otros módulos las invocan **en lugar de consultar** `turnos`, `turno_alumno` ni `reservas_turno`. No son endpoints ni exigen un permiso `turnos:*`: el control de acceso lo hace la ruta del módulo consumidor. El parámetro opcional `db` acepta un `Prisma.TransactionClient` del llamador y, si se omite, usa `prisma`; la emisión posterior al COMMIT se invoca sin el `tx` ya cerrado. **`turno.publico.ts` no importa nada de los demás módulos** (evita el ciclo con `turno.disponibilidad.ts`, ver "Convenciones generales").

| Función | Devuelve | Consumidores |
|---|---|---|
| `bloquearTurnoParaOperacion(turnoId, tx)` | `{ id, estado, fecha, hora_inicio, hora_fin, duracion_min, materia_id, profesor_id, aula_id, alumno_ids, vencido } \| null`, con `SELECT … FOR SHARE` sobre la fila | `spec_modulo_I.md` §2.4 (registrar pago), `spec_modulo_E.md` §2.1 (clase dictada) |
| `obtenerAlumnosInscriptosDeTurno(turnoId, db?)` | `string[]` (ids de `TurnoAlumno`), o `null` si el turno no existe. Solo lectura, sin bloqueo | `spec_modulo_I.md` §2.5 (opciones del modal de pago) |
| `contarTurnosFuturosDeProfesorPorMateria(profesorId, materiaId, db?)` | `{ confirmados: number, pendientes: number }`: turnos futuros `DISPONIBLE`/`COMPLETO` (los que **bloquean**) y `PENDIENTE` (solo informativo) | HU-D-07, `spec_modulo_D.md` 2.7 (el **listado** paginado de esos turnos sale de `listarTurnosFuturosDeProfesorPorMateria`, la fila siguiente; no de esta función ni del listado de 2.7) |
| `listarTurnosFuturosDeProfesorPorMateria(profesorId, materiaId, { pagina, porPagina }, db?)` | `{ items: [{ turno_id, fecha, hora_inicio, hora_fin, aula, alumnos_inscriptos: "3/5", estado }], total, pagina, por_pagina }`: solo turnos futuros `DISPONIBLE`/`COMPLETO` (los que bloquean la baja de la materia) | HU-D-07 AC3 (modal «Ver turnos»), `spec_modulo_D.md` 2.7, vía `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros` |
| `ajustarCuposPorCapacidadDeAula(aulaId, nuevaCapacidad, usuarioId, tx)` | `{ ok: true, turnos_actualizados: number, eventos: EventoTurnoPendiente[] } \| { ok: false, turnos_en_conflicto, max_inscriptos }`. La unión `EventoTurnoPendiente` se detalla debajo | HU-K-03, `spec_modulo_K.md` 2.4 |
| `emitirEventosTurno(eventos: EventoTurnoPendiente[], db?: Prisma.TransactionClient): Promise<void>` | Si `eventos` está vacío no escribe; de lo contrario hace un solo `eventoTurno.createMany` y propaga el error de escritura sin atraparlo. En código, `db` se declara con valor por defecto `prisma`, por eso es opcional para el llamador | `spec_modulo_K.md` 2.4 paso 6: K la invoca después del COMMIT, sin pasar el `tx` cerrado |
| `listarTurnosParaCalendario({ desde, hasta, profesorId?, materiaId? }, db?)` | Turnos `DISPONIBLE`/`COMPLETO` con `fecha` en el rango **cerrado e inclusivo** `[desde, hasta]` (fechas `AAAA-MM-DD`; la vista día usa `desde = hasta`). Por turno: `{ turno_id, fecha, hora_inicio, hora_fin, estado, prioridad, materia: { id, nombre }, profesor: { id, nombre_para_mostrar }, aula: { id, nombre }, alumnos: string[], inscriptos: number, cupo: number \| null, alumnos_inscriptos: "3/5" }[]`, ordenados por fecha, hora de inicio, apellido y nombre del profesor e id (el mismo orden que exige `spec_modulo_J.md` §2.3). Nunca devuelve `PENDIENTE` | HU-J-03, `spec_modulo_J.md` 2.1, 2.2, 2.3 |
| ~~`contarTurnosPorMes(desde, hasta, db?)`~~ — **RETIRADA el 01/10/2026** (`spec_modulo_H.md` Revisión 2: su único consumidor, HU-H-01 original, fue reemplazado) | `desde` y `hasta` son **meses `AAAA-MM`** con límites **inclusivos** (cuenta los turnos cuya `fechaTurno` cae entre el primer día del mes `desde` y el último día del mes `hasta`). Devuelve `{ mes: "AAAA-MM", cantidad }[]`: turnos `DISPONIBLE`/`COMPLETO`/`CANCELADO` agrupados por el mes de `fechaTurno` (**no** de creación); sin ceros | ~~HU-H-01~~ (sin consumidores) |
| `promediarOcupacionTurnosPorMes(desde, hasta, fechaMaxima, db?)` — **NUEVA el 01/10/2026** | `desde` y `hasta` son meses `AAAA-MM` con límites inclusivos y `fechaMaxima` es una fecha `AAAA-MM-DD` inclusiva (tope adicional: el llamador pasa "hoy"). Devuelve `{ mes: "AAAA-MM", promedio, turnos }[]`, **solo los meses con datos**, en orden cronológico. `promedio` es la media simple, sin redondear, calculada en `numeric` (determinística, independiente del orden de suma) y entregada como `float8`, de `inscriptos / cupoMaximoTurno` (razón 0–1, `inscriptos` = filas de `turno_alumno`) sobre los turnos `DISPONIBLE`/`COMPLETO` con `cupoMaximoTurno > 0` agrupados por el mes de `fechaTurno`. `turnos` es la cantidad de turnos promediados. `$queryRaw` parametrizado, de solo lectura | HU-H-02 revisada, `spec_modulo_H.md` §2.3 |

**Contrato de `EventoTurnoPendiente` (sincronización de §2.15):** unión discriminada por `tipoEvento`, con `turnoId: string` y `payloadEvento` tipado para cada variante:

| `tipoEvento` | `payloadEvento` |
|---|---|
| `turno:cupo_actualizado` | `{ turno_id: string, aula_id: string, cupo_anterior: number \| null, cupo_nuevo: number, usuario_id: string }` |
| `turno:completado` | `{ turno_id: string, alumno_ids: string[], cupo_maximo: number, usuario_id: string }` |
| `turno:disponible_nuevamente` | `{ turno_id: string, alumno_id_liberado: null, usuario_id: string }` |

`EventoTurno` sigue exportado como alias de `EventoTurnoPendiente` para los consumidores existentes de Aulas. `emitirEventosTurno()` envía, por cada elemento y en el orden de entrada del arreglo, las cuatro columnas `tipoEvento`, `turnoId`, `usuarioId` y `payloadEvento` intacto (incluidos los `null`); toma `usuarioId` del `payloadEvento.usuario_id`, obligatorio en las tres variantes. Una lectura posterior de PostgreSQL necesita `ORDER BY` si requiere orden. El emisor no decide la respuesta al usuario si falla después del COMMIT: K debe tratar ese error sabiendo que Aula y cupos ya quedaron confirmados, sin presentarlo como rollback.

**`ajustarCuposPorCapacidadDeAula` — comportamiento** (dentro del `tx` del llamador, que es la transacción de `modificarAula()`):
1. Bloquear con `FOR UPDATE`, ordenados por `idTurno` (evita interbloqueos), los turnos de ese `aulaId` en estado `PENDIENTE`, `DISPONIBLE` o `COMPLETO`. **Después de obtener los locks**, capturar una sola vez el instante actual y filtrar todo el lote: para este ajuste un turno se incluye si `fecha + hora_inicio ≥ ahora`, a precisión de minuto en `America/Argentina/Buenos_Aires`. Los turnos pasados no generan conflicto por capacidad ni se modifican, aunque la consulta también haya bloqueado sus filas. Este `≥` es particular del ajuste de cupos; `turnoSigueVigente()` y los demás consumidores que usan vigencia estricta conservan `>`.
2. Con la fila bloqueada, contar `TurnoAlumno` de cada uno. Si algún turno `DISPONIBLE`/`COMPLETO` tiene más inscriptos que `nuevaCapacidad`: devolver `{ ok: false, … }` sin escribir (HU-K-03 AC2). El llamador traduce a `409` con el mensaje literal de la HU.
3. Si no hay conflicto: `cupoMaximoTurno = nuevaCapacidad` en todos ellos (mismo criterio de HU-C-15: cupo = capacidad del aula) y **recalcular el estado** (**ratificado por el PO el 29/09/2026 — Q4**): `COMPLETO` si `inscriptos ≥ cupo`, `DISPONIBLE` si hay lugar. Un `PENDIENTE` solo actualiza el cupo.
4. Armar `turno:cupo_actualizado` por turno, y `turno:completado` / `turno:disponible_nuevamente` si hubo transición, y **devolverlos en `eventos`**: esta función no los emite. El llamador (K) los emite con `emitirEventosTurno(eventos)` **después del `COMMIT`** de su transacción, sin pasar el `tx` ya cerrado (Regla N.° 2, opción b).

**`listarTurnosFuturosDeProfesorPorMateria` — comportamiento (HU-D-07 AC3, modal «Ver turnos»):** recibe `profesorId`, `materiaId` y `{ pagina, porPagina }` (D la invoca con `porPagina = 10`, fijo). Filtra por ese profesor y esa materia, `estadoTurno IN ("DISPONIBLE","COMPLETO")` y `fechaTurno + horaInicioTurno` estrictamente posterior (`>`) al minuto actual (`America/Argentina/Buenos_Aires`): es el mismo criterio estricto de «futuro» y los mismos estados que **bloquean** en `contarTurnosFuturosDeProfesorPorMateria()`, distinto del `≥` usado solo en el ajuste de cupos; de ese modo `total` coincide con `confirmados`. `PENDIENTE`, `CANCELADO` y pasados no aparecen. Orden por fecha y hora de inicio ascendentes, con `idTurno` como desempate. Cada ítem: `turno_id`, `fecha`, `hora_inicio`, `hora_fin`, `aula` (nombre; un turno `DISPONIBLE`/`COMPLETO` siempre tiene aula), `alumnos_inscriptos` (`"3/5"`) y `estado` (`"DISPONIBLE" | "COMPLETO"`; el consumidor lo muestra con `ETIQUETA_ESTADO_TURNO`). Una `pagina` posterior a la última devuelve `items: []` con el `total` real. La función no valida permisos: los valida la ruta de D (`profesores:leer`). Reemplaza a los parámetros `materia_id`, `estados` y `solo_futuros` que tenía el listado de 2.7 (HU-C-02 AC6).


**Nota de sincronización (01/10/2026, HU-D-07):** `listarTurnosFuturosDeProfesorPorMateria()` quedó implementada en `turno.publico.ts` (aditiva, sin cambios en las funciones existentes). Horas en `"HH:mm"` (mismo `horaDeMinutos()` del archivo), `fecha` `"AAAA-MM-DD"`, orden fecha → hora → `idTurno`, y la misma condición de «futuro» que `contarTurnosFuturosDeProfesorPorMateria()`. El formato `"inscriptos/cupo"` (y `"Sin asignar"` sin cupo) replica el de `presentar()` de 2.4: no se importa porque es privada de `turno.service.ts` y el público no puede importar ese archivo.

**`listarTurnosParaCalendario` — comportamiento (Revisión 5, H-09):** filtra `estadoTurno IN ("DISPONIBLE","COMPLETO")` dentro de la consulta (3.2, 3.9); `PENDIENTE` y `CANCELADO` no se devuelven jamás. El rango es **cerrado e inclusivo** (`fecha >= desde AND fecha <= hasta`; contrato acordado con J: la vista día usa `desde = hasta` y J pasa el último día del rango tal cual, sin sumar un día); si `desde > hasta` devuelve `[]`. `alumnos` lista a cada inscripto como `"Apellido, Nombre"`; `profesor.nombre_para_mostrar` es `"Apellido, Nombre"`; `cupo` es `null` solo si el turno no tiene aula (no ocurre en `DISPONIBLE`/`COMPLETO`). Si viene `profesorId` filtra por profesor; si viene `materiaId`, por materia (los filtros se pueden combinar: J §2.2 los usa juntos para el rol Profesor). Es la única vía por la que el módulo J lee turnos: `calendario.service.ts` deja de consultar `Turno` directamente y se migra dentro de HU-J-03, lo que cierra la excepción temporal a la Regla N.° 3 que J documentaba.

---

### 2.16. Modelo de inscripción del Sprint 3: vigencia, estado de pago y precio (convención 8 a) — NUEVA en Revisión 6

> **Compatibilidad (`PR-0.md` §1.1).** Esta sección **no cambia ningún endpoint de los Sprints 1 y 2**: cambia qué se guarda por dentro cuando alguien se inscribe, sale de una clase o la cancela. Lo que ve el cliente de las operaciones de 2.2, 2.4, 2.5, 2.10, 2.11, 2.14 y 2.15 (ruta, cuerpo, forma de la respuesta, códigos HTTP y `code` de error) **se conserva**; las únicas diferencias son las de la tabla de 2.16.6, y cada una la manda el backlog.

#### 2.16.1. Qué es una inscripción

Hoy la inscripción es `TurnoAlumno`: clave primaria compuesta `(turnoId, alumnoId)`, sin estado ni identificador propio (`schema.prisma`). El backlog (convención 8 a y HU-C-22, criterio 3) exige que una inscripción **no se borre** y que un alumno pueda tener, en la misma clase, una inscripción finalizada y otra vigente. Por eso `TurnoAlumno` **se extiende** (decidido en `PR-0.md` §2.0): mismo modelo, misma tabla `turno_alumno` y misma relación `Turno.alumnos`, ahora con **identificador propio** y con las columnas de abajo. No se crea un modelo nuevo, así que los `include`/`select` de `alumnos` que ya existen siguen compilando y solo necesitan el filtro de vigencia (2.16.3).

Los nombres de abajo son **conceptuales**: los nombres reales de las columnas los fija el PR 0 con el sufijo de entidad del schema. Esta spec no los redefine.

| Dato | Qué guarda | Quién lo escribe |
|---|---|---|
| `vigencia` | Si la inscripción sigue en pie: `VIGENTE`, `CANCELADA_ALUMNO`, `RESERVA_VENCIDA`, `BAJA_ALUMNO`, `QUITADA_CENTRO` | `crearInscripcion` y `finalizarInscripcion` |
| `estadoPago` | Solo tiene sentido si la inscripción es `VIGENTE`: `RESERVADA`, `PAGADA`, `PAGO_SIN_REGISTRAR`. Al finalizar la inscripción se conserva **congelado** con su último valor (lo lee la regla de re-reserva, 2.17) | `crearInscripcion`, `marcarPagada` y `recalcularEstadoPago` |
| `reservadaEl` | Momento de la reserva o de la inscripción | `crearInscripcion` |
| `inicioPlazo` | Momento desde el que corre el plazo vigente. Se guarda **aparte** de `reservadaEl` porque una anulación de pago lo reinicia (HU-C-24, criterio 5) | `crearInscripcion`, `recalcularEstadoPago` |
| `venceBaseEl` | `inicioPlazo` + plazo de pago aplicado al iniciar ese plazo, **sin** el tope del inicio de la clase. `null` si nunca estuvo `RESERVADA` o si pasó a `PAGADA`; al finalizar la inscripción se conserva congelado | ídem y `marcarPagada` |
| `venceEl` | Vencimiento efectivo: el menor entre `venceBaseEl` y el inicio de la clase. Mismo criterio de `null` y de congelado que `venceBaseEl` | `crearInscripcion`, `recalcularVencimientos`, `recalcularEstadoPago`, `marcarPagada` |
| `precio` | Entero en pesos: tarifa por hora de la materia × duración / 60, **congelado** al crear la inscripción (HU-L-06, criterios 3 a 5) | `crearInscripcion` |
| `reabiertaPorAnulacion` | Marca de la reserva reabierta por la anulación de un pago (HU-C-24, criterio 5) | `recalcularEstadoPago` |
| `finalizadaEl`, `finalizadaPor` | Fecha y usuario (o «Proceso automático») del cambio de vigencia | `finalizarInscripcion`, `marcarVencidas` |

Cada transición (vigencia y estado de pago anteriores y nuevos, actor y fecha) queda además en el **historial de estados de la inscripción** que crea el PR 0 (Regla N.° 2, `PR-0.md` §2.1 y §2.10). El actor es un usuario o el «Proceso automático» (`actorTipo`).

#### 2.16.2. Transiciones permitidas

| Desde | Hacia | Lo dispara | HU |
|---|---|---|---|
| (no existe) | `VIGENTE` · `RESERVADA` | El alumno reserva desde «Solicitar clase» (2.17) | HU-C-22 |
| (no existe) | `VIGENTE` · `RESERVADA` | Mesa de entrada inscribe y no se paga en el momento (2.18) | HU-C-24, criterio 3 |
| (no existe) | `VIGENTE` · `PAGADA` | Inscripción al confirmar el pago (excepción de HU-C-24, criterio 3) | HU-I-10 |
| (no existe) | `VIGENTE` · `PAGO_SIN_REGISTRAR` | **Interino**: inscripción sin plazo, como hoy (2.16.4) | — |
| `VIGENTE` · `RESERVADA` | `VIGENTE` · `PAGADA` | Se registra un pago | HU-I-10 |
| `VIGENTE` · `PAGO_SIN_REGISTRAR` | `VIGENTE` · `PAGADA` | Se registra un pago | HU-I-10, HU-I-01 |
| `VIGENTE` · `PAGADA` | `VIGENTE` · `RESERVADA` (plazo nuevo) | Se anula el último pago y la clase no empezó (2.18) | HU-C-24, criterio 5 |
| `VIGENTE` · `PAGADA` | `VIGENTE` · `PAGO_SIN_REGISTRAR` | Se anula el último pago y la clase ya empezó o está cancelada | HU-C-24, criterio 5 |
| `VIGENTE` | `RESERVA_VENCIDA` | Venció una reserva sin pago (proceso o vencimiento al operar) | HU-C-24 |
| `VIGENTE` | `CANCELADA_ALUMNO` | El alumno cancela su inscripción (2.19) | HU-C-14 |
| `VIGENTE` | `QUITADA_CENTRO` | Mesa de entrada quita al alumno (2.5, 2.2, 2.20) | HU-C-04, HU-C-26 |
| `VIGENTE` | `BAJA_ALUMNO` | Se desactiva al alumno (`spec_modulo_B.md`) | HU-B-07 |

Una inscripción con `vigencia` distinta de `VIGENTE` **no vuelve a ser vigente**: si el alumno vuelve a inscribirse, se crea otra fila. `CANCELADA_ALUMNO`, `RESERVA_VENCIDA`, `BAJA_ALUMNO` y `QUITADA_CENTRO` son terminales. Cada pago se vincula a **su** inscripción (`inscripcionId`, `PR-0.md` §2.3): los pagos de una inscripción cancelada no cuentan para una inscripción nueva del mismo alumno en la misma clase, que nace sin pagos (HU-C-22, criterio 3).

#### 2.16.3. Quién cuenta como inscripto: un solo servicio

«Vigente a un momento dado» es un **único servicio público del módulo C** (`PR-0.md` §2.2) y lo usan los módulos C, E, H, I y J. Esta spec no lo reimplementa: lo **usa**. Dentro del módulo C, todo lo que hoy cuenta o recorre `TurnoAlumno` pasa a usarlo:

- `esVigenteEn(inscripcion, momento)`: `vigencia = VIGENTE` y, si está `RESERVADA` en una clase `DISPONIBLE`/`COMPLETO`, `momento < venceEl`. Una reserva vence cuando el momento es **igual o posterior** a `venceEl`. En una clase `CANCELADO` las reservas dejan de vencer.
- `inscripcionesVigentes(db, turnoId, momento)` y `ocupacion(db, turnoId, momento)`: para el cupo, la superposición de horarios y el estado Disponible/Completa que se muestra.
- `sqlVigenteEn(alias, momento)`: el fragmento equivalente para las consultas crudas (por ejemplo, los `COUNT` de `turno.publico.ts` y el promedio de ocupación de 2.15).
- `marcarVencidas(tx, turnoId)` y `marcarVencidasDelAlumno(tx, alumnoId, { momento, clases })`: marcan como `RESERVA_VENCIDA` las reservas ya vencidas, con la misma condición atómica que el proceso programado (Regla N.° 7).

**Regla:** ninguna función del módulo C lee `vigencia`, `estadoPago` ni `venceEl` por su cuenta para decidir si alguien cuenta como inscripto. Si la regla de vigencia cambia, cambia en un solo lugar.

#### 2.16.4. Escrituras: `crearInscripcion` y `finalizarInscripcion`

**Toda escritura sobre inscripciones pasa por el servicio de inscripción** (`PR-0.md` §2.13, `inscripcion.service.ts` y fachada `inscripcion.publico.ts`). Las rutas y servicios de 2.2, 2.5 y 2.14 dejan de hacer `create`, `createMany`, `delete` o `deleteMany` sobre `TurnoAlumno`.

| Operación de este módulo | Servicio | `origen` | `conReserva` hoy (interino, `PR-0.md` §2.15) | `conReserva` desde |
|---|---|---|---|---|
| «Solicitar clase» del alumno (2.14.2, 2.17) | `crearInscripcion` | `ALUMNO` (evento: `AUTOSERVICIO`) | `false` → `PAGO_SIN_REGISTRAR`, sin plazo, como hoy | HU-C-22: `true` |
| Agregar un alumno desde mesa de entrada (2.5) | `crearInscripcion` | `CENTRO` (evento: `MESA_ENTRADA`) | `false` | HU-C-24: `true` |
| Confirmar la clase con sus alumnos (2.2, paso «Agregar alumnos» del wizard de HU-C-18) | `crearInscripcion` por alumno | `CENTRO` | `false` | HU-C-24: `true` |
| Inscribir al confirmar el pago | `crearInscripcion` | `PAGO` | — | HU-I-10 |
| Quitar un alumno (2.5) o salir del conjunto en 2.2 | `finalizarInscripcion` → `QUITADA_CENTRO` | — | — | — |
| Cancelar la propia inscripción (2.19) | `finalizarInscripcion` → `CANCELADA_ALUMNO` | — | — | HU-C-14 |

Mapeo de nombres: el campo `origen` del payload de los eventos de 2.15/§4 conserva sus valores `MESA_ENTRADA` y `AUTOSERVICIO`; el parámetro `origen` del servicio del PR 0 usa `CENTRO` y `ALUMNO`. El valor `PAGO` es nuevo y se agrega al evento.

**Interino.** Entre el merge del PR 0 y el de cada HU el comportamiento visible es el de hoy (`PR-0.md` §2.15): la inscripción queda `PAGO_SIN_REGISTRAR`, sin plazo, y ninguna pantalla muestra reservas. HU-C-22 pasa a `conReserva = true` la inscripción del alumno y HU-C-24 la del centro. Cada HU reemplaza solo la parte interina que le corresponde y lo dice en su PR.

#### 2.16.5. Estado guardado y estado mostrado de la clase

`Turno.estado` (`DISPONIBLE`/`COMPLETO`) **se sigue guardando y manteniendo** (`crearInscripcion`, `finalizarInscripcion`, `marcarVencidas` y `marcarVencidasDelAlumno` lo recalculan en la misma transacción, con la clase bloqueada). Pero el valor guardado puede quedar viejo por el vencimiento perezoso (una reserva vence a una hora exacta aunque nadie opere sobre la clase). Por eso **ninguna lectura decide con él** (HU-C-24, criterio 2):

- Las lecturas que **ofrecen o muestran** clases (opciones de «Solicitar clase», listado y detalle de 2.4, «Mis clases», calendario y servicios públicos de 2.15) filtran `estadoTurno IN ("DISPONIBLE","COMPLETO")` y deciden Disponible/Completa con `ocupacion(db, turnoId, ahora())`.
- Una clase guardada como `COMPLETO` que solo está llena por reservas vencidas se **ofrece y se muestra como Disponible**.
- El campo `estado` de las respuestas de 2.4, 2.5, 2.14 y 2.15 conserva su nombre y sus valores; lo único que cambia es de dónde sale. `PENDIENTE` y `CANCELADO` se muestran tal cual.
- **Un `PENDIENTE` nunca cambia de estado por una inscripción.** `crearInscripcion` y `finalizarInscripcion` solo recalculan `DISPONIBLE ⇄ COMPLETO` en clases ya confirmadas. La salida de `PENDIENTE` sigue siendo exclusiva de 2.2 paso 8 (y de la generación masiva, 2.9) — ver 3.1. *(Pedido al PR 0, ver Revisión 6.)*

#### 2.16.6. Qué cambia por dentro en cada operación existente

Ninguna fila de esta tabla cambia ruta, cuerpo, respuesta ni `code` de error. Las columnas «Por dentro» y «Observable» son las únicas diferencias.

| Operación | Por dentro | Observable por el cliente |
|---|---|---|
| **2.2** `PATCH /api/turnos/[id]/participantes`, paso 7 | El `deleteMany` + `createMany` de `TurnoAlumno` se reemplaza por una **reconciliación** del conjunto: (a) se leen las inscripciones vigentes del turno; (b) cada una cuyo alumno **no** está en `alumno_ids` pasa a `QUITADA_CENTRO` (con usuario y fecha); (c) para cada alumno de `alumno_ids` que no tiene inscripción vigente se llama a `crearInscripcion` (`origen = CENTRO`); (d) los que ya la tienen **no se tocan** (conservan su precio y sus pagos). Los pasos 4 y 5 (disponibilidad del alumno) consideran solo inscripciones **vigentes** (`sqlVigenteEn`). El resto no cambia: el cupo `alumno_ids.length <= cupoMaximoTurno`, el `alumno_ids` del evento y la transición son los de hoy. | Lo mismo que hoy. Condiciones nuevas: `422 MATERIA_SIN_TARIFA` si la materia no tiene tarifa (regla 3.12 de `spec_modulo_L.md`): no se crea ninguna inscripción y la clase sigue `PENDIENTE`; y, solo como resguardo desde HU-C-24, `409 INSCRIPCION_REQUIERE_PAGO` (2.18.3) |
| **2.4** listado y detalle | `alumnos_inscriptos` («3/5») y la lista `alumnos` del detalle cuentan y muestran solo inscripciones **vigentes** (2.16.3). `estado` se decide con `ocupacion` (2.16.5) | Igual que hoy mientras no haya reservas vencidas ni inscripciones finalizadas |
| **2.5** agregar, `POST /api/turnos/[id]/alumnos` | El núcleo `inscribirAlumnoEnTurno` pasa a llamar a `crearInscripcion`. Paso 1: antes de decidir `COMPLETO`/`DISPONIBLE` se llama a `marcarVencidas` y `marcarVencidasDelAlumno` (lo hace `crearInscripcion`), y se evalúa con `ocupacion`. Paso 3 (`ALUMNO_YA_ASIGNADO`): hay una inscripción **vigente** del alumno. Paso 4 (`ALUMNO_NO_DISPONIBLE`): superposición con inscripciones vigentes de otras clases, con el mismo código, el mismo literal y el mismo `{ alumno_id }`. Paso 5: la guarda de cupo cuenta vigentes (3.7). | La respuesta suma los campos opcionales `inscripcion: { id, estado_pago, vence_el, precio }`. Condiciones nuevas: `422 MATERIA_SIN_TARIFA`; y, desde HU-C-24, `409 INSCRIPCION_REQUIERE_PAGO` (2.18) |
| **2.5** quitar, `DELETE /api/turnos/[id]/alumnos/[alumnoId]` | El paso 2 ya no hace baja física: `finalizarInscripcion(QUITADA_CENTRO)` con condición atómica sobre la vigencia. Antes llama a `marcarVencidas`. El paso 3 (`COMPLETO → DISPONIBLE`) lo hace el servicio. | `404 ALUMNO_NO_ASIGNADO` cuando el alumno **no tiene inscripción vigente** (incluye la reserva que venció y se marcó justo antes). Sin otro cambio |
| **2.10** cancelar | Después de bloquear, `marcarVencidas` (las reservas ya vencidas se marcan con su vencimiento real). Las demás inscripciones vigentes **no se tocan** y dejan de vencer (HU-C-24, criterio 6). El `alumno_ids` del evento `turno:cancelado` son las vigentes | Igual |
| **2.11** reprogramar | Antes de cambiar fecha u hora, `marcarVencidas` con el vencimiento anterior (para no reactivar una reserva vencida). Después, `recalcularVencimientos`: `venceEl = min(venceBaseEl, nuevoInicio)` para las que siguen vigentes, sin aplicar el plazo configurado al momento de reprogramar (HU-C-22, criterio 2). Como el trigger regenera las reservas de los alumnos de la clase en el nuevo horario, también se llama a `marcarVencidasDelAlumno` para cada alumno de la clase (una reserva vencida sin marcar de otra clase superpuesta no puede generar un conflicto falso). El paso 4 evalúa a «cada alumno inscripto» = vigentes | Igual |
| **2.14.1** «Mis turnos» | Ver 2.17.4 | Campos nuevos por ítem; los de hoy no cambian |
| **2.14.2** «Solicitar turno» | Ver 2.17 | Respuesta con campos extra; condiciones de error nuevas |
| **2.7** búsqueda del listado (por alumno inscripto) | El filtro por la relación `alumnos` considera solo inscripciones **vigentes**: un alumno quitado o con una reserva vencida no hace aparecer la clase | Igual que hoy mientras no haya inscripciones finalizadas |
| **2.15** servicios públicos | `bloquearTurnoParaOperacion`: `alumno_ids` y `vencido` conservan su forma; los ids son los de alumnos con inscripción **vigente**. `obtenerAlumnosInscriptosDeTurno`: `string[]` de ids de alumno **vigentes**. `ajustarCuposPorCapacidadDeAula`: cuenta vigentes. `listarTurnosFuturosDeProfesorPorMateria`, `listarTurnosParaCalendario` y `promediarOcupacionTurnosPorMes`: cuentan vigentes (con `sqlVigenteEn` en las consultas crudas) y filtran el estado con `ocupacion` | **Firma y forma del resultado sin cambios** (`PR-0.md` §1.1, regla 2) |

#### 2.16.7. Errores

- **Se conservan los `code` de hoy** para todas las condiciones que ya existían: `TURNO_NO_ENCONTRADO`, `TURNO_PENDIENTE`, `TURNO_CANCELADO`, `TURNO_VENCIDO`, `CUPO_INSUFICIENTE`, `ALUMNO_NO_ENCONTRADO`, `ALUMNO_INACTIVO`, `ALUMNO_YA_ASIGNADO`, `ALUMNO_NO_DISPONIBLE` (con `{ alumno_id }`), `ALUMNO_NO_ASIGNADO`. `ErrorDeDominio` **extiende `ServiceError`** y lleva ese mismo `code` (`PR-0.md` §2.13); los Route Handlers de 2.2, 2.5 y 2.14 siguen mapeando por `error.code` **sin cambios**.
- **El texto** de esos errores sigue siendo el literal que hoy devuelve el endpoint (por ejemplo, «El alumno ya tiene un turno agendado en ese horario»). Sale de una clave del archivo central (HU-C-23) con ese mismo literal; el único cambio de texto posterior es el de HU-C-19 («turno» → «clase»), que manda el backlog.
- **Códigos nuevos** (solo para condiciones nuevas; `MATERIA_SIN_TARIFA` hace fallar un pedido que en Sprint 2 andaba, pero lo manda HU-L-06 criterio 5 y figura entre los cambios inevitables de `PR-0.md` §1.1): `422 MATERIA_SIN_TARIFA` (`PR-0.md` §2.4), `409 RESERVA_PREVIA_SIN_PAGO` (2.17), `409 INSCRIPCION_REQUIERE_PAGO` (2.18), `409 RESERVA_NO_PENDIENTE` (2.20), `404 INSCRIPCION_NO_ENCONTRADA`, `409 CANCELACION_FUERA_DE_PLAZO` y `409 INSCRIPCION_NO_VIGENTE` (2.19) y `409 CAJA_NO_ABIERTA` (`spec_modulo_I.md`).

#### 2.16.8. Pruebas obligatorias (módulo C)

1. **Los tests de Sprint 2 de 2.2, 2.5, 2.10, 2.11 y 2.14 siguen pasando.** Solo se tocan los mocks de persistencia (`prisma.turnoAlumno.*`); las aserciones de respuesta, `code` y regla se mantienen (`PR-0.md` §1.1, regla 3). Cada test que verificaba un `deleteMany` pasa a verificar el cambio de vigencia.
2. **Quitar y volver a inscribir**: quitar a un alumno deja una fila `QUITADA_CENTRO` y permite inscribirlo de nuevo (dos filas, una vigente); el índice parcial impide dos vigentes del mismo alumno en la clase.
3. **Cupo y superposición con reservas vencidas, sin que el proceso corra**: una clase llena solo por reservas vencidas admite una inscripción y se muestra Disponible; el alumno con una reserva vencida sin marcar puede inscribirse en otra clase superpuesta.
4. **Un `PENDIENTE` no cambia de estado** al crear o finalizar inscripciones; sale de `PENDIENTE` solo con 2.2 paso 8.
5. **2.2 con conjunto reemplazado**: los alumnos que se mantienen conservan su fila (mismo id, mismo precio); los que salen quedan `QUITADA_CENTRO`; los nuevos se crean.
6. **Concurrencia con PostgreSQL real**: dos inscripciones simultáneas al último lugar (una gana, la otra `CUPO_INSUFICIENTE`); una inscripción y una cancelación de la misma clase; sin interbloqueo (orden de bloqueo canónico, 3.17).
7. **Contrato**: las respuestas de 2.5 y 2.14.2 conservan los campos de Sprint 2 (`id`, `alumnos_inscriptos`, `estado`).

---

### 2.17. Resumen de la inscripción y reserva del lugar por el alumno (HU-C-20, HU-C-22) — NUEVA en Revisión 6

> **Compatibilidad.** «Solicitar turno» (2.14.2) **no se reemplaza**: se extiende. `GET /api/turnos/inscripcion/opciones` y `POST /api/turnos/[id]/inscripcion` conservan ruta, parámetros, cuerpo (sin body), campos de la respuesta y `code` de error de Sprint 2. Lo nuevo es (a) un endpoint de **solo lectura** con los datos del resumen, (b) campos adicionales en la respuesta del `POST`, (c) tres condiciones de error nuevas y (d) que la inscripción queda como **reserva con plazo** (HU-C-22). Hasta que se mergee HU-C-22 rige el comportamiento interino de 2.16.4.

**Pantalla:** el resumen es un paso nuevo de «Solicitar clase» (HU-C-12): al tocar «Inscribirme» ya no se inscribe, se abre el resumen con «Confirmar reserva» y «Volver» (HU-C-20, criterios 1 y 4). El mapa de pantallas es normativo para el diseño; esta spec fija los **datos** y las **reglas**. El resumen es la confirmación de HU-C-25 para esta operación (HU-C-25, criterio 3). Los textos literales (HU-C-20 criterios 2 y 3; HU-C-22 criterio 2) viven en el archivo central de textos (HU-C-23); esta spec solo indica qué dato va en cada hueco.

**Identidad:** igual que 2.14: el alumno sale de la sesión con `obtenerAlumnoDeUsuario(session.sub)`; nunca se acepta un `alumno_id` del cliente.

#### 2.17.1. Resumen de la clase — `GET /api/turnos/[id]/inscripcion/resumen`

**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `src/server/turnos/turno.resumen-inscripcion.service.ts` → `obtenerResumenInscripcion()` (nombre del archivo a confirmar contra el código)
**Permiso requerido:** `turnos:solicitar_propio` (rol ALUMNO)
**Solo lectura:** no bloquea ni escribe. Es informativo: la decisión la toma el `POST` (2.17.2), que revalida todo.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "turno_id": "cuid",
    "materia": { "id": "cuid", "nombre": "Física I" },
    "profesor": { "id": "cuid", "nombre_para_mostrar": "Pérez, Ana" },
    "fecha": "2026-10-13",
    "hora_inicio": "16:00",
    "hora_fin": "18:00",
    "duracion_min": 120,
    "aula": { "id": "cuid", "nombre": "Aula 2" },
    "cupo": 8,
    "lugares_disponibles": 3,
    "precio": 24000,
    "plazo_pago_horas": 24,
    "vence_pago_el": "2026-10-09T15:30:00-03:00",
    "limite_cancelacion_en_linea": "2026-10-12T16:00:00-03:00",
    "limite_cancelacion_pasado": false
  },
  "error": null
}
```

**Cómo se arma cada dato:**
- **Materia, profesor, día, horario, duración y aula** (HU-C-20 criterio 1): los de la clase. El aula **sí** se muestra acá (HU-C-20 lo pide) aunque `opciones` (2.14.2) sigue sin devolverla (HU-C-12, criterio 1). La fecha completa («Martes 13 de octubre de 2026») la arma la interfaz en la zona horaria del centro; la API devuelve `fecha` y las horas como en 2.14.
- **`lugares_disponibles`** = `cupo − ocupacion(db, turnoId, ahora())`: una reserva vencida sin marcar no ocupa lugar (2.16.5).
- **`precio`** (HU-C-20 criterio 2, HU-L-06 criterio 3): `precioClase(materia, duracion_min)` = tarifa por hora × duración / 60. La tarifa se obtiene por el servicio público de Materias (`obtenerTarifasPorIds`, `spec_modulo_L.md` §2.10), no leyendo `Materia` directo (Regla N.° 3). Es el **precio que quedará congelado** al reservar.
- **`plazo_pago_horas`** y **`vence_pago_el`** (HU-C-20 criterio 3, HU-C-22 criterio 2): el plazo vigente (`plazo_pago_horas` de `ParametroSistema`, por `parametrosVigentes()`; 24 por defecto) y `calcularVencimiento(ahora(), inicioClase, plazo).venceEl` = el menor entre *ahora + plazo* y el inicio de la clase. **Es el vencimiento si el alumno reservara en este instante**; el definitivo se informa al confirmar (P-C1).
- **`limite_cancelacion_en_linea`** (HU-C-20 criterio 3): `inicio de la clase − cancelacion_anticipacion_horas` (24 h por defecto, `parametrosVigentes()`). **`limite_cancelacion_pasado`** = ese instante ya pasó al momento de mostrar el resumen; lo calcula el servidor para que la interfaz no compare relojes. Si es `true`, la última oración del criterio 3 se reemplaza por «Si ya pagaste, ya no vas a poder cancelar en línea; comunicate con el centro.» (texto central). El límite que se muestra es informativo: al cancelar rige el valor vigente en ese momento (HU-C-14, 2.19).

**Interino (HU-C-20 antes de HU-C-22).** Hasta que se mergee HU-C-22 la inscripción queda sin plazo (2.16.4): `plazo_pago_horas` y `vence_pago_el` van `null` y la interfaz no muestra la leyenda del plazo ni la del criterio 3 (que depende del plazo y de HU-C-14, verificación diferida). El precio, los datos de la clase y los dos botones sí se muestran desde HU-C-20.

**Condiciones previas** (mismos códigos que el `POST`; todas se evalúan antes de armar la respuesta):
1. La clase existe: `404 TURNO_NO_ENCONTRADO`.
2. Está `DISPONIBLE` o `COMPLETO` (estado decidido con `ocupacion`, 2.16.5); si no (`PENDIENTE`, `CANCELADO`): `409 TURNO_NO_DISPONIBLE` (misma traducción que el `POST`, 2.14.2).
3. No empezó: `409 TURNO_VENCIDO`.
4. Hay lugar: `409 CUPO_INSUFICIENTE`.
5. El alumno está activo (`409 ALUMNO_INACTIVO`) y no tiene una inscripción vigente en la clase (`409 ALUMNO_YA_ASIGNADO`).
6. La materia tiene tarifa: si no, `422 MATERIA_SIN_TARIFA` (P-C2).

La superposición con otras clases del alumno y la regla de re-reserva (2.17.2) **no** se evalúan acá: HU-C-20 (criterio 5) y HU-C-22 (criterio 4) las ubican «al confirmar».

**Errores esperados:** `403 SIN_PERMISO` (falta `turnos:solicitar_propio` o la cuenta no tiene ficha de alumno) · `404 TURNO_NO_ENCONTRADO` · `409 TURNO_NO_DISPONIBLE` · `409 TURNO_VENCIDO` · `409 CUPO_INSUFICIENTE` · `409 ALUMNO_INACTIVO` · `409 ALUMNO_YA_ASIGNADO` · `422 MATERIA_SIN_TARIFA`.

#### 2.17.2. Confirmar la reserva — `POST /api/turnos/[id]/inscripcion` (HU-C-22)

**Contrato de Sprint 2 sin cambios:** sin body; respuesta `200 OK` con `{ id, alumnos_inscriptos, estado }`; las condiciones y los `code` de 2.14.2 se conservan, con la misma traducción a segunda persona.

**Comportamiento (dentro de la transacción de `crearInscripcion`, `origen = ALUMNO`, `conReserva = true` desde HU-C-22):**
1. **Bloqueo** en orden canónico (2.16, 3.17): al alumno, la clase y las clases donde el alumno tiene reservas vencidas sin marcar, en una sola llamada. Después `marcarVencidasDelAlumno` y `marcarVencidas` (HU-C-24, criterio 2).
2. **Validaciones de 2.14.2 pasos 1 a 3**, sin cambios: clase existente y `DISPONIBLE` (con `ocupacion`), no vencida, alumno activo, no inscripto, sin superposición con otra clase vigente del alumno, con cupo. *(HU-C-20 criterio 5: si algo cambió mientras el alumno miraba el resumen, se informa el motivo con estos mismos códigos y no se inscribe.)*
3. **Tarifa**: si la materia no tiene tarifa, `422 MATERIA_SIN_TARIFA`; no se crea nada.
4. **Regla de re-reserva (HU-C-22, criterio 4)**: si el alumno ya tuvo en esa clase una reserva que **venció** o que **canceló sin haberla pagado** (HU-C-14), responde `409 RESERVA_PREVIA_SIN_PAGO` con el mensaje «Ya tuviste una reserva sin pagar en esta clase. Para volver a inscribirte, acercate al centro y abonala en el momento.» y no inscribe. Solo puede inscribirse en el centro pagando en el momento (2.18). **No cuentan** para la regla: la cancelación de una inscripción sin reserva (`PAGO_SIN_REGISTRAR`, anterior a esta historia), las inscripciones `QUITADA_CENTRO` o `BAJA_ALUMNO`, las reservas que el alumno **había pagado** (el `estadoPago` congelado es `PAGADA`) ni una reserva **reabierta por anulación** que después venció (HU-C-24, criterio 5). La aplica `crearInscripcion` (`origen = ALUMNO`, con reserva) sobre las filas anteriores del par (alumno, clase); la misma regla está disponible como consulta en `exigeInscripcionConPago` (`PR-0.md` §2.13). El servidor la valida al confirmar, no en la interfaz.
5. **Alta de la reserva**: `crearInscripcion` guarda `vigencia = VIGENTE`, `estadoPago = RESERVADA`, `reservadaEl = inicioPlazo = ahora()`, `venceBaseEl = ahora() + plazo_pago_horas`, `venceEl = min(venceBaseEl, inicio de la clase)` y el **precio congelado** (HU-C-22 criterio 6). Un cambio posterior del plazo o de la tarifa **no** modifica una reserva ya hecha. La reserva ocupa lugar y cuenta para la superposición desde ese momento.
6. Recalcula `Turno.estado` (`DISPONIBLE → COMPLETO` si se llenó, 2.16.5) y, después del `COMMIT`, el servicio registra el historial de estados y se emite `turno:alumno_agregado` con `origen: "AUTOSERVICIO"` (+ `turno:completado` si hubo transición), como hoy.

**Respuesta `200 OK`** (campos de Sprint 2 + campos nuevos opcionales):
```json
{ "data": { "id": "cuid", "alumnos_inscriptos": "4/5", "estado": "DISPONIBLE",
            "inscripcion": { "id": "cuid", "estado_pago": "RESERVADA", "vence_el": "2026-10-09T15:31:00-03:00", "precio": 24000 } },
  "error": null }
```
La interfaz informa «Reservaste tu lugar. Acercate al centro a pagar antes del <día, fecha y hora>. Si no, la reserva se cancela sola.» (HU-C-22 criterio 2) con el `vence_el` **definitivo** de esta respuesta. Esa leyenda **reemplaza** al aviso «El pago se abona en el centro» de Sprint 2 (HU-C-12 criterio 6) desde que se mergea HU-C-22; hasta entonces, el aviso de Sprint 2 se conserva.

**Errores esperados (2.17.2):** los de 2.14.2 (`403 SIN_PERMISO`, `404 TURNO_NO_ENCONTRADO`, `409 TURNO_NO_DISPONIBLE`, `409 TURNO_VENCIDO`, `409 CUPO_INSUFICIENTE`, `409 ALUMNO_INACTIVO`, `409 ALUMNO_YA_ASIGNADO`, `409 ALUMNO_NO_DISPONIBLE`) **más** `409 RESERVA_PREVIA_SIN_PAGO` y `422 MATERIA_SIN_TARIFA`. Si el servidor rechaza al confirmar, el motivo se muestra en el mismo mensaje de confirmación y no se guarda nada (HU-C-25, criterio 6).

**Opciones (`GET /api/turnos/inscripcion/opciones`): cambios de criterio, no de contrato.** «Inscripción abierta» pasa a decidirse con `ocupacion`: clase `DISPONIBLE` **o** `COMPLETO` guardada, con inicio futuro y `lugares > 0` contando solo reservas no vencidas, y el alumno sin inscripción vigente en ella (HU-C-24, criterio 2). Una clase guardada `COMPLETO` que solo está llena por reservas vencidas se ofrece. Las clases cuya materia no tiene tarifa se siguen ofreciendo; el rechazo llega en el resumen (P-C2).

#### 2.17.3. Plazo de pago (HU-C-22, criterio 2)

- El plazo corre **desde que se hizo la reserva**, dura `plazo_pago_horas` (24 por defecto; HU-N-01 lo hace configurable) y termina **siempre antes del inicio** de la clase: vale lo que ocurra primero.
- Un cambio posterior del parámetro **no afecta** a las reservas ya hechas: `venceBaseEl` se guarda al iniciar el plazo.
- **Reprogramación (2.11):** el nuevo vencimiento es el menor entre `venceBaseEl` (momento de la reserva —o de la anulación que la reabrió, 2.18— más el plazo vigente en ese momento) y el **nuevo** inicio de la clase. Una reserva reprogramada hacia **atrás** puede vencer antes; hacia adelante recupera hasta su `venceBaseEl`, nunca más.
- La validación de toda operación que depende de una reserva se hace contra `venceEl`, no contra el estado que dejó el proceso (2.18).

#### 2.17.4. «Mis turnos» (2.14.1): estado de pago y precio (HU-C-22, criterios 4 y 6)

**Contrato de Sprint 2 sin cambios:** `GET /api/turnos/propios?vista=&pagina=`, `MisTurnosQuerySchema`, las dos pestañas, la paginación de a 10 y `totales`. Cada ítem conserva `turno_id`, `fecha`, `hora_inicio`–`hora_fin`, `materia`, `profesor`, `aula`, `estado` y `clase_dictada`. **Se agrega** a cada ítem el objeto `inscripcion`:

```json
"inscripcion": {
  "id": "cuid",
  "situacion": "RESERVADA",
  "vence_el": "2026-10-09T15:31:00-03:00",
  "precio": 24000,
  "cancelacion": "PERMITIDA"
}
```

- **`situacion`** es el estado **para mostrar** de la inscripción (no es `estado_pago` de 2.17.2: combina vigencia, estado de pago, vencimiento y estado de la clase). La calcula el servidor con `esVigenteEn` y el estado de la clase; los textos están en el archivo central):

| `situacion` | Cuándo | Texto de la interfaz (HU-C-22 criterio 4) |
|---|---|---|
| `RESERVADA` | Vigente, `estadoPago = RESERVADA`, no vencida, clase `DISPONIBLE`/`COMPLETO` que no empezó | «Reservada · pagar antes del <fecha y hora>» (usa `vence_el`) |
| `PAGADA` | Vigente con `estadoPago = PAGADA` | «Pagada» |
| `PAGO_PENDIENTE` | Vigente en `PAGO_SIN_REGISTRAR`, clase `DISPONIBLE`/`COMPLETO` que no empezó | «Pago pendiente · se abona en el centro» |
| `PAGO_SIN_REGISTRAR` | Vigente sin pago ni reserva vigente cuando la clase ya empezó o está `CANCELADO` (por ejemplo, una inscripción anterior a HU-C-22 o una cuyo último pago se anuló) | «Pago sin registrar»: estado informativo, **sin invitación a pagar ni acción de cobro** |
| `RESERVA_VENCIDA` | `RESERVA_VENCIDA`, o una reserva ya vencida que el proceso todavía no marcó | «Reserva vencida» |
| `CANCELADA_ALUMNO` | El alumno canceló (HU-C-14) | «Cancelaste tu inscripción» |
| `QUITADA_CENTRO` | Mesa de entrada la quitó | «Inscripción quitada por el centro» |
| `BAJA_ALUMNO` | Se dio de baja al alumno (HU-B-07) | «Inscripción dada de baja por el centro» |

- **`precio`**: el guardado en la inscripción (HU-C-22 criterio 6), no el de la tarifa actual. «Mis turnos» lo muestra en cada inscripción **vigente**.
- **`cancelacion`**: la calcula el servidor con la misma función que usa el `POST` de 2.19 (una sola regla): `PERMITIDA` (se ofrece «Cancelar mi inscripción»), `FUERA_DE_PLAZO` (inscripción vigente en una clase que no empezó, pero ya pasó la anticipación mínima: la acción se muestra deshabilitada con la leyenda «Ya no podés cancelar en línea. Comunicate con el centro») o `NO_APLICA` (todo lo demás: la acción no aparece).
- **Qué ítems se listan:** una tarjeta **por clase** (el alumno no ve dos tarjetas de la misma clase): la inscripción vigente si la hay y, si no, la más reciente. Las clases `PENDIENTE` no se listan (no tienen inscripciones fuera de la transacción de 2.2, 3.2). El resto de la regla de 2.14.1 (cualquier otro estado de la clase, incluido `CANCELADO`; pestañas por fecha y hora de inicio) no cambia. Los totales de las pestañas cuentan tarjetas (P-C4).
- Una clase `CANCELADO` con una reserva pendiente (las reservas de una clase cancelada dejan de vencer, 2.18.6) se muestra como clase cancelada y su `situacion` es `PAGO_SIN_REGISTRAR`: informativo, sin invitación a pagar ni acción de cobro (P-C3).

#### 2.17.5. Cómo se cumplen los criterios

| Criterio | Cómo se cumple |
|---|---|
| HU-C-20, 1 | 2.17.1: materia, profesor, día y fecha completa, inicio y fin, duración, aula y lugares disponibles |
| HU-C-20, 2 | 2.17.1: `precio` = `precioClase`; leyenda de precio fijo en el archivo central |
| HU-C-20, 3 | 2.17.1: `vence_pago_el`, `limite_cancelacion_en_linea` y `limite_cancelacion_pasado`. Verificación diferida: la regla de cancelación (2.19) y el valor configurable (HU-N-01) |
| HU-C-20, 4 | Interfaz: «Confirmar reserva» llama al `POST` (2.17.2); «Volver» regresa sin perder lo elegido |
| HU-C-20, 5 | 2.17.2 pasos 1 y 2: se revalidan cupo y superposición bajo bloqueo; el motivo se informa y no se inscribe |
| HU-C-22, 1 | 2.17.2 paso 5: inscripción `RESERVADA`, ocupa lugar y cuenta para la superposición |
| HU-C-22, 2 | 2.17.3 y 2.17.2: plazo, vencimiento, mensajes y reprogramación |
| HU-C-22, 3 | 2.16.2 (`PAGADA` ⇔ al menos un pago no anulado: `PR-0.md` §2.1 y su prueba; los pagos de una inscripción cancelada no cuentan para la nueva) y 2.16.6 (quitar no borra, deja fecha y usuario y no impide volver a inscribir). Verificación diferida: HU-I-10 |
| HU-C-22, 4 | 2.17.4 (etiquetas) y 2.17.2 paso 4 (re-reserva). Verificación diferida: HU-C-24, HU-C-14 y HU-B-07 |
| HU-C-22, 5 | 2.19: una reserva sin pagar se cancela hasta su vencimiento, sin el límite de anticipación |
| HU-C-22, 6 | 2.17.2 paso 5 (precio congelado) y 2.17.4 (`precio` en «Mis turnos») |

---

### 2.18. Vencimiento de reservas, inscripción desde el centro y reservas en el detalle de la clase (HU-C-24) — NUEVA en Revisión 6

> **Compatibilidad.** Esta sección agrega un proceso programado, validaciones de vencimiento dentro de operaciones que ya existen y dos cambios que el backlog pide expresamente sobre HU-C-04 y HU-C-18 («hasta ahora inscribían sin plazo de pago»). **No cambia ruta, cuerpo ni `code` de error de 2.2, 2.5, 2.10 ni 2.11**; las respuestas solo suman campos opcionales. Hasta que se mergee HU-C-24 la inscripción desde el centro sigue siendo `PAGO_SIN_REGISTRAR` sin plazo (2.16.4) y el vencimiento ocurre solo al operar (`marcarVencidas`).

#### 2.18.1. Vencimiento automático (criterio 1)

- **Qué hace:** una reserva sin pago (`vigencia = VIGENTE`, `estadoPago = RESERVADA`) cuya `venceEl` ya pasó se cancela: queda `RESERVA_VENCIDA`, se libera el lugar (una clase `COMPLETO` vuelve a `DISPONIBLE`) y **la inscripción no se borra**. Se registra como fecha de la vencida el **vencimiento** (`venceEl`), no el momento en que se marcó, y como actor, «Proceso automático» (`actorTipo = PROCESO_AUTOMATICO`). Se ve en el historial de clases del alumno (`spec_modulo_E.md`, HU-E-02) y en la serie «Reservas vencidas» de HU-H-10.
- **Servicio:** `src/server/turnos/reserva.vencimiento.service.ts` → `vencerReservas(momento = ahora())`. Lo implementa HU-C-24 sobre `marcarVencidas` del PR 0 (`PR-0.md` §2.2): no reimplementa la condición de vencimiento.
  1. Obtiene, con la lectura del PR 0 `clasesConReservasVencidas(db, momento)` (sin bloquear, ordenadas por id), las clases `DISPONIBLE`/`COMPLETO` con al menos una reserva vencida a `momento`. Esa lectura aplica la regla de `esVigenteEn`; el proceso no escribe la condición de vencimiento por su cuenta.
  2. Procesa **una clase por transacción** (`transaccion`): bloquea la clase con `bloquear({ clases: [id] })` y llama a `marcarVencidas(tx, id)`, que actualiza con la condición atómica `vigencia = VIGENTE AND estadoPago = RESERVADA AND venceEl <= momento` (Regla N.° 7) y recalcula `Turno.estado`. Como cada transacción toma una sola clase, el proceso no puede interbloquearse con las operaciones de los usuarios (orden canónico, 3.17).
  3. Si una clase falla, registra el error y sigue con las demás; la siguiente corrida la reintenta.
- **Idempotente:** una reserva ya vencida no se vuelve a procesar ni se cancela dos veces (la condición atómica no la alcanza).
- **No toca:** clases `CANCELADO` (en una clase cancelada las reservas dejan de vencer, criterio 6), clases `PENDIENTE`, reservas pagadas ni ningún pago.
- **Zona horaria:** todas las comparaciones usan `ahora()` y los instantes guardados; las fechas y horas que se muestran se calculan en `America/Argentina/Buenos_Aires` (`PR-0.md` §2.2).
- **Cómo se dispara:** cada 5 minutos en el entorno reproducible de demostración, que puede ser local y no requiere despliegue público (criterio 1, alineado con el PR 0). El documento de developers fija el mecanismo y cómo reproducirlo (por ejemplo, un programador local que llama al endpoint de abajo). Esta spec fija el contrato del endpoint.

**Ruta:** `POST /api/procesos/vencer-reservas` (sin body; ruta a confirmar contra el código)
**Autenticación:** **sin sesión de usuario.** Exige `Authorization: Bearer <CRON_SECRET>`, con el secreto leído de la variable de entorno `CRON_SECRET` (Regla N.° 9) y comparado en tiempo constante. Sin el secreto o con uno distinto: `401` sin ejecutar nada ni revelar por qué. **Es la única excepción documentada a la Regla N.° 10** (`PR-0.md` §2.10): la ruta no usa `withPermission`.
**Permiso:** ninguno. **Trazabilidad:** cada vencimiento queda en el historial de estados de la inscripción con el actor «Proceso automático» (Regla N.° 2). No se escribe `eventos_turno`: su columna `usuarioId` es obligatoria y el proceso no es un usuario.

**Respuesta `200 OK`:**
```json
{ "data": { "reservas_vencidas": 3, "clases_afectadas": 2, "ejecutado_el": "2026-10-09T15:35:00-03:00" }, "error": null }
```
Una corrida sin nada que vencer responde `200` con ceros.

#### 2.18.2. Validación por fecha de vencimiento (criterio 2)

Toda operación que **depende de una reserva** compara contra `venceEl`, no contra el estado que dejó el proceso. Una reserva vencida que el proceso todavía no marcó se trata como vencida:

| Operación | Dónde | Qué hace antes de decidir |
|---|---|---|
| Inscribir (alumno) | 2.14.2, 2.17.2 | `marcarVencidasDelAlumno` + `marcarVencidas` |
| Inscribir (mesa de entrada) | 2.5 agregar, 2.2 | ídem |
| Quitar a un alumno | 2.5 quitar, 2.20 | `marcarVencidas` |
| Cancelar la propia inscripción | 2.19 | `marcarVencidas` |
| Cancelar la clase | 2.10 | `marcarVencidas` (después las demás reservas dejan de vencer) |
| Reprogramar la clase | 2.11 | `marcarVencidas` con el vencimiento anterior, `marcarVencidasDelAlumno` por cada alumno de la clase y, después, `recalcularVencimientos` |
| Registrar un pago | `spec_modulo_I.md` | `marcarVencidas`; una reserva vencida no se cobra (mensaje de HU-I-10: «La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo.») |
| Desactivar al alumno | `spec_modulo_B.md` (HU-B-07) | `marcarVencidas` por cada clase |
| Registrar la clase dictada | `spec_modulo_E.md` | `marcarVencidas` |

Consecuencias: una reserva vencida **no cuenta** para el cupo, la superposición de horarios del alumno ni la unicidad de la inscripción; las clases con lugar que ofrece «Solicitar clase» y el estado Disponible/Completa que muestran todas las pantallas se deciden con `ocupacion` (2.16.5). **Se prueba con el proceso detenido.**

#### 2.18.3. Inscripción desde el centro (criterio 3)

Desde HU-C-24, `crearInscripcion(origen = CENTRO, conReserva = true)` reemplaza al comportamiento interino de 2.16.4 en 2.5 (agregar) y 2.2 (confirmar). Es un cambio de HU-C-04 y HU-C-18 que **pide el backlog**; el contrato HTTP no cambia.

- **Quedan como reserva con el mismo plazo** (2.17.3), con el **precio vigente al inscribir** (HU-L-06, criterio 4).
- **Al terminar la inscripción se ofrece «Registrar pago»**, que abre HU-I-10 con el alumno y la clase ya elegidos. La respuesta suma los campos opcionales que lo permiten:
  - 2.5 agregar: `inscripcion: { id, estado_pago: "RESERVADA", vence_el, precio }` (como en 2.17.2) y `ofrecer_pago: true`.
  - 2.2 confirmar: `inscripciones: [{ alumno_id, inscripcion_id, estado_pago, vence_el, precio }]`, una por alumno. Cuando se inscriben varios alumnos en la misma operación, la interfaz ofrece «Registrar pago» **junto a cada uno**, y cada uno abre HU-I-10 con ese alumno y esa clase; los que no se pagan en ese momento quedan como reserva.
- **Excepción (re-inscripción):** si el alumno ya tuvo en esa clase una reserva vencida o cancelada sin pago (HU-C-22, criterio 4; servicio `exigeInscripcionConPago`), **no se lo inscribe**. 2.5 agregar responde **`409 INSCRIPCION_REQUIERE_PAGO`** con `{ alumno_id }` y un texto dirigido a mesa de entrada (propuesto en P-C2; el de HU-C-22 criterio 4 está dirigido al alumno), y la interfaz ofrece «Registrar pago» con la clase marcada y el estado «Se inscribe al confirmar el pago». La inscripción se crea recién al confirmar el pago en HU-I-10 (`origen = PAGO`, ya `PAGADA`), en la misma transacción y revalidando el cupo y la superposición de horarios; si se sale del flujo sin confirmar, el alumno no queda inscripto.
  - **En 2.2 esta excepción no puede darse** (la clase es nueva y no tiene historia de inscripciones). Por seguridad, si `exigeInscripcionConPago` devolviera `true` para un alumno de `alumno_ids`, 2.2 responde el mismo `409 INSCRIPCION_REQUIERE_PAGO` con ese alumno y no confirma la clase (un alumno alcanzado por la excepción no queda inscripto junto con los demás).
- **Confirmación (HU-C-25):** inscribir desde el centro es una operación modificada en este sprint, así que antes de guardar la interfaz pide la confirmación con los datos concretos (alumno, materia, día y hora).
- **Mientras no esté HU-C-24**: inscripción sin plazo (`PAGO_SIN_REGISTRAR`), sin «Registrar pago» al terminar, como hoy.

#### 2.18.4. Reservas pendientes en el detalle de la clase (criterio 4)

`GET /api/turnos/[id]` (2.4) conserva todos sus campos. Cada elemento de `alumnos[]` suma, solo para inscripciones **vigentes** y **solo si el rol tiene `pagos:leer`** (mesa de entrada y gerente; el **Profesor no ve precios**, HU-L-06 criterio 7, así que para él se omiten ambos campos, igual que `pagos` en 2.4):

```json
{ "...": "campos de hoy", "inscripcion": { "id": "cuid", "estado_pago": "RESERVADA", "vence_el": "2026-10-09T15:31:00-03:00", "precio": 24000 }, "puede_registrar_pago": true }
```

- `inscripcion.estado_pago` ∈ `RESERVADA | PAGADA | PAGO_SIN_REGISTRAR`; `vence_el` solo si está `RESERVADA`.
- `puede_registrar_pago` es `true` solo en una clase `DISPONIBLE`/`COMPLETO` que **todavía no empezó**, para una inscripción `RESERVADA` no vencida o `PAGO_SIN_REGISTRAR`, y para quien tiene el permiso de registrar pagos (`pagos:crear`, solo mesa de entrada: el Gerente ve el detalle en modo consulta y no cobra). Es el acceso directo a «Registrar pago» (HU-I-10, criterio 9). En una clase que ya empezó o está `CANCELADO` **no se ofrece cobro** (HU-C-22, criterio 4).
- Mesa de entrada ve así qué alumnos tienen la reserva pendiente y cuándo vence. `acciones_habilitadas.registrar_pago` **conserva siempre** la condición de Sprint 2 (`spec_modulo_I.md` §2.4), que admite clases ya iniciadas. La pantalla de cobro y el atajo del detalle usan el campo nuevo `puede_registrar_pago` (clase que no empezó), no esa bandera.

#### 2.18.5. Plazo nuevo después de una anulación (criterio 5)

La ejecuta el servicio de pagos al anular un pago (`recalcularEstadoPago`, `PR-0.md` §2.13; la pantalla es HU-I-06). La regla, para quien la verifique desde este módulo:

- Si se anula el **último pago no anulado** de una inscripción que **sigue vigente**, en una clase `DISPONIBLE`/`COMPLETO` que **todavía no empezó**, la inscripción vuelve a `RESERVADA` con un plazo nuevo contado **desde la anulación** (`inicioPlazo = ahora()`, `venceBaseEl = ahora() + plazo vigente`, `venceEl = min(venceBaseEl, inicio de la clase)`) y `reabiertaPorAnulacion = true`. Si ese plazo vence, se cancela como cualquier reserva vencida.
- Si la clase ya empezó o está `CANCELADO`, la inscripción queda `PAGO_SIN_REGISTRAR` (estado informativo, sin acción de cobro); en una clase cancelada no se crea reserva.
- Si la inscripción ya no está vigente (por ejemplo, el reintegro a un alumno que canceló), no se crea ninguna reserva.
- **Una reserva reabierta que vence no cuenta** para la regla de re-reserva (2.17.2 paso 4): el alumno había pagado (decisión del PO, 05/10/2026).

#### 2.18.6. Clases canceladas por el centro (criterio 6)

El proceso (2.18.1) y la validación (2.18.2) solo vencen reservas de clases `DISPONIBLE`/`COMPLETO`. Al cancelar una clase (2.10), antes se marcan las ya vencidas; **las demás reservas dejan de vencer**, el alumno las ve como clase cancelada (2.17.4) y no cuentan como reservas vencidas (HU-C-22, criterio 4; HU-H-10, criterio 1).

#### 2.18.7. Cómo se cumplen los criterios

| Criterio | Cómo se cumple |
|---|---|
| HU-C-24, 1 | 2.18.1. Verificación diferida: HU-E-02 (historial), HU-H-10 (serie), HU-C-14 |
| HU-C-24, 2 | 2.18.2 y 2.16.5; prueba con el proceso detenido |
| HU-C-24, 3 | 2.18.3. El «Registrar pago» abre HU-I-10 (`spec_modulo_I.md`) |
| HU-C-24, 4 | 2.18.4 |
| HU-C-24, 5 | 2.18.5 (la ejecuta HU-I-06; verificación diferida) |
| HU-C-24, 6 | 2.18.6 |

---

### 2.19. Cancelar mi inscripción a una clase (HU-C-14) — NUEVA en Revisión 6

> **Compatibilidad.** Reemplaza el «Fuera de alcance» de 2.14.2 («que el alumno cancele o cambie su inscripción, Sprint 3»). Es una operación **nueva**: no modifica ninguna ruta existente. Depende de 2.16 (finalizar una inscripción sin borrarla) y de 2.17 («Mis turnos» ya trae el objeto `inscripcion`).

**Ruta:** `POST /api/turnos/[id]/inscripcion/cancelacion` (sin body; mismo patrón que 2.10, porque no borra nada: la inscripción pasa a `CANCELADA_ALUMNO`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `src/server/turnos/turno.cancelacion-propia.service.ts` → `cancelarInscripcionPropia()` (nombre del archivo a confirmar contra el código) y la función pura `evaluarCancelacion(inscripcion, turno, ahora, parametros)`, que usan también `GET /api/turnos/propios` (campo `cancelacion`, 2.17.4) y el `POST`, para que haya una sola regla.
**Permiso requerido:** `turnos:cancelar_propia` (rol ALUMNO; propuesto, P-C5)
**Identidad:** el alumno sale de la sesión (`obtenerAlumnoDeUsuario`); nunca se acepta un `alumno_id` del cliente. Si la cuenta no tiene ficha vinculada: `403 SIN_PERMISO`.

**Regla de cancelación (`evaluarCancelacion`, HU-C-14 criterios 1 y 2):**
1. Solo una inscripción **vigente** en una clase `DISPONIBLE`/`COMPLETO` que **todavía no empezó** se puede cancelar. No aplica a clases `CANCELADO` ni pasadas, ni a inscripciones ya canceladas, vencidas, dadas de baja o quitadas por el centro.
2. **Anticipación mínima:** la acción está habilitada hasta `inicio de la clase − cancelacion_anticipacion_horas` (24 h por defecto, `parametrosVigentes()`, configurable con HU-N-01; **rige el valor vigente al momento de cancelar**), inclusive. Se calcula sobre el inicio **actual** de la clase: si la clase se reprograma (2.11), el límite se recalcula solo. Pasado el límite: `cancelacion = FUERA_DE_PLAZO` y el `POST` responde `409 CANCELACION_FUERA_DE_PLAZO` («Ya no podés cancelar en línea. Comunicate con el centro»).
3. **Excepción de la reserva sin pagar (HU-C-22, criterio 5):** una inscripción `RESERVADA` (sin pago) se puede cancelar **en cualquier momento antes de su vencimiento**, sin el límite de anticipación. Una inscripción `PAGO_SIN_REGISTRAR` o `PAGADA` **sí** está sujeta al límite.

**Comportamiento (una transacción):**
1. Leer (sin bloquear) la clase (`404 TURNO_NO_ENCONTRADO`) y la inscripción **más reciente** del par (alumno, clase) para conocer qué bloquear. Si el alumno nunca estuvo inscripto en la clase: `404 INSCRIPCION_NO_ENCONTRADA`; si la más reciente ya no es vigente: `409 INSCRIPCION_NO_VIGENTE`.
2. `bloquear({ clases: [turnoId], inscripciones: [inscripcionId] })` en el orden canónico (3.17) y `marcarVencidas(tx, turnoId)`. **Se vuelve a leer la inscripción ya bloqueada** (HU-C-14, criterio 6).
3. Revalidar con la inscripción bloqueada: la clase no está `CANCELADO` (`409 TURNO_CANCELADO`) ni vencida (`409 TURNO_VENCIDO`); la inscripción sigue vigente (`409 INSCRIPCION_NO_VIGENTE`, incluye la reserva que venció mientras tanto); y se cumple `evaluarCancelacion`. **Si mientras el alumno confirmaba se registró un pago, deja de regir la excepción de la reserva sin pagar y se aplica la anticipación mínima** (criterio 6): como la inscripción se evalúa bloqueada, su `estadoPago` ya es `PAGADA`.
4. `finalizarInscripcion(tx, { inscripcionId, vigencia: CANCELADA_ALUMNO, actor: usuario })`, con condición atómica sobre la vigencia. **La inscripción no se borra**: queda con fecha y hora para el historial (HU-E-02). Se libera el lugar y deja de contar para la superposición de horarios; si la clase estaba `COMPLETO`, vuelve a `DISPONIBLE` (lo recalcula el servicio, 2.16.5). **La clase no se cancela**: sigue vigente para el resto de los alumnos.
5. **Pagos:** no se modifican ni se reintegran desde el sistema (criterio 7). Si la inscripción estaba `PAGADA`, la respuesta lo indica (`con_pagos: true`) y la interfaz informa «Si abonaste esta clase, consultá en el centro por el reintegro». Si el centro devuelve el dinero, lo registra anulando el pago con el motivo «Reintegro» (HU-I-06, criterio 6; verificación diferida): como la inscripción ya no es vigente, esa anulación no crea ninguna reserva (2.18.5).
6. Después del `COMMIT`: historial de estados de la inscripción (lo escribe el servicio) y el evento `turno:inscripcion_cancelada` (§4), más `turno:disponible_nuevamente` si hubo transición.

**Confirmación (HU-C-25):** antes de llamar, la interfaz pide «¿Estás seguro de que querés cancelar tu inscripción a <Materia> del <fecha> a las <hora>? Esta acción no se puede deshacer.» (HU-C-14, criterio 3). Si al confirmar el servidor rechaza, el motivo se muestra en el mismo mensaje.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "inscripcion_id": "cuid", "vigencia": "CANCELADA_ALUMNO", "con_pagos": false, "alumnos_inscriptos": "3/5", "estado": "DISPONIBLE" }, "error": null }
```
La interfaz informa «Cancelaste tu inscripción».

**Después de cancelar (criterio 5):** la clase sigue apareciendo en «Mis turnos» con la etiqueta «Cancelaste tu inscripción» (`situacion = CANCELADA_ALUMNO`, 2.17.4), y el alumno puede volver a inscribirse desde «Solicitar clase» si hay cupo. **Si lo que canceló era una reserva sin pagar** (`estadoPago = RESERVADA`, `reabiertaPorAnulacion = false`), solo puede volver a inscribirse en el centro pagando en el momento (regla de re-reserva, 2.17.2 paso 4); si canceló una inscripción `PAGO_SIN_REGISTRAR`, una ya pagada o una reserva reabierta por anulación (P-C8), puede volver a reservar en línea.

**Errores esperados:**
- `403 SIN_PERMISO` — falta `turnos:cancelar_propia` o la cuenta no tiene ficha de alumno.
- `404 TURNO_NO_ENCONTRADO` — la clase no existe.
- `404 INSCRIPCION_NO_ENCONTRADA` — el alumno nunca estuvo inscripto en la clase.
- `409 INSCRIPCION_NO_VIGENTE` — la inscripción ya no está vigente (cancelada, vencida, dada de baja o quitada).
- `409 TURNO_CANCELADO` — la clase fue cancelada por el centro.
- `409 TURNO_VENCIDO` — la clase ya empezó.
- `409 CANCELACION_FUERA_DE_PLAZO` — pasó la anticipación mínima y la inscripción no es una reserva sin pagar.

**Cómo se cumplen los criterios:**
| Criterio | Cómo se cumple |
|---|---|
| HU-C-14, 1 | Campo `cancelacion` de «Mis turnos» (2.17.4): `PERMITIDA` solo para inscripciones vigentes en clases `DISPONIBLE`/`COMPLETO` que no empezaron |
| HU-C-14, 2 | `evaluarCancelacion` (reglas 1 a 3); `FUERA_DE_PLAZO` deshabilitada con la leyenda. Verificación diferida: valor configurable (HU-N-01) |
| HU-C-14, 3 | Confirmación de HU-C-25 |
| HU-C-14, 4 | Pasos 3 y 4. Verificación diferida: historial (HU-E-02) |
| HU-C-14, 5 | «Después de cancelar» y 2.17.4 |
| HU-C-14, 6 | Pasos 2 y 3: revalidación con la inscripción bloqueada |
| HU-C-14, 7 | Paso 5. Verificación diferida: reintegro (HU-I-06) |

---

### 2.20. Reservas pendientes de todas las clases (HU-C-26) — NUEVA en Revisión 6

> **Compatibilidad.** Pantalla y rutas **nuevas**, solo para mesa de entrada. No toca ningún endpoint existente. «Quitar» no reutiliza `DELETE .../alumnos/[alumnoId]` (2.5), que quita cualquier inscripción vigente sin condición, sino una ruta propia con la condición atómica «sigue siendo una reserva pendiente» (criterio 6).

**Pantalla:** «Reservas» en el menú de mesa de entrada (criterio 1). **Permiso de lectura:** `reservas:leer` (solo `MESA_ENTRADA`; lo crea el PR 0 en migración y seed, `PR-0.md` §2.9). El servidor rechaza con `403 SIN_PERMISO` a cualquier otro rol (criterio 8).
**Lecturas:** una sola vía, las funciones públicas de módulo C del PR 0 (`PR-0.md` §2.13): `listarReservasPendientes`, `listarReservasVencidas` y `resumenReservas`. Esta spec no reimplementa la vigencia (criterio 8).

#### 2.20.1. Totales

`GET /api/reservas/resumen` → `resumenReservas()`:
```json
{ "data": { "pendientes": { "cantidad": 12, "importe_total": 288000 }, "vencen_en_3_horas": 2, "vencen_hoy": 5, "vencieron_hoy": 1 }, "error": null }
```
- `pendientes`: reservas `RESERVADA` de clases `DISPONIBLE`/`COMPLETO` cuyo vencimiento no pasó, y la suma de sus `precio` guardados.
- `vencen_en_3_horas`: de esas, las que vencen dentro de los próximos 180 minutos (mismo corte que `vence_pronto`, 2.20.2). `vencen_hoy`: las que vencen antes del fin del día del centro (`finDelDiaCentro`).
- `vencieron_hoy`: reservas cuyo `venceEl` cayó entre el inicio del día del centro y ahora, **marcadas o no** por el proceso. El pie de la pantalla (criterio 7) usa este mismo número y aclara que el proceso automático revisa cada 5 minutos. No hace falta una tabla de corridas: el dato sale de las inscripciones.

#### 2.20.2. Pestaña «Pendientes»

`GET /api/reservas/pendientes?alumno=&materia_id=&vencen=&pagina=`

```typescript
export const ReservasPendientesQuerySchema = z.object({
  alumno: z.string().trim().max(100).optional(),                     // nombre, apellido o DNI; desde 2 caracteres (criterio de HU-B-05)
  materia_id: z.string().cuid().optional(),
  vencen: z.enum(["en_3_horas", "hoy", "manana"]).optional(),        // criterio 4
  pagina: z.coerce.number().int().positive().default(1),
}).strict();                                                        // de a 10, fijo (criterio 2)
```

Ítem (criterio 2):
```json
{
  "inscripcion_id": "cuid",
  "vence_el": "2026-10-09T15:31:00-03:00",
  "faltan_min": 45,
  "vence_pronto": true,
  "alumno": { "id": "cuid", "nombre_para_mostrar": "Ruiz, Jorge", "dni": "30111222", "reservas_pendientes": 2 },
  "clase": { "turno_id": "cuid", "fecha": "2026-10-13", "hora_inicio": "16:00", "hora_fin": "18:00", "materia": { "id": "cuid", "nombre": "Física I" }, "aula": { "id": "cuid", "nombre": "Aula 2" } },
  "profesor": { "id": "cuid", "nombre_para_mostrar": "Pérez, Ana" },
  "precio": 24000
}
```
- Orden por `vence_el` ascendente, con el id de la inscripción como desempate. Paginación de a 10 con el mismo formato `paginacion` de 2.14.1.
- `faltan_min` lo calcula el servidor (la interfaz arma «en 45 min» / «en 3 h»); `vence_pronto` es `true` si faltan 180 minutos o menos (la interfaz lo muestra en rojo, con texto además del color).
- **Las reservas cuyo vencimiento ya pasó no se listan**, aunque el proceso no las haya marcado (criterio 2); tampoco las de clases `CANCELADO`.
- `alumno.reservas_pendientes`: cuántas reservas pendientes tiene ese alumno (sobre el conjunto sin filtrar).
- **Filtros** (criterio 4): se combinan, vuelven a la página 1 y se actualizan sin recargar. El filtro `alumno` usa el mismo umbral y la misma normalización que HU-B-05 (`spec_modulo_B.md` §2.7, `construirFiltroBusquedaAlumno`); ver P-C6 sobre cómo lo expone Alumnos. «Limpiar filtros» omite todos los parámetros.

#### 2.20.3. Pestaña «Vencidas · últimos 7 días»

`GET /api/reservas/vencidas?alumno=&materia_id=&pagina=` — solo consulta (criterio 3).

Ítem:
```json
{ "inscripcion_id": "cuid", "vencio_el": "2026-10-09T09:00:00-03:00", "sin_marcar": false,
  "alumno": { "id": "cuid", "nombre_para_mostrar": "Ruiz, Jorge", "dni": "30111222" },
  "clase": { "turno_id": "cuid", "fecha": "2026-10-09", "hora_inicio": "16:00", "hora_fin": "18:00", "materia": { "id": "cuid", "nombre": "Física I" } },
  "precio": 24000 }
```
- Reservas vencidas en los últimos 7 días (días del centro), de la más reciente a la más antigua por `vencio_el`. Incluye las `RESERVA_VENCIDA` y las **vencidas que el proceso todavía no marcó** (`sin_marcar = true`, etiqueta «Vencida · sin marcar todavía»). En una clase `CANCELADO` no vence nada (2.18.6): sus reservas pendientes no se listan acá.

#### 2.20.4. Acciones por fila

- **«Registrar pago»** (criterio 5): sin endpoint propio. Si el alumno tiene **una sola** reserva pendiente, abre el registro de pago de esa clase (atajo de HU-I-10, criterio 9); si tiene varias, abre HU-I-10 con el alumno elegido y esa clase marcada, para pagar varias en una operación. **Exige caja abierta** del usuario (HU-I-12, criterio 2): si no la tiene, la pantalla de pago responde `409 CAJA_NO_ABIERTA` (`spec_modulo_I.md`). La lista da `alumno.id`, `clase.turno_id` y `alumno.reservas_pendientes` para decidir el atajo.
- **«Quitar»** (criterio 6): `POST /api/reservas/[inscripcionId]/quitar` (sin body).
  **Permiso:** `turnos:asignar_participantes` (mesa de entrada, el mismo que quitar un alumno en 2.5). **Servicio:** `quitarReservaPendiente()`.
  1. `bloquear({ clases: [turnoId], inscripciones: [inscripcionId] })` y `marcarVencidas(tx, turnoId)`.
  2. `finalizarInscripcion(tx, { inscripcionId, vigencia: QUITADA_CENTRO, actor: usuario, soloSiReservaPendiente: true })`. Si mientras tanto la reserva se **pagó o venció**, no se quita y responde **`409 RESERVA_NO_PENDIENTE`** con «Esta reserva ya no está pendiente: se pagó o venció.».
  3. La inscripción queda `QUITADA_CENTRO` con fecha y usuario, se libera el lugar (`COMPLETO → DISPONIBLE` si corresponde) y **no impide volver a inscribir** al alumno. Después del `COMMIT`: historial de estados y `turno:alumno_quitado` (§4).
  - Respuesta `200 OK`: `{ "data": { "inscripcion_id": "cuid", "vigencia": "QUITADA_CENTRO", "alumnos_inscriptos": "3/5", "estado": "DISPONIBLE" }, "error": null }`.
  - Confirmación de HU-C-25 en la interfaz («¿Estás seguro de que querés quitar a <Alumno> de <Materia> del <fecha> a las <hora>? Esta acción no se puede deshacer.»).

**Errores esperados (2.20):** `400 VALIDATION_ERROR` (parámetros inválidos o adicionales) · `403 SIN_PERMISO` (falta `reservas:leer`, o `turnos:asignar_participantes` en «Quitar») · `404 INSCRIPCION_NO_ENCONTRADA` (en «Quitar») · `409 RESERVA_NO_PENDIENTE` (en «Quitar»).

#### 2.20.5. Cómo se cumplen los criterios

| Criterio | Cómo se cumple |
|---|---|
| HU-C-26, 1 | 2.20.1 (cuatro totales y el importe a cobrar) |
| HU-C-26, 2 | 2.20.2 |
| HU-C-26, 3 | 2.20.3 |
| HU-C-26, 4 | 2.20.2 (filtros y paginación) |
| HU-C-26, 5 | 2.20.4 «Registrar pago» |
| HU-C-26, 6 | 2.20.4 «Quitar» |
| HU-C-26, 7 | 2.20.1 (`vencieron_hoy`) |
| HU-C-26, 8 | `reservas:leer` solo `MESA_ENTRADA`, 403 al resto; lecturas del PR 0 |


---

### 2.21. Funciones y cambios internos que piden las bajas de alumno y de profesor (HU-B-07, HU-D-08) — NUEVA (nota posterior a la Revisión 6, 08/10/2026)

**Origen.** `spec_modulo_B.md` (2.13) y `spec_modulo_D.md` (2.13.3) piden a este módulo funciones nuevas y un cambio interno. Esta sección es la **contraparte** de C: fija los contratos que C debe publicar. Todo es **aditivo**: ninguna ruta, función ni `code` de error de las secciones 2.1 a 2.20 cambia de firma ni de resultado, y los tests de Sprint 1 y 2 siguen pasando sin tocarse. Cada HU agrega lo suyo **dentro de su propio PR** (`PR-0.md` §2.13: la HU agrega a la fachada del dueño la lectura que le falta).

#### 2.21.1. Para HU-B-07 (baja de alumno)

| Función (fachada de C) | Contrato |
|---|---|
| `darDeBajaInscripcionesDeAlumno(tx, { alumnoId, actor })` | `{ quitadas: { inscripcion_id, turno_id }[], reservas_vencidas_marcadas: number }`. El llamador **ya tiene bloqueada la ficha del alumno**. C toma, en **una sola** llamada a `bloquear`, las clases candidatas por id ascendente y sus inscripciones. Las clases candidatas se leen antes de bloquear y se revalidan ya bloqueadas: solo se procesan las `DISPONIBLE` o `COMPLETO` con inicio posterior a `ahora()`. Marca primero con `marcarVencidasDelAlumno` las reservas vencidas (no son bajas); después finaliza con `finalizarInscripcion(vigencia: "BAJA_ALUMNO", actor)` cada inscripción que sigue `VIGENTE`, con condición atómica, y recalcula el estado de cada clase (`COMPLETO → DISPONIBLE`). No toca clases pasadas o en curso, `PENDIENTE` ni `CANCELADO`, ni pagos. Idempotente |
| `alumnoTieneRegistros(alumnoId, db?)` | `boolean`, solo lectura: el alumno tiene alguna inscripción —en cualquier vigencia— en una clase cuyo inicio ya pasó (`≤ ahora()`) |
| `listarInscripcionesDeAlumno(alumnoId, { desde?, hasta? }, db?)` | **Ya prevista** (`PR-0.md` §2.13; `spec_modulo_E.md` R2-PR0-3). No es nueva |

#### 2.21.2. Para HU-D-08 (baja de profesor)

Siete funciones. Su contrato completo (parámetros, resultado y errores) es el de `spec_modulo_D.md` 2.13.3, que es la fuente; acá se fijan las obligaciones de C.

| Función | Resumen |
|---|---|
| `contarTurnosFuturosDeProfesor(profesorId, db?)` | `{ confirmados, pendientes }` de todas las materias; mismo criterio estricto de «futuro» (`>`) que `contarTurnosFuturosDeProfesorPorMateria` (2.15) |
| `listarTurnosFuturosDeProfesor(profesorId, { materiaId?, pagina, porPagina }, db?)` | Página de clases futuras `DISPONIBLE` o `COMPLETO`, con las materias y su cantidad **sin** el filtro y una `seleccion` (hasta 500) que sí lo aplica. Cuenta inscriptos con el servicio único de 2.16.3 |
| `obtenerTurnosBasicos(turnoIds, db?)` | `{ turno_id, materia_id, profesor_id, estado, fecha, hora_inicio, hora_fin }[]`, solo lectura |
| `profesorTieneClasesPasadas(profesorId, db?)` | `boolean`: alguna clase que no sea `PENDIENTE` con inicio `≤ ahora()`, cancelada o no |
| `evaluarCambioDeProfesor(profesorDestinoId, turnoIds, db?)` | Por clase: `SE_PUEDE`, `FUERA_DE_HORARIO`, `OCUPADO` o `NO_DISPONIBLE`. Solo lectura |
| `cancelarTurnoPorBajaDeProfesor(tx, { turnoId, profesorId, actor })` | El **mismo núcleo que 2.10** (`cancelarTurno`), sin comprobar `turnos:cancelar` (lo comprueba la ruta de D con `profesores:cambiar_estado` y `gerentePuedeGestionarClaseDeBaja`). Una sola llamada a `bloquear` con el profesor y la clase. Las inscripciones y los pagos no se tocan; las reservas sin pagar dejan de vencer (2.18.6) |
| `cambiarProfesorDeTurno(tx, { turnoId, profesorOrigenId, profesorDestinoId, actor })` | **Operación nueva**: hoy C no cambia el profesor de una clase `DISPONIBLE` o `COMPLETO` (2.1 solo modifica `PENDIENTE`; 2.11 no admite profesor). Una sola llamada a `bloquear` con los dos profesores (por id ascendente) y la clase. Revalida estado, vigencia, destino activo, que dicte la materia, horario de atención y ausencia de superposición; actualiza `profesorId` con condición atómica. El trigger `turno_sincronizar_reservas` ya escucha `UPDATE OF "profesorId"` (2.11, «Relevado»), así que mueve la reserva del profesor sin migración. No toca inscripciones, pagos, aula, fecha, hora ni estado. Errores: `TURNO_NO_ENCONTRADO`, `TURNO_CANCELADO`, `TURNO_PENDIENTE`, `TURNO_VENCIDO`, `TURNO_MODIFICADO`, `PROFESOR_INACTIVO`, `PROFESOR_NO_DICTA_MATERIA`, `PROFESOR_FUERA_DE_HORARIO`, `PROFESOR_OCUPADO` (incluida la violación de la exclusión GiST traducida con `turno.reserva-error.ts`) |

**Dónde viven (a confirmar contra el código).** `cambiarProfesorDeTurno` y `evaluarCambioDeProfesor` necesitan funciones de D. Se implementan en un archivo de servicio nuevo de C (por ejemplo `turno.baja-profesor.service.ts`, que puede importar la fachada de D, como ya hace `turno.service.ts`) y `turno.publico.ts` las **reexporta** sin importar a D (2.15 pide que no importe otros módulos). Si `publico.aislamiento.test.ts` no admite el reexporte, C usa una segunda fachada propia para estas siete. D nunca importa archivos internos de C.

#### 2.21.3. El bloqueo del profesor y la relectura del alumno en las operaciones que ya existen

Se suman a 3.17, sin cambiar rutas, cuerpos, firmas ni códigos:
- **Profesor (HU-D-08, criterio 2, última viñeta).** Las operaciones que dejan una clase `DISPONIBLE` o `COMPLETO` con un profesor —confirmar una `PENDIENTE` (2.2), la generación masiva (2.9 y 2.9.1) y la reprogramación (2.11)— agregan **al profesor** a la lista `recursos` de **su** llamada única a `bloquear` (nivel 1 del orden, junto con el aula y la materia, por id ascendente) y, ya bloqueado, **vuelven a leer** `obtenerOpcionProfesorActivo(profesorId, tx)`. Si no está activo, rechazan con el `code` que cada operación usa hoy para un profesor inactivo. La alta de una `PENDIENTE` (2.1) no reserva recursos (3.2) y no lo necesita.
- **Alumno (HU-B-07, R3-PR0-B3).** Toda operación que inscribe (2.2, 2.5, 2.14.2/2.17.2, 2.18.3 y la inscripción de HU-I-10) llama a `verificarAlumnoActivo(alumnoId, tx)` **después** de bloquear al alumno, **también** cuando el llamador trae un `alumnoActivo` leído antes (autoservicio): ese valor solo sirve para responder rápido, la decisión es la posterior. Conserva `ALUMNO_NO_ENCONTRADO` y `ALUMNO_INACTIVO`. Es la única forma de que una inscripción y una baja simultáneas no puedan confirmarse las dos.

#### 2.21.4. Eventos

`turno:cancelado` conserva su payload y suma el campo **opcional** `origen` (`"BAJA_PROFESOR"` cuando viene de `cancelarTurnoPorBajaDeProfesor`); los consumidores que no lo conocen lo ignoran. Se suma `turno:profesor_cambiado` con payload `{ turno_id, profesor_anterior_id, profesor_nuevo_id, usuario_id }`, que se escribe con `emitirEventoTurno` **después del commit de esa clase** (opción (b)). Si `tipoEvento` de `eventos_turno` es un enum, el PR 0 lo amplía con una migración aditiva (R3-PR0-D8). La finalización de una inscripción por la baja de un alumno deja su transición en el historial de la inscripción (2.16.1).

#### 2.21.5. Pruebas obligatorias de esta sección

1. Las de Sprint 1 y 2 de 2.1 a 2.20 pasan sin tocarse; `ALUMNO_INACTIVO` y los `code` de profesor se conservan.
2. `darDeBajaInscripcionesDeAlumno`: solo clases futuras `DISPONIBLE` o `COMPLETO`; `COMPLETO → DISPONIBLE`; reserva vencida marcada y no contada como baja (borde `venceEl = ahora`); idempotente; ignora clases pasadas, en curso, `PENDIENTE` y `CANCELADO`.
3. `cambiarProfesorDeTurno`: mueve la reserva del profesor (PostgreSQL real), no toca inscripciones, pagos, aula, fecha ni hora; destino ocupado, fuera de horario, inactivo o que no dicta la materia rechazan sin escribir; una clase que cambió de profesor o de estado entre la lectura y el bloqueo responde `TURNO_MODIFICADO`.
4. `cancelarTurnoPorBajaDeProfesor` deja el mismo resultado que 2.10 (aula, profesor y alumnos liberados; inscripciones y pagos intactos) y no exige `turnos:cancelar`.
5. Concurrencia: una clase nueva (2.2, 2.9, 2.11) contra la baja del profesor, y una inscripción contra la baja del alumno: nunca quedan las dos; el orden de bloqueo no genera interbloqueo.
6. `contarTurnosFuturosDeProfesor` coincide con la suma de `contarTurnosFuturosDeProfesorPorMateria` de sus materias.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/turnos/` (`turno.service.ts` y los colaboradores por área). Route Handlers y Server Actions son capa delgada (Regla N.° 4 de `docs/RULES.md`). Reparto por área: `turno.service.ts` (2.1, 2.2, 2.4, 2.5, 2.7, 2.12 y el autoservicio 2.14, que reutiliza el núcleo de 2.5), `turno.aula.service.ts` (2.3), `turno.profesor.service.ts` (2.6, 2.8), `turno.generacion.service.ts` (2.9), `turno.cancelacion.service.ts` (2.10), `turno.reprogramacion.service.ts` (2.11) y `turno.publico.ts` (2.15), con `turno.disponibilidad.ts`, `turno.validaciones.ts` y `turno.schema.ts` como colaboradores compartidos.

### 3.1. Máquina de cuatro estados

> **Revisión 6.** Complemento en 3.16: las operaciones de inscripción nunca sacan a un turno de `PENDIENTE` ni de `CANCELADO`. Un lugar también se libera por vencimiento de una reserva (2.18), cancelación propia (2.19) y «Quitar» de las reservas pendientes (2.20), además de 2.5.

`PENDIENTE → {DISPONIBLE, COMPLETO}` (2.2) es la transición de confirmación, sin reversión. Desde la Revisión 5 `PENDIENTE` tiene además una salida (`→ CANCELADO`, descarte, N-1 en 2.10) y hay un solo camino que crea un turno ya `DISPONIBLE`, sin pasar por `PENDIENTE` (generación masiva, 2.9, R5-9). `DISPONIBLE | COMPLETO → CANCELADO` (2.10) es manual y terminal (3.9). `DISPONIBLE ⇄ COMPLETO` sí es reversible y automático, gobernado exclusivamente por la comparación entre la cantidad de alumnos inscriptos y `cupoMaximoTurno` (2.5). Ningún endpoint permite fijar `COMPLETO` o `DISPONIBLE` manualmente.

### 3.2. Un turno `PENDIENTE` nunca reserva recursos
Toda consulta de disponibilidad (2.1 paso 5b, 2.2 paso 5, 2.3 paso 2, 2.5 paso 4, 2.6 paso 3, 2.8.2 paso 4, 2.9 paso 5 y 2.11 paso 4) filtra explícitamente `estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }`. Esta regla también rige fuera del módulo: `src/server/calendario/calendario.service.ts` filtra por el mismo criterio para no mostrar turnos pendientes (migrado en HU-C-03, verificado con curl + test del filtro).

### 3.3. Fórmula de superposición reutilizada, no reimplementada
Sin cambios respecto a Revisión 1: intervalos semiabiertos (`a1 < b2 AND b1 < a2`), definida en `spec_modulo_D.md` §3.4, ya implementada en `intervalosSeSuperponen()`. **Nota Revisión 4:** esta fórmula nunca asumió una duración fija — opera sobre los dos extremos del intervalo, cualquiera sea su ancho. No requiere cambios para soportar duración variable.

### 3.4. Defensa de concurrencia: tabla `reservas_turno` + exclusión GiST unificada (extensión `btree_gist`) — DISEÑO REAL, RATIFICADO (D8), sin cambios de diseño en Revisión 4

> **Revisión 6.** El diseño de la exclusión no cambia. Los triggers pasan a proyectar solo las inscripciones `VIGENTE` y a reaccionar al cambio de vigencia (`PR-0.md` §2.0), porque la inscripción ya no se borra (3.14).


**Reemplaza por completo el diseño propuesto en Revisión 2** (constraints `EXCLUDE` directos sobre `turnos`, nunca migrados, que además no podían cubrir el caso de alumno). Implementado como parte de HU-C-15, auditado y ratificado por el Scrum Master el 24/09.

En vez de poner la exclusión sobre `turnos`, se usa una tabla de reservas unificada: un registro por cada recurso reservado (profesor, aula, alumno) por turno, con el rango horario del turno desnormalizado en cada fila, mantenida automáticamente por triggers al confirmar el turno (2.2) o al insertarlo directamente como `DISPONIBLE` (generación masiva, 2.9 y 3.12). Una única exclusión GiST sobre esa tabla cubre los tres tipos de recurso — evita necesitar tres mecanismos distintos (uno de los cuales, el de alumno, la Revisión 2 dejaba sin resolver porque un `EXCLUDE` no puede hacer join contra la tabla intermedia `TurnoAlumno`).

```
Migración: 20260924150000_turnos_reservas_recursos_v2 (origin/develop)

Forma conceptual (detalle técnico completo de columnas/triggers reales:
ver docs/tasks/Sprint 1/HU-C-15.md §3.5, relevado contra el código real):

reservas_turno
  - turno_id       (FK a turnos)
  - tipo_recurso   ('PROFESOR' | 'AULA' | 'ALUMNO')
  - recurso_id     (id del profesor, aula o alumno reservado)
  - rango_horario  (tsrange, desnormalizado desde el turno)

  EXCLUDE USING gist (
    tipo_recurso WITH =,
    recurso_id WITH =,
    rango_horario WITH &&
  )
```

Las filas de `reservas_turno` se crean cuando el turno confirma (2.2, transición a `Disponible`/`Completo`) o cuando se inserta ya `DISPONIBLE` (2.9, ver 3.12) — un turno `PENDIENTE` no tiene reservas, lo que sostiene a nivel de motor la regla de negocio 3.2 ("un turno `PENDIENTE` nunca reserva recursos"), sin necesitar una cláusula `WHERE` sobre el estado del turno como proponía el diseño anterior.

**Esto es, a partir de esta revisión, la defensa atómica final real** — ya no una validación exclusivamente aplicativa. La validación de 2.2 paso 5 sigue existiendo como verificación de buena fe antes de intentar confirmar (para dar un mensaje de error claro), pero el `INSERT` a `reservas_turno` dentro de la misma transacción es lo que efectivamente impide, a nivel de base, que dos turnos terminen confirmados con el mismo recurso en el mismo horario.

**Nota Revisión 4 — CONFIRMADO:** el rango horario se desnormaliza *desde el turno*, no desde una constante. Se releyó el trigger real (`HU-C-03.md` §10.1, punto 3): `sincronizar_reservas_turno()` y `sincronizar_reserva_alumno()` calculan `inicio := "fechaTurno" + "horaInicioTurno"` y `fin := inicio + "duracionMinutosTurno" * interval '1 minute'`, y el trigger sobre `turnos` se dispara también con `UPDATE OF "duracionMinutosTurno"`. El mecanismo soporta turnos de distinta duración por construcción: **no se tocó la migración `20260924150000_turnos_reservas_recursos_v2`**. Verificado además en Postgres real (`turno.reservas.pg.test.ts`, caso Revisión 4): la reserva de un turno de 2h cubre 10:00–12:00, rechaza un turno superpuesto a las 11:00 y acepta uno contiguo a las 12:00.

**Nota de sincronización (relevamiento Revisión 4) — nombres reales de columnas:** la forma conceptual de arriba no coincide con los nombres reales de `reservas_turno`. Correspondencia:

| Forma conceptual (arriba) | Columna real |
|---|---|
| `turno_id` | `"turnoId"` (FK a `turnos`, `ON DELETE CASCADE`) |
| `tipo_recurso` | `"tipoRecurso"` (`CHECK` en `'AULA'`, `'PROFESOR'` o `'ALUMNO'`) |
| `recurso_id` | `"recursoId"` |
| `rango_horario` (tsrange) | **no existe como columna:** hay dos columnas `"inicioReserva"` / `"finReserva"` (`timestamp(6)`, `CHECK "inicioReserva" < "finReserva"`), y el rango se arma en la exclusión como `tsrange("inicioReserva", "finReserva", '[)')` |

Exclusión real: `reservas_turno_sin_solapamiento EXCLUDE USING gist ("tipoRecurso" WITH =, "recursoId" WITH =, tsrange("inicioReserva", "finReserva", '[)') WITH &&)`. PK: `("turnoId", "tipoRecurso", "recursoId")`. Solo corrección de documentación, sin cambio de código.

### 3.5. Guard de vigencia reutilizado
Sin cambios — ver sección 2, "Convenciones generales".

### 3.6. Transacción única para "confirmar participantes + intentar transicionar"
**Revisión 3:** la transacción que evalúa la transición ya no vive en 2.3 (asignar aula) — se movió a 2.2 (asignar profesor y alumnos), que es ahora el último paso. `asignarParticipantesTurno()` sigue resolviéndose en una única `prisma.$transaction`, y el resultado de la transición puede ser `DISPONIBLE` o `COMPLETO`. A diferencia de Revisión 2, esta transacción ya no es la única barrera contra una condición de carrera: la defensa de motor de 3.4 (`reservas_turno` + GiST) está implementada y ratificada.

### 3.7. Guarda de concurrencia para el cupo

> **Revisión 6.** El patrón se conserva; el bloqueo se toma con `bloquear` en el orden canónico (3.17) y el conteo es de inscripciones **vigentes** con `ocupacion` (3.15).

Dos casos distintos, con soluciones distintas:

- **Alta/baja individual de alumno (2.5, HU-C-04):** la condición de cupo depende de un **conteo sobre una tabla relacionada** (`TurnoAlumno`), que un `updateMany` simple no puede expresar de forma atómica. Patrón obligatorio: (1) dentro de la transacción, bloquear la fila del turno con `SELECT "idTurno", "cupoMaximoTurno" FROM turnos WHERE "idTurno" = $1 FOR UPDATE` (vía `tx.$queryRaw`); (2) recién con la fila bloqueada, contar `TurnoAlumno` del turno; (3) comparar contra `cupoMaximoTurno` e insertar/rechazar. El `FOR UPDATE` serializa dos altas concurrentes sobre el mismo turno.
- **Modificación de `cupo_maximo` en un turno `PENDIENTE` (2.1, HU-C-03, código `CUPO_MENOR_A_INSCRIPTOS`):** **Revisión 3 — este caso queda sin uso.** El cupo ya no se modifica desde 2.1; solo cambia al reasignar aula (2.3), que tiene su propia validación de capacidad (paso 3 de esa sección, código `AULA_CAPACIDAD_INSUFICIENTE`). El patrón de optimistic locking (`updatedAtTurno`) descripto acá para este caso queda documentado como histórico, no se elimina de la base de conocimiento del proyecto pero no aplica a partir de esta revisión.

---

### 3.8. Turnos vencidos: qué se puede y qué no (Revisión 5, R5-6)

> **Revisión 6.** `POST /api/pagos` conserva **siempre** el comportamiento de Sprint 2, y la salvedad «sí admiten registrar un pago» de R5-6 sigue valiendo para ese endpoint (T3 y P-C7 de la Revisión 6). El flujo de cobro de HU-I-10 (`POST /api/pagos/operaciones`) sí rechaza el pago de una clase ya iniciada (HU-C-22 criterio 4; HU-I-10 criterios 3 y 7). Las demás reglas de esta sección no cambian.

Un turno está **vencido** cuando `fecha + hora_inicio` ya pasó (`turnoSigueVigente()`, 2, "Guard de vigencia"). Desde la Revisión 5 el guard `409 TURNO_VENCIDO` se aplica también a **cancelar** un `DISPONIBLE`/`COMPLETO` (2.10; no a descartar un `PENDIENTE`, salvedad N-1), **reprogramar** (2.11) y **autoinscribirse** (2.14), además de 2.2, 2.3 y 2.5. **No** se aplica a: cambiar prioridad (2.12), registrar un pago (`spec_modulo_I.md` §2.4) ni registrar la clase dictada (`spec_modulo_E.md` §2.1), porque son operaciones que tienen sentido, o son necesarias, después de que la clase ocurrió. Consecuencia útil: un turno con clase dictada registrada nunca puede cancelarse ni reprogramarse. **Ratificado por el PO (29/09/2026) — Q5**

### 3.9. `CANCELADO` es terminal y no reserva nada (Revisión 5)
Ninguna operación de este módulo saca a un turno de `CANCELADO`. Sus `reservas_turno` se eliminan al cancelar (2.10); sus `TurnoAlumno` **se conservan** como historial. Toda consulta de disponibilidad sigue filtrando `estadoTurno IN ("DISPONIBLE","COMPLETO")` (3.2), por lo que `CANCELADO` queda excluido sin cambios de código. Las consultas de **conteo** de `spec_modulo_H.md` sí lo incluyen (HU-H-01 AC2).

### 3.10. Una sola fuente de verdad para "qué tramos están libres" (Revisión 5)
`turno.disponibilidad.ts` expone `calcularTramosLibres(franja, ocupados)` y `iniciosPosibles(tramo, duracion, granularidad)`, funciones puras sobre minutos desde las 00:00. Las usan 2.8 (opciones del wizard), 2.9 (encaje en la franja y conflictos) y 2.11 (validación). Está prohibido reimplementar el cálculo en un componente de frontend: el frontend solo **muestra** lo que devuelve 2.8. La fórmula de superposición sigue siendo `intervalosSeSuperponen()` (3.3, sin cambios).

### 3.11. Lecturas del listado y detalle: excepciones documentadas a la Regla N.° 3 (Revisión 5, R5-7 y HU-C-09)

> **Revisión 6.** La excepción no se amplía. El filtro por alumno de la pantalla de reservas (2.20.2) se resuelve con el criterio de P-C6 (publicar `construirFiltroBusquedaAlumno` en el módulo B o, si no, esta misma excepción de solo lectura).

`listarTurnos()` ya lee de otros módulos, por relaciones de Prisma, los datos que muestra (profesor, materia, aula, alumnos). La búsqueda de 2.7 filtra por las **columnas normalizadas** de esas mismas relaciones (`apellidoNormalizadoAlumno`, `nombreNormalizadoAlumno`, `apellidoNormalizadoProfesor`, `nombreNormalizadoProfesor`, `nombreNormalizadaMateria`, `nombreNormalizadaAula`). Se documenta como **excepción de solo lectura**, en vez de crear cuatro servicios públicos que devuelvan listas de ids potencialmente enormes para un patrón de 2 letras. Si en Sprint 3 se agregan filtros combinados (HU-C-02 AC6), se reevalúa mover el filtro a servicios públicos. La excepción **no** se extiende a escrituras.

**Extensión aprobada para HU-C-09 (29/09/2026):** el detalle que reutiliza `presentar()` puede leer por las relaciones existentes los campos básicos enumerados en §2.4 de Alumno, Materia, Profesor y Aula. La alternativa de crear consultas públicas separadas para cada relación se descarta para esta HU porque duplicaría la composición ya compartida con el listado; el alcance queda restringido a proyección de datos para mostrar, después de `turnos:leer` y del control de turno propio para Profesor. No se consulta directamente `usuarios` (creador/modificador), `pagos` ni `clases_dictadas`: A/I/E conservan sus servicios públicos. No se autoriza ampliar el filtro de búsqueda, consultar campos de contacto, validar ni escribir en dominios externos mediante esta excepción.

### 3.12. Generación masiva: todo o nada, y con reserva desde el `INSERT` (Revisión 5, R5-8 y R5-9)
La generación de 2.9 nunca crea turnos parciales. Como los turnos generados nacen `DISPONIBLE` (backlog v2), el trigger `turno_sincronizar_reservas` reserva profesor y aula en cada `INSERT`, y la exclusión GiST es la defensa final contra dos corridas simultáneas o contra un turno creado por otra vía entre el cálculo y la inserción. **No se usa advisory lock.** La vista previa es solo informativa: la confirmación recalcula todo dentro de su transacción y **nunca** confía en ella. Esta es la **única** ruta por la que un turno se crea directamente `DISPONIBLE`; cualquier otra sigue el camino `PENDIENTE` → 2.2.

### 3.13. Excepciones documentadas a las Reglas N.° 1 y N.° 8 (Revisión 5)

> **Revisión 6.** La baja física del vínculo de inscripción (`TurnoAlumno`) que esta sección y 2.5 tomaban como excepción **queda superada** por 3.14: la inscripción se finaliza con una vigencia. Siguen siendo excepciones las filas de `reservas_turno` y el vínculo `ProfesorMateria`.

- **Regla N.° 1 (sin `DELETE`):** se eliminan filas de `reservas_turno` al cancelar (2.10) y se elimina el vínculo `ProfesorMateria` al quitar una materia (HU-D-07). Ambas son tablas de proyección o asociación, no entidades de dominio (mismo criterio que la baja de `TurnoAlumno` en 2.5). El `Turno` nunca se borra: se cancela.
- **Regla N.° 8 (inmutabilidad):** el pago y el historial académico son registros de hecho consumado y **no viven en este módulo**; ver `spec_modulo_I.md` §3.6 y `spec_modulo_E.md` §3.1. `Turno` no es un registro de hecho consumado (se reprograma, se cancela).


### 3.14. Una inscripción no se borra: vigencia en vez de baja física (Revisión 6, convención 8 a)
La inscripción (`TurnoAlumno` extendido, 2.16) se **finaliza**, no se elimina: quitar a un alumno, cancelar la propia inscripción, vencer una reserva o dar de baja al alumno cambian su `vigencia` y dejan fecha y usuario (o «Proceso automático»). Esto **reemplaza** dos frases de Sprint 2: el paso 2 de «quitar» en 2.5 («baja física de la fila intermedia») y la mención de «la baja de `TurnoAlumno` en 2.5» en 3.13, que presentaba el vínculo de inscripción como una tabla de asociación sin historial. La Regla N.° 1 de `RULES.md` rige ahora también para las inscripciones. Lo que **no** cambia es el contrato HTTP de quitar (2.16.6). La excepción de 3.13 para `reservas_turno` (tabla de proyección) sigue vigente: el trigger proyecta solo las inscripciones `VIGENTE` y borra la reserva al finalizarse (`PR-0.md` §2.0).

### 3.15. Quién cuenta como inscripto sale de un solo servicio (Revisión 6)
Cupo, superposición de horarios, unicidad de la inscripción, estado Disponible/Completa, cantidad «3/5» y lista de alumnos se resuelven con `esVigenteEn`, `inscripcionesVigentes`, `ocupacion` y `sqlVigenteEn` (2.16.3). Una reserva vencida que el proceso todavía no marcó **no cuenta**. Está prohibido reimplementar la regla en un componente, una consulta o una función pública del módulo.

### 3.16. Estado guardado de la clase y estado decidido (Revisión 6)
`Turno.estado` se mantiene dentro de las operaciones que cambian inscripciones, pero ninguna lectura decide con él: se decide con `ocupacion(db, turnoId, ahora())` (2.16.5). **Complemento de 3.1:** las operaciones de inscripción nunca sacan a un turno de `PENDIENTE` ni de `CANCELADO`; la salida de `PENDIENTE` sigue siendo exclusiva de 2.2 paso 8 y de 2.9.

### 3.17. Bloqueo en orden canónico para las operaciones que escriben inscripciones (Revisión 6)

> **Nota posterior (08/10/2026).** Se suman el profesor (recurso) y la relectura del alumno bajo bloqueo: 2.21.3.
El patrón de 3.7 (bloquear la fila del turno con `FOR UPDATE`, contar, comparar, escribir) **se conserva**, pero el bloqueo se toma con `bloquear(tx, { recursos, clases, inscripciones })` en el orden único de `RULES.md` (recurso —aula, materia, profesor, alumno— → clase → inscripción → operación de pago → caja; dentro de cada tipo, por id ascendente), en una sola llamada por transacción. La garantía es la misma que en Sprint 2 y se suma que ninguna operación nueva puede interbloquearse con otra. Las operaciones de 2.17, 2.18, 2.19 y 2.20 toman, como máximo, al alumno, la clase y la inscripción; el proceso de vencimiento toma **una sola clase por transacción** (2.18.1).

### 3.18. Precio congelado (Revisión 6, HU-L-06 y HU-C-22 criterio 6)
Toda inscripción guarda su `precio` al crearse (`precioClase`: tarifa por hora de la materia × duración / 60, con la tarifa vigente en ese instante) y **no se recalcula nunca**: un cambio de tarifa, individual o masivo, rige solo para las inscripciones nuevas. La tarifa se obtiene por el servicio público de Materias (`spec_modulo_L.md` §2.10), no leyendo `Materia` directo. Si la materia no tiene tarifa, no se crea la inscripción (`422 MATERIA_SIN_TARIFA`, regla 3.12 de `spec_modulo_L.md`).

### 3.19. Nadie retiene un lugar sin pagar (Revisión 6, HU-C-22 criterio 4)
Un alumno que ya tuvo en una clase una reserva vencida o cancelada sin haberla pagado no puede volver a reservarla en línea: solo puede inscribirse en el centro pagando en el momento (2.17.2 paso 4 y 2.18.3). No alcanzan a la regla la cancelación de una inscripción sin reserva, las inscripciones quitadas por el centro o dadas de baja, las reservas que el alumno había pagado ni una reserva reabierta por anulación que después vence.

### 3.20. Compatibilidad con lo ya desarrollado (Revisión 6, `PR-0.md` §1.1)
Ninguna operación de este módulo de los Sprints 1 y 2 cambia ruta, método, cuerpo del pedido, forma de la respuesta, códigos HTTP ni `code` de error, salvo los cambios inevitables que manda el backlog y que lista la tabla de compatibilidad del comienzo de la Revisión 6 (por ejemplo, `422 MATERIA_SIN_TARIFA`). Se admiten campos **opcionales** nuevos en el pedido, campos **extra** en la respuesta y códigos nuevos **solo** para condiciones nuevas. Las funciones públicas de 2.15 conservan firma y forma del resultado. Si una instrucción de una HU del Sprint 3 solo se puede cumplir rompiendo algo de lo anterior, se mantiene lo anterior y se avisa a la persona a cargo de esta spec: no se resuelve por inferencia.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Este módulo usa la **opción (b)** de la Regla N.° 2: escritura directa y síncrona a `eventos_turno` (sin encadenamiento hash, ver historial de esa regla). Los emisores existentes usan `emitirEventoTurno()` → `prisma.eventoTurno.create()`; para los eventos devueltos por el ajuste de cupos de §2.15, `emitirEventosTurno()` escribe el lote con un solo `eventoTurno.createMany`. Se eligió porque el ciclo de vida del turno (configurar, asignar aula, confirmar, inscribir, cancelar, reprogramar) necesita reconstruirse operación por operación y no alcanza con columnas de auditoría. Como corresponde a (b), ambos emisores escriben **después** del `COMMIT` de la transacción de negocio, nunca dentro de ella. Complementariamente, `Turno` lleva columnas de auditoría de la opción (a) (`createdAtTurno`, `creadoPorUsuarioId`, `modificadoPorUsuarioId`, `updatedAtTurno`), que se persisten en la misma operación y no reemplazan a los eventos.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `turno:configurado` | Alta (2.1) | `turno_id, fecha, hora_inicio, hora_fin, duracion_min, materia_id, usuario_id` (Revisión 3: ya no lleva `cupo_maximo`, todavía no existe en este paso; **Revisión 4: agrega `duracion_min`**) |
| `turno:configuracion_modificada` | Modificación de turno pendiente (2.1) | `turno_id, campos_modificados` (puede incluir `"profesor_id"`, `"materia_id"`, `"fecha"`, `"hora_inicio"`, `"duracion_min"`), `aula_desasignada` (booleano, R5-10), `usuario_id` |
| `turno:aula_asignada` | Asignación de aula (2.3) | `turno_id, aula_id, cupo_maximo, usuario_id` (Revisión 3: agrega `cupo_maximo`, ahora se fija en este paso) |
| `turno:participantes_asignados` | Carga/reemplazo inicial de profesor + alumnos (2.2) | `turno_id, alumno_ids, profesor_id, usuario_id` |
| `turno:disponibilizado` | Transición Pendiente→Disponible (Revisión 3: ahora se dispara desde 2.2, no 2.3) | `turno_id, fecha, hora_inicio, hora_fin, alumno_ids, profesor_id, aula_id, materia_id, usuario_id` |
| `turno:completado` | Transición a Completo, desde 2.2 (Revisión 3), 2.5 o ajuste de cupos de 2.15 | `turno_id, alumno_ids, cupo_maximo, usuario_id` |
| `turno:alumno_agregado` | Alta individual de alumno (2.5) | `turno_id, alumno_id, usuario_id` |
| `turno:alumno_quitado` | Baja individual de alumno (2.5) | `turno_id, alumno_id, usuario_id` |
| `turno:disponible_nuevamente` | Transición Completo→Disponible (2.5 o ajuste de cupos de 2.15) | `turno_id, alumno_id_liberado, usuario_id`; en 2.15, `alumno_id_liberado: null` porque no se quitó ningún alumno |
| `turno:cancelado` | Cancelación (2.10) | `turno_id, estado_anterior, profesor_id, aula_id, alumno_ids, usuario_id` |
| `turno:reprogramado` | Reprogramación (2.11) | `turno_id, fecha_anterior, hora_inicio_anterior, fecha_nueva, hora_inicio_nueva, hora_fin_nueva, usuario_id` |
| `turno:prioridad_actualizada` | Cambio de prioridad (2.12) | `turno_id, prioridad_anterior, prioridad_nueva, usuario_id` |
| `turno:cupo_actualizado` | Cambio de capacidad del aula (2.15, HU-K-03) | `turno_id, aula_id, cupo_anterior, cupo_nuevo, usuario_id` |
| `turno:alumno_agregado` (ampliado) | 2.5 y autoinscripción (2.14) | agrega `origen: "MESA_ENTRADA" \| "AUTOSERVICIO"` al payload existente |
| `turno:configurado` (ampliado) | 2.1 y generación masiva (2.9) | agrega `profesor_id` y, si viene de 2.9, `generacion_id` |
| `turno:aula_asignada` (ampliado) | 2.3 y 2.9 | sin cambios de payload; 2.9 lo emite por cada turno generado |

**Revisión 5 — trazabilidad (Regla N.° 2).** Todas las mutaciones nuevas del módulo usan la opción (b): escritura en `eventos_turno` después del `COMMIT`, mediante `emitirEventoTurno()` o, para el lote de 2.15, `emitirEventosTurno()`. `eventos_turno.turnoId` es obligatorio, por eso la generación masiva (2.9) emite eventos por turno y no uno global; el `generacion_id` en el payload los agrupa. Además, la fila `Turno` guarda `modificadoPorUsuarioId` y `updatedAtTurno` (columnas a verificar contra `schema.prisma`; si no existen, las agrega la migración 2 de la Revisión 5), que 2.10 a 2.12 actualizan en la misma operación. Los pagos y el historial académico **no** viven en este módulo (`spec_modulo_I.md`, `spec_modulo_E.md`).

**Revisión 6 — trazabilidad de las inscripciones (Regla N.° 2).** Conviven dos registros, cada uno con su propósito:

- **`eventos_turno`** (opción (b), sin cambios de esquema): sigue registrando el ciclo de vida de la **clase** y las operaciones de un **usuario**. Su columna `usuarioId` es obligatoria, por eso **no** registra lo que hace el «Proceso automático».
- **Historial de estados de la inscripción** (lo crea el PR 0, `PR-0.md` §2.1 y §2.10): registra **cada transición de vigencia y de estado de pago** con actor (usuario o «Proceso automático»), fecha y valores anterior y nuevo. Lo escribe el servicio de inscripción **después del `COMMIT`**, con reintento. Es la fuente de «Reserva vencida» en el historial de clases (HU-E-02) y de las series de HU-H-10.

Eventos de `eventos_turno` nuevos o ampliados en esta revisión:

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `turno:alumno_agregado` (ampliado) | 2.5, autoinscripción (2.14.2 / 2.17) e inscripción al confirmar el pago (HU-I-10) | agrega `inscripcion_id` y `estado_pago` al payload existente; `origen` suma el valor `"PAGO"` |
| `turno:alumno_quitado` (ampliado) | 2.5 y «Quitar» de 2.20 | agrega `inscripcion_id` al payload existente |
| `turno:inscripcion_cancelada` (nuevo) | Cancelación propia (2.19) | `turno_id, alumno_id, inscripcion_id, estado_pago, usuario_id` |
| `turno:completado` / `turno:disponible_nuevamente` | Transición causada por una operación de un usuario sobre las inscripciones (2.5, 2.17, 2.19, 2.20) | Sin cambios de payload. Cuando la transición la causa el proceso de vencimiento, **no** se emite evento (no hay usuario): queda en el historial de estados |
| `turno:participantes_asignados` | 2.2 | Sin cambios de payload |
| `turno:configurado` / `turno:aula_asignada` / `turno:disponibilizado` (2.9.1) | Generación masiva con aula por fecha | Sin cambios de payload; `aula_id` y `cupo_maximo` son los de cada clase |

La generación masiva (2.9.1), el proceso (2.18.1), la cancelación propia (2.19) y «Quitar» (2.20) **no** usan columnas de auditoría nuevas en `Turno`: la fila de la inscripción lleva `finalizadaEl` y `finalizadaPor`.

---

## Parámetros configurables (referencia)

| Parámetro | Usado en |
|---|---|
| `DURACIONES_PERMITIDAS_TURNO_MIN` | **Revisión 4 — reemplaza a `DURACION_ESTANDAR_TURNO_MIN`** (que en el código real era la fila `duracion_turno_estandar_minutos` de `ParametroSistema`, ya no leída ni sembrada). Lista de valores permitidos, `[60, 120, 180]`. **Constante en código** (`src/server/turnos/turno.schema.ts`), **no fila de `ParametroSistema`** (R4-1): cambiar el conjunto requiere una nueva aprobación del PO. El frontend la recibe vía `GET /api/turnos/configuracion` (`parametros.duraciones_permitidas_minutos`). 2.1 — cálculo de `hora_fin`, validación de `duracion_min` (schema Zod + revalidación en el servicio, `DURACION_NO_PERMITIDA`) |
| `GRANULARIDAD_MINUTOS` (fila `granularidad_turno_minutos` de `ParametroSistema`; valor de seed: `30`) | 2.1 (validación de `hora_inicio`), 2.8 (horas de inicio ofrecidas), 2.9 (alineación de `hora_inicio`) y 2.11 (reprogramación) |
| `DIAS_OPERATIVOS` | 2.1 (día válido para configurar), 2.8 (días ofrecidos), 2.9 (fechas generables) y 2.11 |
| `HORA_APERTURA` / `HORA_CIERRE` | 2.1 (horario operativo del centro), 2.8 (horas de inicio ofrecidas) y 2.11 |
| `ANTICIPACION_MAXIMA_DIAS` (fila `anticipacion_maxima_dias` de `ParametroSistema`; valor de seed: `30`) | 2.1, 2.8 y 2.11 (con el tope `max(fecha actual del turno, hoy + N)`, N-4). **No** aplica a 2.9 (R5-8) |
| `generacion_maxima_meses` | **Revisión 5 — nuevo, fila de `ParametroSistema`.** Amplitud máxima de una generación masiva, en meses calendario: `fecha_hasta` no puede superar `fecha_desde` + N meses. Valor: `6`. 2.9. **Ratificado por el PO (29/09/2026) — Q3** |
| `generacion_maxima_turnos` | **Revisión 5 — nuevo, fila de `ParametroSistema`.** Tope de turnos creados por corrida de 2.9. Valor: `40`, **confirmado por el PO (29/09/2026)**. Cada corrida usa **una sola franja** (`horario_id`), así que 6 meses son a lo sumo ~27 fechas (26 semanas + 1): en la práctica el tope de 40 no se alcanza y funciona como resguardo. |
| `plazo_pago_horas` | **Revisión 6 — nuevo, fila de `ParametroSistema`** (lo carga la migración del PR 0; HU-N-01 lo hace configurable). Plazo para pagar una reserva, contado desde que se hizo (24 por defecto). Se lee con `parametrosVigentes()`. 2.17 y 2.18. Un cambio no afecta a las reservas ya hechas |
| `cancelacion_anticipacion_horas` | **Revisión 6 — nuevo, fila de `ParametroSistema`** (PR 0 / HU-N-01). Anticipación mínima para que el alumno cancele en línea una inscripción que no es una reserva sin pagar (24 por defecto). Rige el valor vigente al momento de cancelar. 2.17.1 y 2.19 |
```
