```markdown
# Especificación Técnica — Módulo E (Atención académica / Historial)
## Noctium — Sprint 2 · Sprint 3 (Revisión 2)
## Revisión 1 — primera versión (módulo nuevo de Sprint 2)

## Revisión 2 — Sprint 3: asistencia individual (HU-E-09), historial de clases del alumno (HU-E-02), observaciones de la clase (HU-E-07), indicaciones académicas (HU-E-04), corrección y anulación de exámenes (HU-E-10) y de clases dictadas (HU-E-11), y «Mi historial» (HU-E-08)

**Referencias normativas (Revisión 2):** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11) · Backlog del Sprint 3 (v18, 06/10/2026; convenciones 2, 4, 5, 8 a, 8 d, 8 g, 8 i y 9, y las HU-E-09, E-02, E-07, E-04, E-10, E-11 y E-08) · `PR-0.md` §1.1 (principio de compatibilidad), §2.0, §2.2, §2.8, §2.9, §2.13 y §2.14 · `spec_modulo_C.md` Revisión 6 (§2.4, §2.15, §2.16) · `spec_modulo_I.md` Revisión 3 (P-I9, `obtenerClasesBasicas`) · `spec_modulo_B.md` (§2.8, `obtenerAlumnoDeUsuario`) · `schema.prisma` · `docs/adicionales/mapa-pantallas-sprint-3.md` (P-12, P-21, P-26, P-27, M-22, M-23, DEC-16, DEC-17, DEC-18 y DEC-20) · `docs/DESIGN.md` §6

**HU contractualizadas en la Revisión 2 (Sprint 3):** HU-E-09 (Registrar asistencia individual por clase), HU-E-02 (Ver y filtrar el historial de clases del alumno; absorbe HU-E-03), HU-E-07 (Registrar observaciones de la clase), HU-E-04 (Registrar indicaciones académicas), HU-E-10 (Corregir o anular resultado de examen), HU-E-11 (Corregir o anular registro de clase dictada) y HU-E-08 (Consultar propio historial académico).

**Cómo se verificó esta revisión.** El repositorio de lectura no incluye el código del módulo E (solo están Materias y Pagos): lo existente se contrastó contra el contrato de la Revisión 1 de esta spec y contra `schema.prisma` (modelos `ClaseDictada`, `ClaseDictadaAlumno` y `ResultadoExamen`). Quien implemente cada HU debe confirmar sobre el código real los puntos de «Adaptación del código existente» de 2.5.4.

**Regla del equipo (08/10/2026) — nada de lo ya desarrollado se rompe.** El Sprint 3 se acomoda a lo que se hizo en los Sprints 1 y 2, no al revés. Esta revisión es **aditiva**: no renumera, no reescribe las secciones anteriores (solo les agrega una nota de «Revisión 2») y no cambia ningún contrato HTTP de Sprint 2, salvo por las condiciones nuevas que manda el backlog y que figuran, una por una, en la tabla de abajo.

| Lo que ya existe | Qué se conserva | Qué cambia (y quién lo manda) |
|---|---|---|
| 2.1 `POST /api/turnos/[id]/clase-dictada` y `GET` | Ruta, método, **pedido sin cuerpo**, respuesta `201`/`200` con `id`, `turno_id`, `fecha`, `alumnos_registrados` y `ya_existia`, y los `code` de error. Q7c (se registra recién cuando la clase terminó) y el `ON CONFLICT` (una sola clase por turno, sin duplicar bajo concurrencia). **Sin cuerpo, el comportamiento es el de Sprint 2** (sin control de asistencia, T4) | Cuerpo **opcional** con `asistencias` (HU-E-09); campos extra en la respuesta; el `GET` suma `asistencia` por alumno, totales, observaciones y acciones. Internamente: la unicidad pasa al índice parcial de `PR-0.md` §2.8 (T3), el bloqueo a `bloquear` (T9) y el alumno quitado ya no figura (T10) |
| 2.2 `POST /api/alumnos/[id]/examenes` y `GET …/opciones` | Ruta, cuerpo, respuesta, `code` de error (incluido el `422 NOTA_FUERA_DE_RANGO`), escala, observaciones y los chequeos de materia cursada y de fecha | **Para el Profesor**, el alcance pasa de «alumnos que atendió» a la materia de su clase (convención 8 g, T1): es el único cambio de comportamiento sobre lo existente y lo manda el backlog. Para los demás roles, nada. «Materia cursada» deja de contar las clases dictadas anuladas (HU-E-04, criterio 2): sin anulaciones es idéntico |
| 2.3 `GET /api/alumnos/[id]/historial` | Ruta, parámetros (`materia_id`, `pagina`, `por_pagina`), paginación de a 10, `materias_disponibles`, el `UNION ALL` en una sola consulta, `tipo`, `fecha`, `materia`, `profesor`, `turno_id`, `nota` y `observaciones` del examen, y los `code` | Campos extra en la respuesta (`asistencia_por_materia` y, por ítem, `id`, `asistencia`, `observacion`, `corregido`, `anulado`, `puede_corregir`) y un tipo de ítem nuevo, `INDICACION` (HU-E-04, criterio 5; HU-E-08, criterio 3). Las clases dictadas anuladas no figuran (HU-E-11, criterio 4). **Profesor:** alcance de 8 g (T1) |
| 2.4 funciones públicas | `obtenerClaseDictadaDeTurno(turnoId, db?)` y `profesorAtendioAlumno(profesorId, alumnoId, db?)` conservan **firma y forma del resultado** | Ambas ignoran las clases dictadas anuladas. `profesorAtendioAlumno` deja de ser la regla de alcance (la reemplaza el helper de 2.5.3), pero **se conserva exportada** y con sus tests. Funciones nuevas en 2.13 |
| Permisos `clases:registrar`, `examenes:registrar`, `historial:leer` | Roles y significado | `historial:leer` y `alumnos:leer` del Profesor y el Gerente cambian como manda la convención 8 (d) y (g), ya cargado en `PR-0.md` §2.9. Permisos nuevos (2.5.2), propuestos para la tabla cerrada |
| Modelos `ClaseDictada`, `ClaseDictadaAlumno`, `ResultadoExamen` | Columnas, claves y significado de cada una, inmutables | Solo se **suman** columnas y tablas (2.5.1; `PR-0.md` §2.8 y §2.14). El único `UPDATE` sobre un registro de hecho es la marca de anulación de la clase dictada (T3) |
| Pantallas del tab «Historial académico» y del detalle de la clase | Lo que muestran hoy mientras no haya datos del modelo nuevo | Asistencia, observaciones, indicaciones, corrección y anulación (mapa P-21, P-27, M-22 y M-23). Sin datos nuevos, se ven como hoy: las clases de Sprint 2 figuran «Asistió (sin control de asistencia)» |

**Contradicciones entre Sprint 2, el backlog y el PR 0, y cómo se resuelven.** Una sola obliga a cambiar un comportamiento existente porque lo manda el backlog (T1); las demás son de reglas internas o de redacción y se resuelven a favor de lo existente.

| # | Contradicción | Resolución |
|---|---|---|
| T1 | Q7b y las convenciones de 2.2 y 2.3: el Profesor ve el historial **completo** y registra exámenes de **cualquier materia** de los alumnos que **atendió**. La convención 8 (g) del backlog **reemplaza** ese alcance: el Profesor accede al historial de un alumno inscripto en una clase suya, solo desde el detalle de esa clase y solo en la materia de esa clase | **Cambio inevitable, lo manda el backlog y ya figura en `PR-0.md` §1.1.** El Profesor pasa a `profesorPuedeVerHistorial(profesorId, alumnoId, materiaId)` (2.5.3). Se mantienen: la ruta, el cuerpo y los `code` de 2.2 y 2.3, y el `403 SIN_PERMISO` sin revelar si el alumno existe. El `materia_id` (que ya existía en la query) es **obligatorio para el Profesor**. El resto de los roles no cambia |
| T2 | Q7c: la clase se registra recién cuando **terminó** (`CLASE_NO_FINALIZADA`). HU-E-09 (criterio 1) habla de «una clase que ya empezó y todavía no se registró» | Se conserva Q7c (P-E1). La lista con Presente/Ausente aparece desde que la clase **empezó** (así se toma asistencia durante la clase) y «Registrar clase dictada» guarda cuando la clase terminó, como hoy. No se cambia el momento de registro de Sprint 2 |
| T3 | 3.1 y 3.3: `ClaseDictada` no admite `UPDATE` y la unicidad es el `UNIQUE` sobre `turnoId` con `ON CONFLICT ("turnoId")`. HU-E-11 exige anular y poder registrar de nuevo | Se cumplen las dos cosas sin tocar la Regla N.° 8 para lo demás: el registro original no se edita; la **corrección de asistencia** es un registro nuevo (2.11.1) y la **anulación** es la marca `anuladaEl`/`anuladaPor`/`motivo` que fijó `PR-0.md` §2.8 como excepción documentada a la Regla N.° 8 (se hace una sola vez, con condición atómica). El `UNIQUE` pasa al **índice único parcial** «una clase dictada no anulada por turno»; el `INSERT … ON CONFLICT ("turnoId")` pasa a `ON CONFLICT ("turnoId") WHERE "anuladaEl" IS NULL DO NOTHING` (inferencia del índice parcial). El comportamiento visible es el mismo |
| T4 | 3.4 y HU-E-01 criterio 5: «todos los inscriptos se consideran presentes». HU-E-09 lo reemplaza | Conviven (P-E4): sin cuerpo, `conControlAsistencia = false` y el alumno figura «Asistió (sin control de asistencia)»; con `asistencias`, `conControlAsistencia = true`. Las clases de Sprint 2 y los clientes que no mandan cuerpo siguen funcionando igual |
| T5 | «Fuera de alcance» y 3.1: no hay edición ni anulación (Q7e); las indicaciones quedaron para Sprint 3 (Q7a) | Cumplido por HU-E-10, HU-E-11 y HU-E-04. Se agregan las rutas de 2.9 a 2.11; el valor que se muestra es el vigente (3.6) |
| T6 | 2.3: «el Profesor ve el historial completo» y el enlace «Ver historial» del detalle se calcula con `profesorAtendioAlumno` | El helper nuevo reemplaza la regla. El detalle de **su propia clase** ya contiene los datos para decidirlo (el alumno es un inscripto vigente de una clase suya, primera condición de 8 g): el cálculo de `puede_ver_historial` queda en el módulo C, sin que C importe a E (Regla N.° 3, 2.5.3). El `403` del `GET` se mantiene como defensa ante una URL escrita a mano |
| T7 | HU-E-02 (criterio 8): el Profesor «no accede» a la pestaña Clases; Q13: la ficha se abre con `alumnos:leer` **o** `historial:leer` | Son compatibles. La pestaña Clases (2.7) exige `alumnos:leer` (el Profesor ya no lo tiene). Q13 se conserva para quien tiene solo `historial:leer`: el Profesor llega por la ruta propia de DEC-20, no por la ficha. El Gerente, que ahora tiene `alumnos:leer` (convención 8 d), ve la ficha completa en modo consulta |
| T8 | `ResultadoExamen.observaciones` (2.2) y las «Observaciones internas» de HU-E-07 comparten palabra | Son datos distintos. El examen conserva `observaciones` tal cual; las de la clase se llaman `temas_vistos` y `observaciones_internas`, y se devuelven dentro de `observacion` en el ítem de la clase dictada |
| T9 | 2.1 paso 1 bloquea el turno con `FOR SHARE` (`bloquearTurnoParaOperacion`); el PR 0 fija el orden de bloqueo único y que `registrarClaseDictada` llame a `marcarVencidas` | Se usa `bloquear` en el orden canónico (`FOR UPDATE` sobre la clase) y después `marcarVencidas`: tomar `FOR SHARE` y escalar a `FOR UPDATE` dentro de la misma transacción puede producir un interbloqueo. La garantía de 2.1 (la clase no cambia de estado mientras se registra) se conserva. Los códigos `TURNO_NO_ENCONTRADO`, `TURNO_NO_ADMITE_CLASE` y `CLASE_NO_FINALIZADA` no cambian |
| T10 | 2.1 paso 6 copia `turno.alumno_ids` | Sin cambio observable: desde la Revisión 6 de C, `alumno_ids` son los alumnos con inscripción **vigente** (una reserva vencida o un alumno quitado no figura). Con asistencia, se toma la lista de inscripciones vigentes con su id (2.6.2) |
| T11 | HU-E-02 pide que el resultado de cada clase combine datos de Turnos (vigencia, clase cancelada, aula) y de Historial (clase dictada y asistencia) | La Regla N.° 3 impide un `JOIN` entre módulos. C entrega los hechos de cada inscripción (`listarInscripcionesDeAlumno`, `PR-0.md` §2.13); **E los combina con los suyos y clasifica** (2.7.3). Mismo criterio para `profesorPuedeVerHistorial` (2.5.3) |
| T12 | HU-E-10 cuenta los 7 días desde que se registró el resultado; HU-E-11, desde la fecha de la clase | Son dos reglas distintas y las dos están en el backlog. Una sola función de plazo (3.9) con la fecha base como parámetro |

**Changelog de la Revisión 2 (trazabilidad Backlog → Spec):**
| HU / sección | Estado previo | Acción |
|---|---|---|
| Modelo de Sprint 3 y permisos | `ClaseDictada` con `turnoId` único y sin asistencia; sin observaciones, indicaciones ni correcciones | Nueva 2.5: columnas y tablas que crea el PR 0, permisos propuestos, alcance del Profesor (8 g) y adaptación del código |
| HU-E-09 | «Fuera de alcance»; 3.4 asume que todos asistieron | Nueva 2.6: `POST /api/turnos/[id]/clase-dictada` con `asistencias` opcionales y `GET` ampliado |
| HU-E-02 | Sin contrato | Nueva 2.7: `GET /api/alumnos/[id]/clases` (pestaña Clases), resultado, filtros y resumen |
| HU-E-07 | Sin contrato | Nueva 2.8: observaciones de la clase |
| HU-E-04 | Q7a: diferida a Sprint 3 | Nueva 2.9: indicaciones académicas y su regla de alcance para el Profesor |
| HU-E-10 | Q7e: sin corrección | Nueva 2.10: corregir y anular un resultado de examen |
| HU-E-11 | Q7e: sin corrección | Nueva 2.11: corregir la asistencia y anular el registro de clase dictada |
| HU-E-08 y HU-E-05 (2.3) | 2.3: historial de clases y exámenes; «Mi historial» sin contrato | Nueva 2.12: detalle de la ampliación de 2.3 (asistencia, observaciones, indicaciones, anulados y alcance del Profesor) y «Mi historial». Nota de Revisión 2 en 2.3 |
| §2.4 funciones públicas | Dos funciones | Nota y nueva 2.13: funciones nuevas |
| §3 Reglas | 3.1 a 3.5 | + 3.6 a 3.14 al final del bloque, sin renumerar. Notas en 3.1 a 3.5 |
| §4 Trazabilidad | Opción (a) | Nota de Revisión 2 |
| §5 Decisiones del PO | Q7a a Q7e y Q13 | Nota: estado de cada una |

**Puntos abiertos de la Revisión 2 — resueltos por el Scrum Master el 08/10/2026.** Cada fila describe la opción elegida; la última columna indica a quién se le informa la decisión (si cambia algo para el PO o para otro módulo, se le avisa antes del merge de la HU).

| # | Punto y decisión | A quién se informa |
|---|---|---|
| P-E1 | **Momento de registrar la clase (T2).** Se conserva Q7c: «Registrar clase dictada» solo desde el fin de la clase. La lista Presente/Ausente se muestra desde el inicio; las marcas viven en la pantalla hasta que se registra (HU-C-25, criterio 5: marcar no es una operación que se guarde). Consecuencia: si alguien marca durante la clase y recarga antes de que termine, pierde las marcas | PO (informativo; el backlog describe la lista «en una clase que ya empezó») |
| P-E2 | **Alumno inactivo.** Registrar un resultado (2.2, ya existente) o una indicación (2.9) exige alumno activo, con los códigos `404 ALUMNO_NO_ENCONTRADO` / `409 ALUMNO_INACTIVO`. **Corregir o anular** un examen (2.10), corregir la asistencia o anular una clase (2.11) **no** lo exigen: el objetivo de esas HU es que el historial no conserve datos equivocados, también el de un alumno dado de baja | — |
| P-E3 | **Plazo de 7 días (HU-E-10, criterio 5; HU-E-11, criterio 6).** Días de calendario en `America/Argentina/Buenos_Aires`, con el día 7 incluido: la diferencia entre hoy y la fecha base es de **7 días o menos**. HU-E-10 usa la fecha de registro del resultado; HU-E-11, la fecha de la clase. Es una constante del módulo, no un parámetro del centro (la convención 5 no lo lista) | PO (informativo) |
| P-E4 | **Corrección sin cambios.** Si la corrección de asistencia deja los mismos estados y la clase ya tenía control, responde `409 ASISTENCIA_SIN_CAMBIOS`; si la corrección de un examen repite la fecha y la nota vigentes, `409 CORRECCION_SIN_CAMBIOS`. No se guardan registros vacíos | — |
| P-E5 | **El `materia_id` del Profesor.** El detalle de la clase le da la materia: la pantalla `/turnos/[turnoId]/alumnos/[alumnoId]/historial` (DEC-20) verifica que la clase es suya y manda `materia_id` a la API. La API no recibe el `turno_id`: valida con el helper de 2.5.3, que es la regla de la convención 8 (g) («el servidor verifica en cada solicitud»). Sin `materia_id`, el Profesor recibe `403 SIN_PERMISO` | — |
| P-E6 | **Porcentaje de asistencia.** `presentes / (presentes + ausentes)` sobre las clases con control, redondeado al entero más cercano (mitades hacia arriba) para mostrar; sin clases con control es `null` («—»). Los indicadores (HU-H-07) comparan con los **conteos**, no con el entero redondeado | — |
| P-E7 | **Observaciones de la clase.** Una por clase dictada (HU-E-07, criterio 6). Un segundo intento responde `409 OBSERVACIONES_YA_REGISTRADAS`, no devuelve el existente: el contenido puede ser distinto y no se debe descartar en silencio. Se pueden registrar en cualquier momento (el backlog no fija plazo) | — |
| P-E8 | **Qué ve el alumno en «Mi historial».** Exactamente lo que enumera HU-E-08 (criterio 1): clase dictada con fecha, materia, profesor, temas vistos y asistencia; examen con fecha, materia y nota; indicación con fecha, materia y texto. **No** ve el campo `observaciones` del examen (no está en la lista del criterio) ni quién registró cada cosa | PO (informativo) |
| P-E9 | **La indicación del Profesor y el alumno ausente (Pendiente 12 del backlog).** Se aplica la opción (b) que ya recoge `PR-0.md` §2.9: la primera clase propia **cuenta aunque el alumno haya estado ausente** (figura en el registro de la clase). Si el PO decide otra cosa, solo cambia `profesorPuedeRegistrarIndicacion` | PO |
| P-E10 | **Vínculo de la indicación con una clase dictada.** Opcional. Si viene, la clase dictada tiene que existir, no estar anulada, ser de esa materia y tener al alumno en su registro; si no, `409 CLASE_DICTADA_NO_CORRESPONDE`. Si la clase se anula después, la indicación se conserva y se devuelve **sin** el vínculo (HU-E-11, criterio 4) | — |
| P-E11 | **Exámenes anulados.** Para mesa de entrada y el Gerente figuran en el historial con `anulado: true` y cuentan en la paginación; para el Profesor y el alumno no existen (HU-E-10, criterio 4). Un resultado anulado no admite otra corrección ni otra anulación (`409 RESULTADO_ANULADO`) | — |
| P-E12 | **Nombres propuestos de permisos y rutas** (2.5.2 y las secciones 2.6 a 2.12). El PR 0 fija los nombres definitivos en la tabla cerrada; si prefiere reutilizar una acción existente, solo cambia el nombre en `withPermission` | PR 0 |
| P-E13 | **Cancelación posterior a la baja de la inscripción (HU-E-02, criterio 2, última viñeta).** Para decidir si la inscripción dejó de ser vigente **antes** de que el centro cancelara la clase se necesitan la fecha de fin de la inscripción y la de cancelación de la clase; C las entrega en `listarInscripcionesDeAlumno` (R2-PR0-3). Si C no puede dar la fecha de cancelación, E aplica solo la precedencia «la vigencia de la inscripción gana», que es el caso real: las operaciones que finalizan una inscripción no se pueden hacer sobre una clase cancelada | — |

**Pedidos al PR 0 (tareas del Scrum Master; el PR 0 v19 los incorpora en la versión siguiente).** Ninguno rompe lo existente.

| # | Pedido | Dónde |
|---|---|---|
| R2-PR0-1 | **Esquema** de 2.5.1: en `ClaseDictada`, `conControlAsistencia`, `anuladaEl`, `anuladaPor`, `motivoAnulacion` y el índice único parcial; `ClaseDictadaAlumno.estadoAsistencia` (enum `EstadoAsistencia`, admite vacío); tablas `CorreccionAsistencia` y `CorreccionAsistenciaAlumno`, `ObservacionClase`, `Indicacion`, `CorreccionResultadoExamen` y `AnulacionResultadoExamen`, con sus índices. Los nombres son una propuesta; la forma (columnas y unicidades) es la que usa esta spec | 2.5.1; `PR-0.md` §2.8 y §2.14 |
| R2-PR0-2 | **Tabla cerrada de permisos** con los nombres de 2.5.2 (más `historial:leer_propio` para «Mi historial») y las rutas de 2.6 a 2.12 en `rutas-por-rol.ts` y el `matcher` del proxy (`/mi-historial`, `/alumnos/[id]/clases`, `/turnos/[turnoId]/alumnos/[alumnoId]/historial`) | 2.5.2; `PR-0.md` §2.9 |
| R2-PR0-3 | **Lecturas de C** que E necesita (todas de solo lectura, en lote y sin bloqueo): (a) `listarInscripcionesDeAlumno(alumnoId, { desde?, hasta? })` devuelve, por inscripción, `{ inscripcion_id, turno_id, fecha, hora_inicio, hora_fin, estado_clase, materia: { id, nombre }, profesor: { id, nombre_para_mostrar } \| null, aula: { id, nombre } \| null, vigencia, vigente_ahora, finalizada_el, cancelada_el }`, donde `vigente_ahora` es `esVigenteEn(inscripcion, ahora())`, `finalizada_el` es la fecha de fin de la vigencia y `cancelada_el` es el momento de cancelación de la clase; E no usa su parámetro `resultado`, porque ese resultado depende de datos de E; (b) `existeInscripcionVigenteConProfesor(alumnoId, profesorId, materiaId, db?)`; (c) `inscripcionesVigentes(db, turnoId, momento)` y `marcarVencidas(tx, turnoId)` en `inscripcion.publico.ts`, con `{ id, alumnoId }` por inscripción; (d) `obtenerClasesBasicas(turnoIds, db?)` (ya pedida por `spec_modulo_I.md` P-I9) | 2.5.3, 2.6, 2.7; `PR-0.md` §2.13 |
| R2-PR0-4 | **`profesorPuedeVerHistorial` vive en E** (`src/server/historial/alcance-profesor.ts`), no en una fachada: combina `existeInscripcionVigenteConProfesor` (C) con `profesorPuedeRegistrarIndicacion` (E) y ninguna `*.publico.ts` puede importar a otra (Regla N.° 3). `PR-0.md` §2.9 lo llama «helper compartido»: queda así precisado | 2.5.3; `PR-0.md` §2.9 |
| R2-PR0-5 | **Lecturas públicas de E** de 2.13 (`asistenciaDeAlumno`, `contarAsistenciasPorMes`, `profesorPuedeRegistrarIndicacion`) con sus pruebas; `registrarClaseDictada(tx, { turnoId, actor, asistencias? })` con la rama de asistencias, sin cambiar la firma. Si HU-H-07 necesita otra lectura, la agrega en esta misma fachada | 2.13; `PR-0.md` §2.13 |
| R2-PR0-6 | **`ErrorDeDominio`** con los `code` y HTTP de las secciones 2.6 a 2.12; los textos son los literales de los criterios, y los códigos de Sprint 2 conservan su texto de hoy. `errores.transaccion.ocupada` mapea a `409 TRANSACCION_OCUPADA` | 2.6 a 2.12; `PR-0.md` §2.13 |
| R2-PR0-7 | **Seed de historial académico** (`PR-0.md` §2.13 ya prevé uno): clases dictadas con control de asistencia (presentes y ausentes) y sin control, una con corrección y una anulada, observaciones, indicaciones vinculadas y sin vincular, exámenes corregidos y anulados, y alumnos con inscripciones en cada uno de los resultados de 2.7.3. Es la base de las pruebas de HU-E-02, HU-E-08 y HU-H-07 | `PR-0.md` §2.16 |
| R2-PR0-8 | **Pruebas**: los tests de Sprint 2 de 2.1 a 2.4 siguen pasando (solo cambian los mocks de persistencia); una prueba con PostgreSQL real del `ON CONFLICT … WHERE "anuladaEl" IS NULL` (registrar, anular, registrar de nuevo, y dos registros simultáneos) y otra de la equivalencia entre `asistenciaDeAlumno` y el historial | 3.14; `PR-0.md` §4 |

**Efectos en otras specs (se anotan al escribirlas o corregirlas):** `spec_modulo_A.md` (§2.4: permisos de 2.5.2, que el Profesor pierde `alumnos:leer` y el Gerente lo gana, y rutas por rol), `spec_modulo_B.md` (el Gerente ve la ficha con las pestañas Clases, Historial académico y Pagos en modo consulta, sin acciones de escritura; E usa `obtenerAlumnoDeUsuario` para «Mi historial»), `spec_modulo_C.md` (`puede_ver_historial` del Profesor lo calcula C con los datos del detalle de su propia clase, sin llamar a E; `registrar_clase` conserva la condición de Sprint 2; las lecturas de R2-PR0-3), `spec_modulo_H.md` (HU-H-07 lee `contarAsistenciasPorMes` y `asistenciaDeAlumno`, que excluyen las clases dictadas anuladas y las «sin control»; el enlace a «Historial académico» del Gerente es la ruta de la ficha), `spec_modulo_D.md` y `spec_modulo_L.md` (sin cambios: E reutiliza `obtenerNombresProfesores`, `obtenerOpcionProfesorDeUsuario` y `obtenerMateriasPorIds`).

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM · Zod · NextAuth
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 8, 10, 11) · `spec_modulo_A.md` (sesión/RBAC, matriz §2.4) · `spec_modulo_B.md` (Alumno) · `spec_modulo_C.md` Revisión 5 (Turno, §2.15) · `spec_modulo_D.md` (Profesor) · `spec_modulo_L.md` (Materias) · `schema.prisma` · `docs/tasks/Sprint 2/HU-Sprint-2.md` · `docs/adicionales/mapa-pantallas-sprint-2.md` (§2, "Historial académico"; §4) · `docs/DESIGN.md` §6

**HU contractualizadas en esta revisión:** HU-E-01 (Registrar clase dictada), HU-E-06 (Registrar resultados de exámenes), HU-E-05 (Ver historial académico del alumno) — Sprint 2. Es la **primera revisión** del módulo: no existía `spec_modulo_E.md`.

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-E-01 | Gap — no contractualizada | Añadida sección 2.1 |
| HU-E-06 | Gap — no contractualizada | Añadida sección 2.2 |
| HU-E-05 | Gap — no contractualizada | Añadida sección 2.3 |

**Fuera de alcance de esta spec (explícito):**

> **Revisión 2 (Sprint 3).** Lo que esta lista dejaba afuera queda así: la **asistencia individual** es HU-E-09 (2.6); **editar o anular** una clase dictada o un examen son HU-E-11 y HU-E-10 (2.11 y 2.10), resueltas como **registros nuevos que referencian al original** (Regla N.° 8), tal como anticipaba esta lista y la Q7e; las **indicaciones académicas** son HU-E-04 (2.9); los **filtros del historial** distintos de la materia no se agregan a 2.3: los filtros por resultado y por fechas viven en la pestaña Clases (2.7). Siguen fuera de alcance los promedios, la condición de aprobado o desaprobado y la exportación.

- Asistencia individual (quién faltó): se asume que **todos los inscriptos** al momento de dictarse la clase asistieron (HU-E-01 AC5).
- Promedios, condición de aprobado/desaprobado y cualquier cálculo sobre las notas (HU-E-06 AC5).
- **Editar o anular** una clase dictada o un resultado de examen: son registros de hecho consumado (Regla N.° 8). Una corrección se resolvería con un registro compensatorio nuevo que referencie al original; el PO planificó una HU en Sprint 3 para solventar los casos en que haya que corregir (Q7e).
- Indicaciones académicas y evolución del alumno como texto libre: el backlog final de HU-E-01 no incluye ese campo (el borrador de los PO decía "con indicaciones académicas"). **Ratificado por el PO (29/09/2026) — Q7a**: las indicaciones académicas son HU-E-04, planificada para Sprint 3.
- Filtros del historial distintos de la materia; exportación.

---


## Sincronización HU-E-11 — 09/10/2026

Relevamiento y decisiones aprobados por el usuario antes del código. §2.11 se implementa con las dos rutas POST previstas y el servicio de clase dictada. Correcciones append-only con una fila anterior/nuevo por alumno del snapshot. La anulación aplica la excepción T3 de PR0: marca única atómica `anuladaEl`/`anuladaPorUsuarioId`/`motivoAnulacion` en la clase; no modifica contenido ni asistencias originales. Se conserva la discrepancia del criterio 5 del backlog como excepción contractual aprobada, sin tabla nueva.

| Sección | Estado previo | Acción |
|---|---|---|
| 2.11 | Contrato pendiente | Implementar corrección y anulación, schemas estrictos, errores, auditoría y re-registro |
| 2.6.3 | GET con observaciones | Sumar acciones corregir_asistencia/anular_registro/plazo_correccion_vencido, verificadas en servidor |
| 3.9 | Helper para instantes | La fecha de clase `@db.Date` se interpreta como calendario del centro antes de pasar al helper; E10 conserva timestamps |
| Presentación | Figuras 74–75 | Corrección en lista existente y modal compacto con motivo; sidebar preservado por instrucción del usuario |

En la UI, los alumnos de la corrección vienen del snapshot, aunque su inscripción actual haya cambiado; se precarga asistencia vigente o todos Presente si no había control. Presente seleccionado usa el token semántico `attendance-selected`; badges de resultado siguen usando fondos suaves. No se muestra el badge de pago del prototipo al Profesor: el contrato actual de detalle para ese rol no entrega pagos y E11 no amplía su acceso financiero. Las capturas usan datos reales del fixture propio, no nombres/montos ficticios.

La corrección actualiza lecturas E/H sin cambios en sus algoritmos. Anular excluye clase y observación, conserva examen e indicación y oculta el vínculo de esta última al leer. La verificación real está documentada en `docs/testing/HU-E-11-evidencia.md`.

### Sincronización HU-E-08 — 09/10/2026

`GET /api/mi-historial` implementado con permiso `historial:leer_propio`, dueño resuelto mediante B desde sesión y DTO allowlist de §2.12.2. La consulta unificada excluye exámenes anulados del modo ALUMNO antes de count/limit; clases anuladas ya se excluyen con el valor vigente de E11. Query de alumno ajeno: 403 antes de validación; otros parámetros desconocidos: 400.

Pantalla `/mi-historial`: línea de tiempo, filtro de materia que reinicia página, diez registros por página y porcentaje de asistencia por materia. Referencia figura 76 aplicada con los campos públicos aprobados: no se entregan descripción/autor del examen, autor de indicación ni aula/horario ausentes del DTO. Acceso desde contenido de `/alumno` por instrucción de conservar sidebar.

Changelog aditivo: HU-E-08 implementada después del merge E11 (#224); las interfaces de otros modos permanecen compatibles.

## 1. Visión General

> **Revisión 2 (Sprint 3).** Los dos registros inmutables y la vista de solo lectura siguen siendo la base. Se suman: la asistencia por alumno dentro de la clase dictada (2.6), la pestaña «Clases» del alumno (2.7), las observaciones de la clase (2.8), las indicaciones académicas (2.9), la corrección y anulación de exámenes y de clases dictadas (2.10 y 2.11) y «Mi historial» del alumno (2.12). «No hay pantalla nueva de este módulo» queda superado por el mapa del Sprint 3 (P-12, P-26, P-27, M-22 y M-23); E-01 y E-06 siguen siendo acciones. Todo es aditivo: ningún contrato de Sprint 2 cambia, salvo el alcance del Profesor que manda la convención 8 (g) del backlog (T1).


El Módulo E registra los hechos académicos de un alumno y los muestra como una línea de tiempo. Gestiona dos registros **inmutables** y una vista de solo lectura:

1. **`ClaseDictada`** — constancia de que un turno se dictó, con la lista de alumnos que estaban inscriptos en ese momento. Se dispara **desde el Detalle de turno** (mapa de pantallas §2), no desde la ficha del alumno.
2. **`ResultadoExamen`** — la nota de un alumno en una materia. Se dispara **desde la ficha del alumno**, dentro del tab "Historial académico": un examen no está atado a un turno puntual.
3. **Historial académico** — vista de solo lectura del mismo tab, con ambos registros en una única línea de tiempo por fecha, filtrable por materia.

**Pantallas (mapa de pantallas):** no hay pantalla nueva de este módulo. E-01 es una acción (`AlertDialog`, sin campos) del Detalle de turno; E-06 es una acción (`Dialog`) del tab; E-05 es el tab "Historial académico" de la ficha del alumno (`/alumnos/[id]`).

Implementación estándar: Route Handlers delgados que delegan en `src/server/historial/clase-dictada.service.ts`, `resultado-examen.service.ts` y `historial.service.ts` (Reglas N.° 4 y 11). Como en Turnos, el frontend llama directamente a los Route Handlers; no se crea `actions.ts` sin uso.

**Alcance de esta revisión:** módulo nuevo de Sprint 2; todas las secciones (2.1 a 2.4 y 3.1 a 3.5) son nuevas y aditivas. No hay secciones preexistentes, por lo que no se renumera nada (criterio de `docs/adicionales/sdd-metodologia.md`); las revisiones futuras (p. ej. la HU de corrección de Sprint 3, Q7e) se agregarán como secciones nuevas al final de la §2.

---

## 2. Interfaces y Contratos

### Convenciones generales

> **Revisión 2.** Los permisos de la tabla siguen y se suman los de 2.5.2. **El alcance del Profesor descrito en el tercer punto cambia por la convención 8 (g) del backlog (T1):** pasa de «alumnos que atendió» (Q7b, `profesorAtendioAlumno`) a `profesorPuedeVerHistorial(profesorId, alumnoId, materiaId)` (2.5.3): acceso solo desde el detalle de una clase suya y solo en la materia de esa clase. Las frases «el Profesor ve el historial completo (todas las clases y exámenes, de cualquier materia y de cualquier profesor)» y «registra exámenes de cualquier materia que el alumno haya cursado» valen ahora **dentro de la materia de la clase**. Se conservan: el profesor efectivo sale siempre de la sesión, el `403 SIN_PERMISO` que no revela si el alumno existe y el chequeo de alcance **antes** que el de existencia. Los archivos nuevos siguen la Regla N.° 11 (`clases-alumno.service.ts`, `observacion-clase.service.ts`, `indicacion.service.ts`, `alcance-profesor.ts`, `valor-vigente.ts`).

- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los ids de `ClaseDictada`, `ResultadoExamen`, `Alumno`, `Profesor` y `Materia` son CUID. **El `id` del turno en la URL no se valida como CUID** (ids de seed `seed-turno-NN`); un id inexistente responde `404`.
- Toda ruta requiere `withPermission("<recurso>:<accion>")` (Regla N.° 10). Permisos nuevos (matriz completa en `spec_modulo_A.md` §2.4):

| Permiso | Roles | Uso |
|---|---|---|
| `clases:registrar` | MESA_ENTRADA, PROFESOR | 2.1 |
| `examenes:registrar` | MESA_ENTRADA, PROFESOR | 2.2 |
| `historial:leer` | MESA_ENTRADA, GERENTE, PROFESOR | 2.3 |

- **Alcance del profesor (resuelto siempre en el servidor, nunca por parámetro):** el profesor efectivo se obtiene de la sesión con `obtenerOpcionProfesorDeUsuario()` (Módulo D). Sobre `clases:registrar`, un profesor solo opera sus **propios turnos**. Sobre `examenes:registrar` y `historial:leer`, un profesor solo opera **alumnos que atendió**, es decir, con al menos una `ClaseDictada` a su nombre que incluya al alumno. Se resuelve con `profesorAtendioAlumno(profesorId, alumnoId)` (§2.4). Fuera de ese alcance: `403 SIN_PERMISO`, sin revelar si el alumno existe: para el Profesor el chequeo de alcance va **antes** que el de existencia, de modo que un alumno inexistente y uno no atendido responden lo mismo. **No hay recorte por rol más allá de este alcance sobre alumnos:** dentro de un alumno atendido, el Profesor ve el historial completo (todas las clases y exámenes, de cualquier materia y de cualquier profesor) y registra exámenes de cualquier materia que el alumno haya cursado. **Q7b:** el PO ratificó (29/09/2026) que el Profesor **ve** el historial solo de alumnos que atendió. **Ratificado por el PO (29/09/2026):** el Profesor también **registra exámenes** (HU-E-06) solo a alumnos que atendió.
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/historial.types.ts`, services en `src/server/historial/<archivo>.service.ts` (`clase-dictada`, `resultado-examen`, `historial`) y schemas Zod en `src/server/historial/*.schema.ts`; no hay `src/server/historial/actions.ts` porque el frontend llama a los Route Handlers (ver §1). Imports siempre con el alias `@/`. Route Handlers en `app/api/turnos/[id]/clase-dictada/route.ts`, `app/api/alumnos/[id]/examenes/**` y `app/api/alumnos/[id]/historial/route.ts`.

---

### 2.1. Registrar clase dictada (HU-E-01)

> **Revisión 2.** Ruta, método, **pedido sin cuerpo** y `code` **sin cambios**; el `201`/`200` conserva sus campos (`id`, `turno_id`, `fecha`, `alumnos_registrados`, `ya_existia`) y suma tres (2.6.2). Q7c y el paso 4 (registro recién cuando la clase terminó, `CLASE_NO_FINALIZADA`) **se conservan** (T2). Sin cuerpo, la clase queda sin control de asistencia, igual que hoy (T4); con `asistencias` (HU-E-09), se guarda la asistencia en la misma transacción (2.6). Por dentro cambian, sin efecto visible: el `FOR SHARE` del paso 1 pasa a `bloquear` con `marcarVencidas` (T9); el `ON CONFLICT ("turnoId")` del paso 5 pasa a la forma del índice único parcial (T3); el paso 6 copia las inscripciones vigentes (T10). Las respuestas del `GET` suman campos (2.6.3).


**Ruta:** `POST /api/turnos/[id]/clase-dictada` (sin body) · `GET` de la misma ruta devuelve el registro existente.
**Server Action equivalente:** — (solo Route Handler; el módulo no define `actions.ts`, ver §1)
**Servicio:** `src/server/historial/clase-dictada.service.ts` → `registrarClaseDictada()`
**Permiso requerido:** `clases:registrar`
**Presentación:** `AlertDialog` de confirmación simple, sin campos, en el Detalle de turno; toast "Clase dictada registrada correctamente" (texto definido por esta spec: la HU no lo fija; mapa de pantallas §4, `DESIGN.md` §6.1).

**Comportamiento esperado, dentro de una única `prisma.$transaction`:**
1. Bloquear y leer el turno con `bloquearTurnoParaOperacion(turnoId, tx)` (`spec_modulo_C.md` §2.15, `FOR SHARE`). Si no existe: `404 TURNO_NO_ENCONTRADO`.
2. **Alcance por rol:** si el rol es `PROFESOR` y `turno.profesor_id` no es el profesor efectivo: `403 SIN_PERMISO`.
3. El turno debe estar `DISPONIBLE` o `COMPLETO`; si no (`PENDIENTE` o `CANCELADO`): `409 TURNO_NO_ADMITE_CLASE` (AC1).
4. **Momento y condición de `registrar_clase` (definición única).** La acción `registrar_clase` está disponible —tanto en `acciones_habilitadas` del detalle de turno (`spec_modulo_C.md` §2.4, que **referencia** esta condición y no la redefine) como en este servicio— si y solo si se cumplen **las cuatro** condiciones siguientes:
   - (a) el turno está `DISPONIBLE` o `COMPLETO` (paso 3);
   - (b) el turno **ya terminó**: `fecha + hora_fin ≤ ahora`, en `America/Argentina/Buenos_Aires`;
   - (c) el turno **todavía no tiene** una clase dictada (paso 5);
   - (d) si el rol es `PROFESOR`, el turno es **propio** (paso 2).

   Si (b) no se cumple, el servicio responde `409 CLASE_NO_FINALIZADA`. Si (c) no se cumple, el `POST` no falla: devuelve el registro existente (paso 5) y la UI no ofrece la acción. **Divergencia respecto de la letra del AC1, ratificada por el PO (29/09/2026) — Q7c:** el backlog dice "cuya fecha/hora ya pasó" y esta spec toma el **fin** del turno y no su inicio, porque registrar como dictada una clase que sigue en curso no tiene sentido. Consecuencia conocida: entre el inicio y el fin del turno, aunque `spec_modulo_C.md` §3.8 ya lo considera vencido y congela sus inscripciones, la clase todavía no puede registrarse.
5. **Una sola clase por turno (AC3), sin duplicar bajo concurrencia:**
   ```sql
   INSERT INTO clases_dictadas ("idClaseDictada", "turnoId", ...) VALUES (...)
   ON CONFLICT ("turnoId") DO NOTHING;   -- $executeRaw parametrizado
   ```
   No se usa `create` + captura de `P2002`: dentro de una transacción de PostgreSQL, un error de constraint la deja abortada. Si `ON CONFLICT` no insertó (0 filas), se lee y devuelve el registro existente con `ya_existia: true` (AC3, "muestra el registro ya existente").
6. Si se insertó, copiar la **lista de alumnos inscriptos en ese momento** (`turno.alumno_ids`) como filas de `ClaseDictadaAlumno`, en la misma transacción. Es una **copia**, no una referencia viva al turno: el historial no cambia si después se edita la inscripción del turno. Un turno sin inscriptos igual puede registrarse (la lista queda vacía); no se inventa una restricción que el backlog no pide.
7. Copiar también `fechaClaseDictada`, `materiaId` y `profesorId` del turno (AC2): son la fotografía del hecho.

**Modelo (nuevo en `schema.prisma`):**
```prisma
model ClaseDictada {
  idClaseDictada        String   @id @default(cuid())
  turnoId               String   @unique               // una sola clase por turno (AC3)
  fechaClaseDictada     DateTime @db.Date
  materiaId             String
  profesorId            String
  createdAtClaseDictada DateTime @default(now())        // Regla N.° 2, opción (a)
  creadoPorUsuarioId    String?
  turno    Turno    @relation(fields: [turnoId], references: [idTurno])
  materia  Materia  @relation(fields: [materiaId], references: [idMateria])
  profesor Profesor @relation(fields: [profesorId], references: [idProfesor])
  alumnos  ClaseDictadaAlumno[]
  @@map("clases_dictadas")
}

model ClaseDictadaAlumno {
  claseDictadaId String
  alumnoId       String
  clase  ClaseDictada @relation(fields: [claseDictadaId], references: [idClaseDictada])
  alumno Alumno       @relation(fields: [alumnoId], references: [idAlumno])
  @@id([claseDictadaId, alumnoId])
  @@index([alumnoId])
  @@map("clases_dictadas_alumnos")
}
```
`Turno`, `Materia`, `Profesor` y `Alumno` agregan la relación inversa. Todas las FK son `RESTRICT`: un historial nunca se pierde (Regla N.° 1).

**Respuesta `201 Created` (o `200 OK` si ya existía):**
```json
{ "data": { "id": "cuid", "turno_id": "seed-turno-26", "fecha": "2026-09-25", "alumnos_registrados": 8, "ya_existia": false }, "error": null }
```

**Errores esperados:** `403 SIN_PERMISO` · `404 TURNO_NO_ENCONTRADO` · `409 TURNO_NO_ADMITE_CLASE` · `409 CLASE_NO_FINALIZADA`.

**`GET` (registro existente):** permiso `historial:leer`. Lee la `ClaseDictada` por `turnoId` sin consultar el turno: si no existe, `404 CLASE_NO_REGISTRADA` (también para un `turnoId` inexistente); si el rol es `PROFESOR` y `ClaseDictada.profesorId` no es el profesor efectivo, `403 SIN_PERMISO` (alcance por turno propio). Responde `200` con `{ id, registrada_en, registrada_por, alumnos: [{ id, nombre_completo }] }`. Fuentes de los datos (este módulo no consulta `usuarios` ni `alumnos`, Regla N.° 3):
- `registrada_por`: el **email** de la cuenta `creadoPorUsuarioId`, vía `obtenerEmailDeUsuario()` (`spec_modulo_A.md`, la misma que usa Turnos para `creado_por`); `null` si la cuenta no existe.
- `alumnos`: los ids de `ClaseDictadaAlumno` resueltos en lote con `obtenerAlumnosBasicos(ids)` (`spec_modulo_B.md` §2.8); `nombre_completo` es `"Apellido, Nombre"` y la lista va ordenada alfabéticamente por ese valor.

---

### 2.2. Registrar resultado de examen (HU-E-06)

> **Revisión 2.** Ruta, cuerpo, respuesta, `code` (incluido el `422 NOTA_FUERA_DE_RANGO`) y opciones **sin cambios**. **Único cambio, para el Profesor (T1, convención 8 g):** el paso 1 usa `profesorPuedeVerHistorial(profesorEfectivo.id, alumnoId, materia_id)` en lugar de `profesorAtendioAlumno`, con `403 SIN_PERMISO` antes de la existencia; solo registra en la materia de su clase, y `listarOpcionesExamen` le ofrece únicamente las materias que cursó el alumno y que su alcance admite (en la práctica, la de su clase). «Materia cursada» (paso 2) deja de contar las clases dictadas **anuladas** (HU-E-04, criterio 2: «mismo criterio que HU-E-06»); sin anulaciones es idéntico. Corregir y anular un resultado es 2.10; `ResultadoExamen` sigue sin actualizarse.


**Ruta:** `POST /api/alumnos/[id]/examenes`
**Ruta de opciones:** `GET /api/alumnos/[id]/examenes/opciones` — devuelve `{ materias: [{ id, nombre }], escala: { min, max } }` (comportamiento en «Opciones del formulario», más abajo).
**Server Action equivalente:** — (solo Route Handler; el módulo no define `actions.ts`, ver §1)
**Servicio:** `src/server/historial/resultado-examen.service.ts` → `registrarResultadoExamen()`, `listarOpcionesExamen()`
**Permiso requerido:** `examenes:registrar`
**Presentación:** `Dialog` «Registrar resultado de examen» (mismo literal que el AC1 de HU-E-06) sobre el tab "Historial académico" de la ficha del alumno; al abrirlo pide `GET …/examenes/opciones` para poblar el selector de Materia y la escala; incluye Observaciones opcionales; toast "Resultado registrado correctamente".

```typescript
// src/server/historial/resultado-examen.schema.ts
export const RegistrarResultadoExamenSchema = z.object({
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  fecha_examen: fechaCalendarioValidaSchema,        // utilidad compartida, spec_modulo_B.md §2.1
  // Número con punto decimal, como string, hasta 1 decimal. El frontend normaliza la coma decimal (es-AR, «8,5»)
  // a punto antes de enviar, igual que el monto en spec_modulo_I.md §2.4. La regex admite hasta 3 dígitos enteros
  // («100.0»); el rango lo rechaza el servicio con NOTA_FUERA_DE_RANGO.
  nota: z.string().trim().regex(/^\d{1,3}(\.\d)?$/, "La nota debe ser un número con hasta 1 decimal"),
  observaciones: z.string().trim().optional(), // texto libre opcional que aparece debajo del examen en el historial
}).strict();
export type RegistrarResultadoExamenInput = z.infer<typeof RegistrarResultadoExamenSchema>;
```

`observaciones` es opcional; se recorta al guardar y una cadena vacía se persiste como `NULL`. El campo se almacena como texto en `ResultadoExamen` mediante una migración aditiva. No reemplaza ni modifica la nota.

**Comportamiento esperado (`registrarResultadoExamen`), en `prisma.$transaction`:**
1. **Alcance y alumno.** Si el rol es `PROFESOR`: `profesorAtendioAlumno(profesorEfectivo.id, alumnoId)` (§2.4); si es `false` (o el usuario no tiene ficha de profesor): `403 SIN_PERMISO`, antes de consultar la existencia. Luego `verificarAlumnoActivo(alumnoId)` (Módulo B, `spec_modulo_B.md` §2.8): `404 ALUMNO_NO_ENCONTRADO` si la ficha no existe, `409 ALUMNO_INACTIVO` si está inactiva.
2. **Materia (AC1):** el alumno debe tener **al menos una clase dictada registrada** de esa materia (existe una fila `ClaseDictadaAlumno` → `ClaseDictada.materiaId`, sin importar qué profesor la dictó). Si no: `409 MATERIA_NO_CURSADA`. No hay un chequeo de existencia de la materia ni un código de error propio: `ClaseDictada.materiaId` es una FK `RESTRICT`, así que si hay clase la materia existe, y un `materia_id` inexistente cae en `MATERIA_NO_CURSADA`. Este paso no consulta el Módulo L. Una materia dada de baja **sí** admite el registro si el alumno la cursó (el hecho ya ocurrió).
3. `fecha_examen`: fecha válida, **no futura** respecto de hoy en `America/Argentina/Buenos_Aires`: `400 FECHA_EXAMEN_FUTURA` con el mensaje «La fecha del examen no puede ser futura», validada por el servicio con el sobre de error estándar (regla de esta spec: el AC no la pide; mismo criterio que `FECHA_PAGO_FUTURA` en `spec_modulo_I.md`).
4. **Nota (AC2):** dentro del rango `[nota_minima, nota_maxima]` de `ParametroSistema` (valores `1` y `10`; **Ratificado por el PO (29/09/2026) — Q7d**). Fuera de rango: `422 NOTA_FUERA_DE_RANGO`, mensaje "La nota debe estar entre {min} y {max}".
5. **Varios resultados por materia (AC3):** nunca se reemplaza el anterior; siempre se **inserta un registro nuevo** (recuperatorios, parciales).
6. No calcula promedio ni condición (AC5).
7. `observaciones`, si se informa, se persiste con el resultado y se muestra debajo de su materia en el historial (HU-E-05); si no se informa, no aparece texto adicional.

**Modelo (nuevo en `schema.prisma`):**
```prisma
model ResultadoExamen {
  idResultadoExamen       String   @id @default(cuid())
  alumnoId                String
  materiaId               String
  fechaExamen             DateTime @db.Date
  notaExamen              Decimal  @db.Decimal(4, 1)
  observaciones           String?  @db.Text
  createdAtResultadoExamen DateTime @default(now())    // Regla N.° 2, opción (a)
  creadoPorUsuarioId      String?
  alumno  Alumno  @relation(fields: [alumnoId], references: [idAlumno])
  materia Materia @relation(fields: [materiaId], references: [idMateria])
  @@index([alumnoId, fechaExamen])
  @@map("resultados_examen")
}
```
Sin `updatedAt...`: no se actualiza (§3.1).

**Parámetros nuevos** (`ParametroSistema`): `nota_minima = 1`, `nota_maxima = 10`.

**Respuesta `201 Created`:** `{ "data": { "id": "cuid", "alumno_id": "cuid", "materia_id": "cuid", "fecha_examen": "2026-09-27", "nota": "8.5", "observaciones": "Parcial de funciones" }, "error": null }`. Sin observaciones devuelve `"observaciones": null`.

**Errores esperados:** `400` (validación) · `403 SIN_PERMISO` · `404 ALUMNO_NO_ENCONTRADO` · `409 ALUMNO_INACTIVO` · `409 MATERIA_NO_CURSADA` · `422 NOTA_FUERA_DE_RANGO`.

**Opciones del formulario (`listarOpcionesExamen()`, `GET /api/alumnos/[id]/examenes/opciones`, HU-E-06 AC1).** Permiso `examenes:registrar`. Comportamiento:
1. **Alcance y alumno**, igual que el paso 1 del `POST`: Profesor sin haber atendido al alumno (o sin ficha de profesor) → `403 SIN_PERMISO`; ficha inexistente → `404 ALUMNO_NO_ENCONTRADO`; ficha inactiva → `409 ALUMNO_INACTIVO` (no se puede registrar a un alumno inactivo, así que tampoco se ofrecen opciones).
2. **Materias:** las materias **distintas** de las `ClaseDictada` en las que el alumno figura en `ClaseDictadaAlumno` (al menos una clase dictada registrada). Es exactamente el criterio del paso 2 del `POST`, de modo que toda materia ofrecida es aceptada al guardar. No se recorta por profesor ni por rol.
3. Los nombres se resuelven en lote con `obtenerMateriasPorIds()` (Módulo L). **Se incluyen las materias dadas de baja** que el alumno cursó (el hecho ya ocurrió). Orden alfabético por nombre.
4. `escala`: `{ min, max }` numéricos leídos de `ParametroSistema` (`nota_minima`, `nota_maxima`) con el lector de parámetros del proyecto (forma exacta: a confirmar contra el código).
5. Un alumno sin ninguna clase dictada responde `200` con `materias: []`; la UI muestra "Este alumno todavía no cursó ninguna materia" y deshabilita el guardado.

**Nota sobre el `422`:** `NOTA_FUERA_DE_RANGO` es el **único** `422` del proyecto (el resto de las reglas de negocio usa `400` o `409`). Es la **excepción de convención** del proyecto y queda a la espera de registrarse en `docs/RULES.md` (tarea de repositorio); no es una decisión abierta de esta spec.

**Dónde registra el Profesor (Q13):** el tab «Historial académico» de `/alumnos/[id]` se abre con `alumnos:leer` **o** `historial:leer` (2.3). El botón «Registrar resultado de examen» aparece en ese tab cuando el rol tiene `examenes:registrar` (Mesa de Entrada y Profesor, este último acotado a alumnos que atendió, Q7b). Como el Gerente no tiene `examenes:registrar`, no ve el botón.

---

### 2.3. Ver historial académico del alumno (HU-E-05)

> **Revisión 2.** Ruta, parámetros, paginación, `materias_disponibles` y `code` **sin cambios**; el detalle está en 2.12.1. La respuesta suma `asistencia_por_materia` y, por ítem, `id`, `asistencia`, `observacion`, `corregido`, `anulado` y `puede_corregir`, y un tipo de ítem nuevo, `INDICACION`. No figuran las clases dictadas anuladas (HU-E-11) y los exámenes se muestran con su valor vigente (2.10). **Profesor (T1):** el párrafo «Acceso a la pantalla» y la «Visibilidad del enlace por rol» se resuelven con 8 (g): `materia_id` obligatorio, solo esa materia, y el enlace «Ver historial» del detalle de **su propia clase** lo calcula C sin llamar a E (T6, 2.5.3); el `403` se mantiene como defensa. El Gerente ve la ficha completa en modo consulta (T7).


**Ruta:** `GET /api/alumnos/[id]/historial`
**Server Action equivalente:** — (solo Route Handler; el módulo no define `actions.ts`, ver §1)
**Servicio:** `src/server/historial/historial.service.ts` → `obtenerHistorialAlumno()`
**Permiso requerido:** `historial:leer` (Mesa de Entrada, Gerente y Profesor, este último con el alcance de las convenciones)

```typescript
export const HistorialQuerySchema = z.object({
  materia_id: z.string().trim().min(1).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(10).default(10), // HU-E-05 AC6 (backlog del 28/09): de a 10
});
```

**Comportamiento esperado:**
1. **Alcance y alumno.** Alcance de profesor: `403 SIN_PERMISO` (primero, sin revelar si el alumno existe). Luego alumno existente (`404 ALUMNO_NO_ENCONTRADO`). Un alumno inactivo **sí** tiene historial visible.
2. Combinar en **una sola consulta** los dos tipos de registro y paginarla (`$queryRaw` parametrizado con `UNION ALL`, ordenado por `fecha` descendente y `createdAt` descendente como desempate): las **clases dictadas** en las que el alumno figura en `ClaseDictadaAlumno` y sus **resultados de examen**. Paginar cada tipo por separado y mezclarlos rompería el orden. Filtro opcional `materia_id` (AC3).
   - **Materias del filtro (AC3):** la misma respuesta trae `materias_disponibles`, las materias distintas que aparecen en el historial del alumno, calculadas **sin aplicar** `materia_id`. No hay recorte por rol más allá del alcance sobre alumnos (ver convenciones): el Profesor que puede abrir a un alumno ve todo su historial, así que sus `materias_disponibles` son las de todo el historial del alumno y resueltas con `obtenerMateriasPorIds()`. El filtro no depende de `GET /alumnos/[id]/examenes/opciones`, que exige `examenes:registrar` y el Gerente no lo tiene.
3. Con la página ya resuelta, completar nombres en lote con los servicios públicos: `obtenerMateriasPorIds()` (Módulo L) y `obtenerNombresProfesores()` (Módulo D). Este módulo no consulta esas tablas.
4. Cada clase dictada: `fecha`, `materia`, `profesor`, `turno_id`. Cada examen: `fecha`, `materia`, `nota` y `observaciones` (AC2 y mockup, observaciones nullable). La UI presenta las observaciones debajo de la materia cuando existan. El campo `tipo` (`"CLASE_DICTADA" | "EXAMEN"`) permite que la UI los distinga **con texto o ícono, no solo color**.
5. Sin registros: `200` con `items: []`; la UI muestra "Este alumno todavía no tiene historial académico" (AC4).
6. **Solo consulta:** las altas viven en sus propios puntos de entrada (2.1 y 2.2), no acá (AC5).

**Respuesta `200 OK`:**
```json
{
  "data": {
    "alumno": { "id": "cuid", "nombre_completo": "Pérez, Ana" },
    "materias_disponibles": [{ "id": "cuid", "nombre": "Matemática" }],
    "items": [
      { "tipo": "EXAMEN", "fecha": "2026-09-27", "materia": { "id": "cuid", "nombre": "Matemática" }, "nota": "8.5", "observaciones": "Parcial de funciones" },
      { "tipo": "CLASE_DICTADA", "fecha": "2026-09-25", "materia": { "id": "cuid", "nombre": "Matemática" }, "profesor": "Giménez, Laura", "turno_id": "seed-turno-26" }
    ],
    "paginacion": { "total": 2, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 10 }
  },
  "error": null
}
```

**Errores esperados:** `400` (validación Zod de la query, con `flatten()`) · `403 SIN_PERMISO` · `404 ALUMNO_NO_ENCONTRADO`.

**Paginación (HU-E-05 AC6, backlog del 28/09):** la lista se muestra **de a 10 registros por página**. Al cambiar el filtro por Materia la UI vuelve a pedir `pagina=1`, y se pagina **sobre el resultado ya filtrado** (el filtro se aplica dentro de la consulta unificada, antes de paginar; ver paso 2). Con 10 registros o menos la UI **no muestra la paginación**. `paginacion.total` es el total del resultado filtrado.

**Acceso a la pantalla (Q13, aprobado el 29/09/2026):** el tab vive en `/alumnos/[id]`, pero `alumnos:leer` es exclusivo de Mesa de Entrada (`seed.ts`) y el Gerente y el Profesor **no pueden abrir la ficha ni el listado de alumnos**. Contractualizado: la página de la ficha admite `alumnos:leer` **o** `historial:leer`; con solo `historial:leer` se muestra únicamente el tab "Historial académico" y **nunca** se piden los datos de contacto (`GET /api/alumnos/[id]` sigue exigiendo `alumnos:leer`). El punto de entrada del Gerente y del Profesor es el **Detalle de turno**: cada alumno inscripto lleva el enlace "Ver historial" cuando el detalle le marca `puede_ver_historial: true`. **Ratificado por el PO (29/09/2026) — Q13.** *Nota:* ese enlace no figura en ningún criterio de aceptación del backlog y el PO aprobó Q13 sin agregar uno; se implementa como parte del Detalle de turno (HU-C-09) y queda registrado como excepción al backlog.

**Visibilidad del enlace por rol (decisión de diseño de esta spec):** un Profesor solo puede abrir el historial de alumnos que atendió (Q7b); ofrecerle el enlace para cualquier inscripto lo llevaría a un `403 SIN_PERMISO`. Por eso `spec_modulo_C.md` §2.4 agrega a cada elemento de `alumnos[]` del detalle de turno el booleano `puede_ver_historial`, calculado así: Mesa de Entrada y Gerente (roles con `historial:leer` sin recorte) → `true`; Profesor → el resultado de `profesorAtendioAlumno(profesorEfectivo.id, alumno.id)` (§2.4); cualquier otro rol → `false`. La UI muestra el enlace solo si es `true`. Consecuencia aceptada: un Profesor no ve el enlace de un inscripto al que todavía no le registró ninguna clase dictada (incluida la del propio turno hasta que la registre). El `403` de `GET /api/alumnos/[id]/historial` se mantiene como defensa ante una URL escrita a mano.

---

### 2.4. Servicios públicos del módulo

> **Revisión 2.** `obtenerClaseDictadaDeTurno` y `profesorAtendioAlumno` conservan **firma y forma del resultado**; ambas ignoran las clases dictadas anuladas, y la segunda ya no es la regla de alcance (T6), pero **se conserva** exportada y con sus tests. Las funciones nuevas están en 2.13. El archivo sigue sin importar nada de otros módulos.


Conforme a la Regla N.° 3: se declaran en `src/server/historial/historial.publico.ts`. **No importa nada de otros módulos** (evita ciclos con Turnos).

| Función | Devuelve | Consumidores |
|---|---|---|
| `obtenerClaseDictadaDeTurno(turnoId, db?)` | `{ id, registrada_en, alumnos_registrados } \| null` | `spec_modulo_C.md` §2.4: el detalle del turno indica si ya tiene clase dictada (condición (c) de 2.1 paso 4). C expone en `clase_dictada` solo `{ id, registrada_en }`: descarta `alumnos_registrados`, que el detalle no necesita porque ya lista a los inscriptos |
| `profesorAtendioAlumno(profesorId, alumnoId, db?)` | `boolean`: `true` si existe al menos una `ClaseDictada` de `profesorId` que incluya a `alumnoId` en `ClaseDictadaAlumno` | `spec_modulo_C.md` §2.4: calcula `puede_ver_historial` por inscripto cuando el rol es `PROFESOR` (2.3). Es la misma regla de alcance que aplican 2.2 y 2.3 |

La condición de `registrar_clase` que C evalúa para `acciones_habilitadas` es la de 2.1 paso 4; E no expone una función para ella porque sus datos (estado, fecha, hora de fin, profesor del turno) son del turno y ya los tiene C.

---

### 2.5. Modelo, permisos y alcance del Sprint 3 (convenciones 8 d, 8 g e 8 i) — NUEVA en Revisión 2

> **Revisión 2 (nueva).** Esta sección reúne lo que comparten las secciones 2.6 a 2.12. Nada de lo que define reemplaza un contrato de 2.1 a 2.4.

#### 2.5.1. Modelo que crea el PR 0 (R2-PR0-1)

Las HU no agregan migraciones (convención 8 i): el esquema lo crea el PR 0 (`PR-0.md` §2.8 y §2.14). Los nombres de abajo son la propuesta de esta spec; lo que importa es la **forma** (columnas, claves y unicidades). Todo es **aditivo**: no se quita ni se renombra ninguna columna de `ClaseDictada`, `ClaseDictadaAlumno` ni `ResultadoExamen`.

```prisma
enum EstadoAsistencia { PRESENTE AUSENTE }

model ClaseDictada {
  // …columnas de Sprint 2, sin cambios…
  // turnoId deja de ser @unique: la unicidad pasa al índice parcial de abajo (PR-0.md §2.8)
  conControlAsistencia Boolean   @default(false)   // fijada al crear el registro (2.6)
  anuladaEl            DateTime?                   // marca de anulación (2.11.3)
  anuladaPor           String?                     // usuario que anuló
  motivoAnulacion      String?   @db.VarChar(300)
  turno          Turno @relation(fields: [turnoId], references: [idTurno])   // relación 1:N: Turno.clasesDictadas
  correcciones   CorreccionAsistencia[]
  observacion    ObservacionClase?
  indicaciones   Indicacion[]
  @@index([turnoId])
  @@index([profesorId, materiaId])
  // SQL de la migración (Prisma no modela índices parciales):
  // CREATE UNIQUE INDEX "clases_dictadas_turno_no_anulada_key" ON "clases_dictadas" ("turnoId") WHERE "anuladaEl" IS NULL;
}

model ClaseDictadaAlumno {
  // …columnas de Sprint 2, sin cambios (la clave sigue siendo claseDictadaId + alumnoId)…
  estadoAsistencia EstadoAsistencia?   // null = registrada sin control de asistencia (Sprint 2 o flujo sin cuerpo)
}

// HU-E-11, criterio 2: la corrección es un registro nuevo con su propia marca (Regla N.° 8)
model CorreccionAsistencia {
  idCorreccionAsistencia String   @id @default(cuid())
  claseDictadaId         String
  motivo                 String   @db.VarChar(300)
  conControlAsistencia   Boolean  @default(true)    // toda corrección deja la clase con control
  createdAtCorreccion    DateTime @default(now())
  creadoPorUsuarioId     String?
  clase    ClaseDictada @relation(fields: [claseDictadaId], references: [idClaseDictada])
  alumnos  CorreccionAsistenciaAlumno[]
  @@index([claseDictadaId, createdAtCorreccion])
}
model CorreccionAsistenciaAlumno {
  correccionId   String
  alumnoId       String
  estadoAnterior EstadoAsistencia?     // valor vigente antes de la corrección (null si la clase no tenía control)
  estadoNuevo    EstadoAsistencia
  @@id([correccionId, alumnoId])
}

// HU-E-07: una observación por registro de clase dictada
model ObservacionClase {
  idObservacionClase    String   @id @default(cuid())
  claseDictadaId        String   @unique
  temasVistos           String   @db.VarChar(1000)
  observacionesInternas String?  @db.VarChar(1000)
  createdAtObservacion  DateTime @default(now())
  creadoPorUsuarioId    String?
}

// HU-E-04
model Indicacion {
  idIndicacion         String   @id @default(cuid())
  alumnoId             String
  materiaId            String
  claseDictadaId       String?               // vínculo opcional; se conserva si la clase se anula (se oculta al leer)
  texto                String   @db.VarChar(1000)
  createdAtIndicacion  DateTime @default(now())
  creadoPorUsuarioId   String?
  @@index([alumnoId, materiaId, createdAtIndicacion])
}

// HU-E-10: el ResultadoExamen original no se toca
model CorreccionResultadoExamen {
  idCorreccionResultado String   @id @default(cuid())
  resultadoExamenId     String
  fechaAnterior         DateTime @db.Date
  notaAnterior          Decimal  @db.Decimal(4, 1)
  fechaNueva            DateTime @db.Date
  notaNueva             Decimal  @db.Decimal(4, 1)
  motivo                String   @db.VarChar(300)
  createdAtCorreccion   DateTime @default(now())
  creadoPorUsuarioId    String?
  @@index([resultadoExamenId, createdAtCorreccion])
}
model AnulacionResultadoExamen {
  idAnulacionResultado  String   @id @default(cuid())
  resultadoExamenId     String   @unique       // se anula una sola vez
  motivo                String   @db.VarChar(300)
  createdAtAnulacion    DateTime @default(now())
  creadoPorUsuarioId    String?
}
```

Todas las claves foráneas son `RESTRICT` (Regla N.° 1: un historial nunca se pierde). Los registros de arriba no tienen `updatedAt…`: no se actualizan (3.1, con la única excepción de la marca de anulación de la clase, T3). Las tablas siguen el mapeo de nombres de `schema.prisma` (`@@map`, snake_case plural).

#### 2.5.2. Permisos

Todo Route Handler nuevo usa `withPermission("<recurso>:<accion>")` con **un solo** permiso (Regla N.° 10). Los nombres nuevos son una propuesta para la tabla cerrada del PR 0 (P-E12); la matriz completa va en `spec_modulo_A.md` §2.4.

| Permiso | Roles | Uso | Estado |
|---|---|---|---|
| `clases:registrar` | MESA_ENTRADA, PROFESOR | 2.1 y 2.6 | Existente, sin cambios |
| `examenes:registrar` | MESA_ENTRADA, PROFESOR | 2.2 | Existente, sin cambios |
| `historial:leer` | MESA_ENTRADA, GERENTE, PROFESOR | 2.3 y el `GET` de 2.1/2.6 | Existente, sin cambios. El Profesor lo conserva y su alcance pasa a ser el de 2.5.3 |
| `alumnos:leer` | MESA_ENTRADA, GERENTE | 2.7 (pestaña Clases) | Existente. **Convención 8 (d):** se le da al Gerente (modo consulta). **Convención 8 (g):** se le quita al Profesor, en el mismo cambio en que se agrega su acceso acotado (`PR-0.md` §2.9) |
| `observaciones:registrar` | MESA_ENTRADA, PROFESOR | 2.8 | Propuesto |
| `indicaciones:registrar` | MESA_ENTRADA, PROFESOR | 2.9 | Propuesto |
| `examenes:corregir` | MESA_ENTRADA, PROFESOR | 2.10 (corregir y anular) | Propuesto |
| `clases:corregir` | MESA_ENTRADA, PROFESOR | 2.11 (corregir asistencia y anular el registro) | Propuesto |
| `historial:leer_propio` | ALUMNO | 2.12 | Propuesto |

El Gerente **no** recibe ninguna acción de escritura de este módulo (HU-E-02, criterio 8: «no edita datos»): toda escritura del Gerente responde `403 SIN_PERMISO`. El Profesor opera dentro del alcance de 2.5.3 y, en 2.10 y 2.11, además dentro del plazo de 3.9.

#### 2.5.3. Alcance del Profesor (convención 8 g)

El profesor efectivo se obtiene siempre de la sesión con `obtenerOpcionProfesorDeUsuario()` (Módulo D); si la cuenta no tiene ficha de profesor, `403 SIN_PERMISO`. Nunca se acepta un `profesor_id` del cliente.

**`profesorPuedeVerHistorial(profesorId, alumnoId, materiaId, db?)`** — `src/server/historial/alcance-profesor.ts`, función interna del módulo (R2-PR0-4). Devuelve `true` si se cumple **alguna** de estas dos condiciones:
1. El alumno tiene una **inscripción vigente** (`esVigenteEn(inscripcion, ahora())`, incluidas las clases futuras) en una clase de ese profesor y de esa materia. Es una lectura de C: `existeInscripcionVigenteConProfesor(alumnoId, profesorId, materiaId, db?)`.
2. El alumno figura en el registro vigente de una clase dictada, **no anulada**, de ese profesor y de esa materia: `profesorPuedeRegistrarIndicacion(profesorId, alumnoId, materiaId, db?)` (2.13).

**`profesorPuedeRegistrarIndicacion(profesorId, alumnoId, materiaId, db?)`** — función pública de E (2.13). Devuelve `true` si existe al menos una `ClaseDictada` con `anuladaEl IS NULL`, con `profesorId` y `materiaId` dados, en la que el alumno figura en `ClaseDictadaAlumno` con **cualquier** estado (`PRESENTE`, `AUSENTE` o sin control, P-E9). Solo lee datos de E.

Cómo se usan:
- **Historial (2.3) y resultados de examen (2.2):** el Profesor necesita `profesorPuedeVerHistorial` para la `materia_id` pedida. Si da `false`, **`403 SIN_PERMISO` antes de consultar si el alumno existe**: un alumno inexistente y uno fuera de alcance responden igual. El `materia_id` es obligatorio para el Profesor (P-E5).
- **Indicaciones (2.9):** además, `profesorPuedeRegistrarIndicacion`.
- **Detalle de la clase (módulo C):** C marca `puede_ver_historial` para el Profesor sobre cada inscripto **vigente de una clase suya**. Eso es exactamente la condición 1 con los datos que el detalle ya tiene, así que C la resuelve por sí mismo y **no importa a E** (Regla N.° 3: ninguna fachada `*.publico.ts` importa a otra; `profesorPuedeVerHistorial` no es una función de fachada porque necesitaría a C y a E a la vez). Para Mesa de Entrada y Gerente el valor sigue siendo `true`; para cualquier otro rol, `false`. El `403` de la API es la defensa ante una URL escrita a mano.
- **`profesorAtendioAlumno`** (2.4) queda **exportada y sin cambios de firma**, pero ya no decide ningún alcance.

#### 2.5.4. Adaptación del código existente

Cambios **internos** de E (no cambian ninguna ruta, cuerpo, respuesta ni `code` de Sprint 2). El implementador los contrasta con el código real y los anota en «Decisiones tomadas» del PR de la primera HU de E que se mergee:

- `clase-dictada.service.ts`: (a) el `INSERT … ON CONFLICT ("turnoId") DO NOTHING` pasa a `ON CONFLICT ("turnoId") WHERE "anuladaEl" IS NULL DO NOTHING` (T3); (b) la lectura del registro existente filtra `anuladaEl IS NULL`; (c) `bloquearTurnoParaOperacion` pasa a `bloquear` y se llama a `marcarVencidas` (T9); (d) la copia de alumnos toma las inscripciones vigentes (T10).
- `Turno.claseDictada` pasa a `Turno.clasesDictadas` (relación 1:N, `PR-0.md` §2.0): todo `include`/`select`/`findUnique` de E por `turnoId` pasa a `findFirst` con `anuladaEl: null`. Esos usos cuentan como errores de `tsc` de 2.0.
- `historial.service.ts`: la consulta unificada excluye las clases anuladas, usa el valor vigente de los exámenes y suma las indicaciones (2.3, 3.6, 3.7).
- `resultado-examen.service.ts` y `historial.service.ts`: reemplazan `profesorAtendioAlumno` por el helper de 2.5.3.
- `obtenerClaseDictadaDeTurno` y `profesorAtendioAlumno` (fachada): filtran `anuladaEl IS NULL`. Sus tests de Sprint 2 siguen pasando: sin anulaciones el resultado es idéntico.
- **Tests:** ningún test de Sprint 2 se borra ni se debilita (`PR-0.md` §1.1, regla 3). Cambian solo los mocks de persistencia (`prisma.claseDictada.findUnique` → `findFirst`; `$executeRaw` del `ON CONFLICT`). Una aserción de contrato que cambie (el alcance del Profesor de T1) va en «Decisiones tomadas» con su motivo.

---

### 2.6. Asistencia individual al registrar la clase dictada (HU-E-09) — NUEVA en Revisión 2

> **Qué cambia y qué no.** La ruta es la de 2.1 (`POST /api/turnos/[id]/clase-dictada`) y su `GET`. El `POST` **sigue funcionando sin cuerpo**, igual que en Sprint 2 (T4); con cuerpo, guarda la asistencia de cada alumno en la misma transacción que la clase (HU-E-09, criterio 2). Los pasos 1 a 7 de 2.1 se mantienen con los cambios internos de T3, T9 y T10; lo que sigue completa el flujo.

#### 2.6.1. Pedido

**Ruta:** `POST /api/turnos/[id]/clase-dictada`
**Servicio:** `src/server/historial/clase-dictada.service.ts` → `registrarClaseDictada()` (la misma función de 2.1; firma del PR 0: `registrarClaseDictada(tx, { turnoId, actor, asistencias?: { inscripcionId, estado }[] })`)
**Permiso requerido:** `clases:registrar` (sin cambios)
**Presentación:** en el detalle de la clase, no hay formulario ni recuadro aparte: la lista de inscriptos muestra a la derecha de cada alumno vigente las opciones **Presente** y **Ausente** (todos vienen en Presente), y debajo «Registrar clase dictada» (HU-E-09, criterio 1; pedido del PO del 05/10/2026). La confirmación de HU-C-25 lleva la cantidad de presentes y ausentes. «Marcar todos ausentes / presentes» y las marcas son estado de la pantalla: no se guardan hasta confirmar (P-E1).

```typescript
// src/server/historial/clase-dictada.schema.ts
export const EstadoAsistenciaSchema = z.enum(["PRESENTE", "AUSENTE"]);

export const RegistrarClaseDictadaSchema = z.object({
  // Si viene, tiene que cubrir a TODOS los inscriptos vigentes, una vez cada uno (2.6.2 paso 6).
  asistencias: z.array(z.object({
    alumno_id: z.string().trim().min(1),
    estado: EstadoAsistenciaSchema,
  }).strict()).max(500),
}).strict();
export type RegistrarClaseDictadaInput = z.infer<typeof RegistrarClaseDictadaSchema>;
```

**Compatibilidad del cuerpo.** El Route Handler lee el cuerpo como texto: si está **vacío** (o ausente) el pedido es el de Sprint 2 y `asistencias` queda `undefined`. Si no está vacío, tiene que ser un JSON válido que cumpla el esquema: de lo contrario `400` con el `flatten()` de Zod. `asistencias: []` es válido y vale para una clase sin inscriptos vigentes (queda **con** control).

El cuerpo usa `alumno_id` y no el id de la inscripción porque el Profesor no recibe el id de la inscripción en el detalle (`spec_modulo_C.md` §2.4: esos campos son solo para quien tiene `pagos:leer`). Un alumno tiene, como máximo, una inscripción vigente por clase (índice único parcial de `PR-0.md` §2.1), así que `alumno_id` la identifica sin ambigüedad; el servicio la traduce al `inscripcionId` de la firma del PR 0.

#### 2.6.2. Comportamiento (ampliación de 2.1)

Todo en `transaccion` (PR 0; `lock_timeout` de 5 s: un bloqueo que no se obtiene responde `409 TRANSACCION_OCUPADA`).

1. **Bloqueo y lectura de la clase** (T9): `bloquear(tx, { clases: [turnoId] })` y, con la fila ya bloqueada por esta misma transacción, los datos del turno con la lectura de 2.1 (`bloquearTurnoParaOperacion`, misma forma). Si no existe: `404 TURNO_NO_ENCONTRADO`.
2. **Alcance por rol:** `PROFESOR` con un turno que no es suyo: `403 SIN_PERMISO`.
3. **Estado:** `DISPONIBLE` o `COMPLETO`; si no: `409 TURNO_NO_ADMITE_CLASE`.
4. **Fin de la clase** (Q7c, P-E1): `fecha + hora_fin ≤ ahora()`; si no: `409 CLASE_NO_FINALIZADA`.
5. **Ya registrada:** si existe una clase dictada **no anulada** del turno, responde `200` con ese registro y `ya_existia: true`, **sin validar ni usar** `asistencias`. Para cambiar la asistencia de una clase ya registrada está 2.11.
6. **Inscriptos vigentes y validación de la asistencia:** `marcarVencidas(tx, turnoId)` y, a continuación, `inscripcionesVigentes(tx, turnoId, ahora())` (C, `{ id, alumnoId }` por inscripción; R2-PR0-3). Si vino `asistencias`, el conjunto de `alumno_id` tiene que ser **igual** al de las inscripciones vigentes: ni faltantes, ni sobrantes, ni repetidos. Si no: `400 ASISTENCIA_INCOMPLETA` con `detalles: { faltan: [alumno_id], sobran: [alumno_id], repetidos: [alumno_id] }`. (Después del fin de la clase las inscripciones no cambian —las operaciones sobre una clase vencida se rechazan—, así que el conjunto que vio la pantalla es el que valida el servidor.)
7. **Alta** con la unicidad de T3, sin captura de `P2002`:
   ```sql
   INSERT INTO clases_dictadas ("idClaseDictada", "turnoId", "fechaClaseDictada", "materiaId", "profesorId",
                                "conControlAsistencia", "creadoPorUsuarioId", ...)
   VALUES (...)
   ON CONFLICT ("turnoId") WHERE "anuladaEl" IS NULL DO NOTHING;   -- $executeRaw parametrizado
   ```
   Si no insertó (0 filas: otra persona la registró en el mismo instante), se lee y devuelve el existente con `ya_existia: true`. `conControlAsistencia` es `true` si vino `asistencias` y `false` si no.
8. **Copia de los alumnos** como filas de `ClaseDictadaAlumno`, una por inscripción vigente (como hoy, T10), con `estadoAsistencia` = el estado pedido, o `NULL` si el pedido no trajo `asistencias` (la clase queda «sin control de asistencia», igual que las de Sprint 2). Es una copia, no una referencia viva (3.2).
9. Fecha, materia y profesor se copian del turno (2.1 paso 7).

Un alumno marcado **Ausente** no cambia nada más: su inscripción, su pago y su precio quedan como están, y no hay reintegro (HU-E-09, criterio 5; 3.12).

**Respuesta `201 Created` (o `200 OK` si ya existía)** — los campos de Sprint 2 no cambian; se agregan tres:
```json
{ "data": {
    "id": "cuid", "turno_id": "seed-turno-26", "fecha": "2026-09-25", "alumnos_registrados": 8, "ya_existia": false,
    "con_control_asistencia": true, "presentes": 7, "ausentes": 1
  }, "error": null }
```
`presentes` y `ausentes` son `null` cuando la clase no tiene control. En un `200` con `ya_existia: true` son los del registro existente (valor vigente, 3.6).

**Errores esperados (los de 2.1, más):** `400` (cuerpo inválido) · `400 ASISTENCIA_INCOMPLETA` · `409 TRANSACCION_OCUPADA`.

#### 2.6.3. `GET /api/turnos/[id]/clase-dictada` ampliado

Permiso `historial:leer` y alcance (el Profesor solo ve la de su turno) **sin cambios**; sigue leyendo el registro **vigente** (no anulado) por `turnoId` sin consultar el turno: si no hay, `404 CLASE_NO_REGISTRADA` (también cuando la única clase del turno está anulada: «vuelve a Sin registrar como dictada», HU-E-11, criterio 3). Los campos de Sprint 2 (`id`, `registrada_en`, `registrada_por`, `alumnos[].id`, `alumnos[].nombre_completo`) y el orden no cambian. Se agregan:

```json
{ "data": {
    "id": "cuid", "registrada_en": "2026-09-25T20:05:00Z", "registrada_por": "mesa@centro.test",
    "alumnos": [ { "id": "cuid", "nombre_completo": "Pérez, Ana", "asistencia": "PRESENTE" } ],
    "con_control_asistencia": true,
    "totales": { "presentes": 7, "ausentes": 1 },
    "ultima_correccion": { "registrada_en": "2026-09-27T14:10:00Z", "registrada_por": "mesa@centro.test", "motivo": "Se cargó mal a Pérez" },
    "observacion": { "id": "cuid", "temas_vistos": "Funciones lineales", "observaciones_internas": null,
                     "registrada_en": "2026-09-25T21:00:00Z", "registrada_por": "prof@centro.test" },
    "acciones": { "corregir_asistencia": true, "anular_registro": true, "plazo_correccion_vencido": false,
                  "registrar_observaciones": false, "registrar_indicacion": true }
  }, "error": null }
```
- `alumnos[].asistencia`: `"PRESENTE"`, `"AUSENTE"` o `null` (sin control). Es el **valor vigente** (3.6): el de la última corrección o, si no hay, el del registro original.
- `con_control_asistencia`: la marca de la última corrección o, si no hay, la del registro original. `totales` es `null` si no hay control.
- `ultima_correccion` y `observacion` son `null` si no existen. `observaciones_internas` va siempre en este `GET` (lo leen Mesa de Entrada, el Gerente y el Profesor de esa clase: HU-E-07, criterio 4). `registrada_por` es el email (`obtenerEmailDeUsuario()`), `null` si la cuenta no existe.
- `acciones` se calcula en el servidor para el rol que consulta, con `verificarPermiso` y el plazo de 3.9 (la pantalla no repite las reglas): `corregir_asistencia` y `anular_registro` (permiso `clases:corregir` y, para el Profesor, dentro del plazo); `plazo_correccion_vencido` (`true` solo para un Profesor fuera de plazo: la pantalla muestra el aviso de HU-E-11 y deja la corrección a Mesa de Entrada); `registrar_observaciones` (permiso `observaciones:registrar` y todavía no hay observación); `registrar_indicacion` (permiso `indicaciones:registrar`). El Gerente recibe todas en `false`.
- El `GET` sigue exigiendo solo `historial:leer`. El detalle de la clase (módulo C) conserva `clase_dictada: { id, registrada_en }` de `obtenerClaseDictadaDeTurno` (2.4): para pintar la asistencia, la pantalla pide este `GET`.

#### 2.6.4. Cuándo se ofrece cada cosa (definición única, para la pantalla)

La pantalla muestra **Presente / Ausente** en la lista de inscriptos si y solo si: el turno está `DISPONIBLE` o `COMPLETO`; ya **empezó** (`fecha + hora_inicio ≤ ahora`); todavía no tiene clase dictada (el detalle trae `clase_dictada: null`); el rol tiene `clases:registrar` y, si es Profesor, el turno es suyo. Solo se listan las inscripciones **vigentes**, no las canceladas, las reservas vencidas, las bajas ni las quitadas por el centro (esa exclusión ya la hace el detalle de C, `spec_modulo_C.md` §2.4). El botón «Registrar clase dictada» se habilita cuando además se cumple la condición (b) de 2.1 paso 4 (`acciones_habilitadas.registrar_clase`, sin cambios). Una vez registrada, la lista muestra «Presente» (verde) o «Ausente» (rojo) con el total, y las clases sin control se muestran como tales (HU-E-09, criterio 1); en todos los casos el estado se distingue **con texto**, no solo con color.

#### 2.6.5. Criterios de HU-E-09 y dónde se cubren

| Criterio | Dónde |
|---|---|
| 1 (lista, Presente/Ausente, «Marcar todos…», total) | 2.6.1 y 2.6.4; los datos de la lista los da C |
| 2 (misma transacción) | 2.6.2 pasos 7 y 8 |
| 3 (historial con «Asistió»/«Ausente» y porcentaje por materia) | 2.3 (nota de Revisión 2) y 2.12; `asistenciaDeAlumno` (2.13) |
| 4 (clases anteriores «sin control», fuera del porcentaje) | `estadoAsistencia NULL` (2.5.1); 3.6 |
| 5 (sin reintegro ni cambio de pagos) | 2.6.2 y 3.12 |
| 6 (corregir: HU-E-11) | 2.11 |
| Diferidos | Criterio 3 en «Mi historial» al mergear HU-E-08; criterio 1, exclusión de canceladas por el alumno al mergear HU-C-14 y de bajas al mergear HU-B-07 (las excluye `inscripcionesVigentes`) |

---

### 2.7. Historial de clases del alumno: pestaña «Clases» (HU-E-02) — NUEVA en Revisión 2

**Ruta:** `GET /api/alumnos/[id]/clases`
**Server Action equivalente:** — (solo Route Handler; el módulo no define `actions.ts`)
**Servicio:** `src/server/historial/clases-alumno.service.ts` → `listarClasesDelAlumno()`
**Permiso requerido:** `alumnos:leer` (Mesa de Entrada y Gerente, este último en modo consulta, convención 8 d). El Profesor ya no tiene `alumnos:leer`, así que recibe `403 SIN_PERMISO` (HU-E-02, criterio 8); cualquier otro rol, también. Esta ruta **no** tiene alcance de Profesor: no hay forma de que un Profesor la use.
**Presentación:** pestaña «Clases» de la ficha (`/alumnos/[id]/clases`, mapa P-26): filtros por resultado y fechas, resumen y tabla. Es de solo consulta y **no incluye montos de pago** (criterio 9; los pagos son de la pestaña Pagos, `spec_modulo_I.md`). Cada fila enlaza al detalle de la clase (criterio 6).

```typescript
// src/server/historial/clases-alumno.schema.ts
export const RESULTADOS_CLASE_ALUMNO = [
  "PROXIMA", "ASISTIO", "AUSENTE", "SIN_REGISTRAR_COMO_DICTADA", "CANCELADA_CENTRO",
  "CANCELADA_ALUMNO", "RESERVA_VENCIDA", "BAJA_ALUMNO", "QUITADA_CENTRO",
] as const;

export const ClasesAlumnoQuerySchema = z.object({
  resultado: z.enum(RESULTADOS_CLASE_ALUMNO).optional(),
  desde: fechaCalendarioValidaSchema.optional(),   // inclusive; utilidad compartida, spec_modulo_B.md §2.1
  hasta: fechaCalendarioValidaSchema.optional(),   // inclusive
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(10).default(10),   // criterio 4: de a 10
}).refine((q) => !q.desde || !q.hasta || q.desde <= q.hasta, { message: "«Desde» no puede ser posterior a «Hasta»", path: ["desde"] });
```

#### 2.7.1. Comportamiento

1. **Alumno.** `obtenerAlumnoBasico(id)` (Módulo B): `404 ALUMNO_NO_ENCONTRADO` si la ficha no existe. Un alumno **inactivo** sí tiene historial de clases (aparecen sus «Baja del alumno»).
2. **Hechos de Turnos.** `listarInscripcionesDeAlumno(alumnoId, { desde, hasta })` (C, `PR-0.md` §2.13, R2-PR0-3): **todas** las inscripciones del alumno, en cualquier vigencia, incluidas las que él canceló (criterio 1), con los datos de la clase (fecha, horario, estado, materia, profesor, aula) y los hechos de la inscripción (vigencia, `vigente_ahora`, fecha de fin y fecha de cancelación de la clase). Si el alumno canceló y se volvió a inscribir en la misma clase hay **dos filas**, una por inscripción.
3. **Hechos de Historial.** Con los `turno_id` de esas inscripciones, una sola consulta propia: la clase dictada **no anulada** de cada turno y el **estado de asistencia vigente** del alumno en ella (3.6). Este módulo no lee `turnos`, `turno_alumno` ni `materias` (Regla N.° 3).
4. **Clasificación** de cada inscripción (2.7.3), **filtros** (2.7.4), **resumen** (2.7.5), orden y **paginación** en el servicio. Se hace en memoria porque el resultado depende de datos de dos módulos que no se pueden unir en SQL (T11); un alumno tiene decenas de inscripciones, no miles.
5. Orden: fecha y hora de inicio **descendentes** (la más reciente primero), con el id de la inscripción descendente como desempate (criterio 4). Paginación de a 10; con 10 filas o menos la pantalla no muestra la paginación.

#### 2.7.2. Respuesta `200 OK`

```json
{
  "data": {
    "alumno": { "id": "cuid", "nombre_completo": "Pérez, Ana" },
    "resumen": {
      "total": 12,
      "por_resultado": { "PROXIMA": 1, "ASISTIO": 6, "AUSENTE": 1, "SIN_REGISTRAR_COMO_DICTADA": 1,
                         "CANCELADA_CENTRO": 1, "CANCELADA_ALUMNO": 1, "RESERVA_VENCIDA": 1, "BAJA_ALUMNO": 0, "QUITADA_CENTRO": 0 },
      "asistio_sin_control": 2,
      "clases_con_control": 5,
      "porcentaje_asistencia": 80
    },
    "items": [
      { "inscripcion_id": "cuid", "turno_id": "seed-turno-26", "fecha": "2026-09-25", "hora_inicio": "18:00", "hora_fin": "19:00",
        "materia": { "id": "cuid", "nombre": "Matemática" }, "profesor": "Giménez, Laura", "aula": "Aula 2",
        "resultado": "ASISTIO", "sin_control_asistencia": false }
    ],
    "paginacion": { "total": 12, "pagina_actual": 1, "total_paginas": 2, "por_pagina": 10 }
  },
  "error": null
}
```
- `por_resultado` trae **todas** las claves (con 0 si no hay). `ASISTIO` cuenta también las «Asistió (sin control de asistencia)»; `asistio_sin_control` dice cuántas de ellas son (criterio 5: el filtro «Asistió» las incluye).
- `clases_con_control` = `ASISTIO` con control + `AUSENTE`; `porcentaje_asistencia` = `ASISTIO` con control / `clases_con_control`, entero redondeado (P-E6), o `null` si `clases_con_control` es 0 (criterio 3: no cuentan las «sin control»).
- Cada item: `resultado` es uno de los nueve códigos; `sin_control_asistencia` es `true` solo cuando `resultado = "ASISTIO"` y la clase se registró sin control (la pantalla lo muestra «Asistió (sin control de asistencia)»). `profesor` es `"Apellido, Nombre"` (o `null` si la clase no tiene profesor asignado) y `aula` es el nombre (o `null`). `resultado` se presenta con **texto o ícono, no solo color** (criterio 2).
- **El resumen y el `por_resultado` se calculan sobre el resultado ya filtrado** (criterio 5, «el resumen se recalcula sobre el resultado filtrado») y **antes** de paginar; `paginacion.total` es el total filtrado.
- Sin inscripciones: `200` con `items: []`, `resumen.total = 0`; la pantalla muestra «Este alumno todavía no tiene clases registradas» (criterio 7). Filtros sin coincidencias: la misma respuesta; la pantalla muestra «No se encontraron clases para los filtros elegidos» y «Limpiar filtros» vuelve al listado completo, que conserva el orden original (criterio 5). La diferencia entre ambos textos la hace la pantalla comparando con y sin filtros (`resumen.total` del pedido sin filtros).

#### 2.7.3. Cómo se clasifica una inscripción (criterio 2)

Sea `ahora = ahora()` y `i` una inscripción que devuelve C. La **primera** regla que se cumple decide el resultado:

| # | Condición | Resultado |
|---|---|---|
| 1 | `i.vigencia = CANCELADA_ALUMNO`, `BAJA_ALUMNO` o `QUITADA_CENTRO`, o `i.vigencia = RESERVA_VENCIDA` — salvo la excepción de abajo | el mismo (`CANCELADA_ALUMNO`, `BAJA_ALUMNO`, `QUITADA_CENTRO`, `RESERVA_VENCIDA`) |
| 2 | `i.vigencia = VIGENTE` pero `i.vigente_ahora = false` (reserva sin pagar cuyo plazo ya venció y el proceso todavía no la marcó) | `RESERVA_VENCIDA` |
| 3 | La clase está `CANCELADO` | `CANCELADA_CENTRO` |
| 4 | La clase todavía no empezó (`fecha + hora_inicio > ahora`) | `PROXIMA` (una clase en curso **ya no** es próxima, convención 4) |
| 5 | Hay una clase dictada no anulada del turno y el alumno figura en ella con estado vigente `PRESENTE`, o sin control (`NULL`) | `ASISTIO` (con `sin_control_asistencia = true` si el estado es `NULL`) |
| 6 | Ídem, con estado vigente `AUSENTE` | `AUSENTE` |
| 7 | La clase ya empezó y no hay clase dictada no anulada (nunca se registró, o se anuló, HU-E-11, criterio 3) | `SIN_REGISTRAR_COMO_DICTADA` |

- **Excepción de la regla 1** (criterio 2, última viñeta): si la inscripción dejó de estar vigente **después** de que el centro cancelara la clase (`finalizada_el > cancelada_el`), el resultado es `CANCELADA_CENTRO`. Como las operaciones que finalizan una inscripción no se hacen sobre una clase cancelada, en la práctica ese caso es la baja de un alumno con una clase ya cancelada (P-E13). La regla de precedencia del criterio —«si dejó de estar vigente **antes** de la cancelación, se muestra ese resultado y no “Cancelada por el centro”»— queda así cubierta por el orden de la tabla: el estado de la inscripción gana a `CANCELADA_CENTRO`.
- Una reserva vencida sin marcar se clasifica con `esVigenteEn(inscripcion, ahora())` (el valor `vigente_ahora` que calcula C), nunca leyendo la vigencia guardada por su cuenta: es la regla única de `spec_modulo_C.md` §2.16.3.
- Un alumno que figura vigente en una clase ya iniciada pero **no** en su registro de clase dictada (no debería ocurrir: después de empezar no se puede inscribir a nadie) se clasifica por la regla 7.

#### 2.7.4. Filtros (criterio 5)

- `resultado`: un solo valor. `ASISTIO` incluye las «sin control». Se aplica sobre el resultado de 2.7.3.
- `desde` / `hasta`: sobre la **fecha de la clase**, ambos inclusivos; se mandan a C. Se pueden dar uno solo o los dos.
- Los filtros se **combinan** (AND). Al cambiar un filtro la pantalla vuelve a pedir `pagina=1` y los resultados se actualizan sin recargar. «Limpiar filtros» omite `resultado`, `desde` y `hasta`.

**Errores esperados:** `400` (validación Zod de la query, con `flatten()`) · `403 SIN_PERMISO` · `404 ALUMNO_NO_ENCONTRADO`.

#### 2.7.5. Criterios de HU-E-02 y dónde se cubren

| Criterio | Dónde |
|---|---|
| 1 (todas las inscripciones, en cualquier estado) | 2.7.1 pasos 2 y 3 |
| 2 (columnas y resultado) | 2.7.2 y 2.7.3 |
| 3 (resumen y %) | 2.7.2 |
| 4 (orden y paginación) | 2.7.1 paso 5 |
| 5 (filtros) | 2.7.4 |
| 6 (enlace al detalle) | cada item trae `turno_id` |
| 7 (sin clases) | 2.7.2 |
| 8 (acceso) | permiso `alumnos:leer`; el Gerente en consulta lo da `PR-0.md` §2.9 |
| 9 (solo consulta, sin pagos) | esta ruta no llama a Pagos |
| Diferidos | «Reserva vencida» al mergear HU-C-24; «Cancelada por el alumno» al mergear HU-C-14; «Baja del alumno» al mergear HU-B-07; «Sin registrar como dictada» tras una anulación al mergear HU-E-11; la parte de pagos de los criterios 8 y 9, al mergear HU-I-02 e HU-I-06 |

---

### 2.8. Observaciones de la clase dictada (HU-E-07) — NUEVA en Revisión 2

**Ruta:** `POST /api/turnos/[id]/clase-dictada/observaciones`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `src/server/historial/observacion-clase.service.ts` → `registrarObservacionClase()`
**Permiso requerido:** `observaciones:registrar` (Mesa de Entrada y Profesor; propuesto, P-E12)
**Presentación:** acción «Registrar observaciones» del detalle de la clase, solo si la clase tiene clase dictada registrada y todavía no tiene observaciones (criterios 2 y 6; la pantalla lo sabe por `acciones.registrar_observaciones` de 2.6.3). Confirmación de HU-C-25. Mensaje «Observaciones registradas correctamente» (criterio 4).

```typescript
// src/server/historial/observacion-clase.schema.ts
const TextoLibre1000 = (obligatorio: boolean) => {
  const base = z.string().trim().max(1000, "Máximo 1000 caracteres");
  return obligatorio ? base.min(1, "Este campo es obligatorio") : base;
};
export const RegistrarObservacionClaseSchema = z.object({
  temas_vistos: TextoLibre1000(true),                         // obligatorio
  observaciones_internas: TextoLibre1000(false).optional(),   // opcional; "" se guarda como NULL
}).strict();
export type RegistrarObservacionClaseInput = z.infer<typeof RegistrarObservacionClaseSchema>;
```
Cada campo admite hasta **1000 caracteres** y no se aceptan valores formados solo por espacios: `trim()` los reduce a cadena vacía, que en `temas_vistos` es error y en `observaciones_internas` se guarda como `NULL` (criterio 1). El contador de caracteres es de la pantalla.

#### 2.8.1. Comportamiento

En `transaccion`:
1. **Clase dictada.** Se busca la clase dictada **no anulada** del turno (`turnoId = [id]`, `anuladaEl IS NULL`), sin consultar el turno. Si no hay: `404 CLASE_NO_REGISTRADA` (criterio 2: sin clase dictada no hay acción; vale también si la única está anulada).
2. **Alcance:** el rol `PROFESOR` solo registra observaciones en **sus propias clases** (criterio 3): `ClaseDictada.profesorId` tiene que ser el profesor efectivo; si no, `403 SIN_PERMISO`. Mesa de Entrada no tiene recorte. El Gerente no tiene el permiso.
3. **Una sola por clase dictada** (criterio 6), sin duplicar bajo concurrencia:
   ```sql
   INSERT INTO observaciones_clase ("idObservacionClase", "claseDictadaId", "temasVistos", "observacionesInternas", "creadoPorUsuarioId", ...)
   VALUES (...)
   ON CONFLICT ("claseDictadaId") DO NOTHING;   -- $executeRaw parametrizado
   ```
   Si no insertó (0 filas): `409 OBSERVACIONES_YA_REGISTRADAS` (P-E7). Si la clase se anuló y se registró otra, la nueva clase dictada tiene otro id y admite observaciones nuevas; las de la anulada siguen ocultas.
4. No hay plazo para registrarlas (P-E7) ni límite de antigüedad de la clase.

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "clase_dictada_id": "cuid", "temas_vistos": "Funciones lineales", "observaciones_internas": null,
            "registrada_en": "2026-09-25T21:00:00Z", "registrada_por": "prof@centro.test" }, "error": null }
```
`registrada_por` es el email de la cuenta (`obtenerEmailDeUsuario()`).

**Errores esperados:** `400` (validación) · `403 SIN_PERMISO` · `404 CLASE_NO_REGISTRADA` · `409 OBSERVACIONES_YA_REGISTRADAS` · `409 TRANSACCION_OCUPADA`.

#### 2.8.2. Dónde se ven y quién las ve (criterios 4 y 5)

- **Detalle de la clase:** en `observacion` del `GET` de 2.6.3, con `registrada_en` y `registrada_por` (fecha, hora y usuario). Lo leen Mesa de Entrada, el Gerente y el Profesor de esa clase, que reciben también las observaciones internas.
- **Historial académico del alumno (2.3):** dentro del ítem de la clase dictada de **cada alumno de esa clase**. Los `temas_vistos` los ven todos los que acceden al historial; las `observaciones_internas`, solo Mesa de Entrada, el Gerente y el Profesor **autor de la clase** (en el historial, el Profesor las ve únicamente en las clases suyas, aunque vea las clases de otros profesores de esa materia, convención 8 g).
- **«Mi historial» (2.12):** el alumno ve **solo** los `temas_vistos`.
- Si el registro de clase dictada se anula (2.11), las observaciones quedan ocultas junto con él (criterio 6, HU-E-11 criterio 4).
- **Limitación aceptada del producto final** (criterio 6): lo cargado no se corrige. Si hace falta, se anula el registro de clase dictada (2.11) y se vuelve a cargar.

---

### 2.9. Indicaciones académicas (HU-E-04) — NUEVA en Revisión 2

**Ruta:** `POST /api/alumnos/[id]/indicaciones`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `src/server/historial/indicacion.service.ts` → `registrarIndicacion()`
**Permiso requerido:** `indicaciones:registrar` (Mesa de Entrada y Profesor; propuesto, P-E12)
**Presentación:** modal «Registrar indicación» (M-22), que se abre desde el tab «Historial académico» del alumno o desde la sección de clase dictada del detalle de la clase. Desde una clase, el alumno se elige entre los inscriptos de esa clase y la materia y la clase vienen precargadas (criterio 1). Confirmación de HU-C-25. Mensaje «Indicación registrada correctamente» (criterio 5).

```typescript
// src/server/historial/indicacion.schema.ts
export const RegistrarIndicacionSchema = z.object({
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  indicacion: z.string().trim().min(1, "La indicación es obligatoria").max(1000, "Máximo 1000 caracteres"),
  clase_dictada_id: z.string().trim().min(1).optional(),   // clase dictada a la que se refiere (opcional)
}).strict();
export type RegistrarIndicacionInput = z.infer<typeof RegistrarIndicacionSchema>;
```

#### 2.9.1. Comportamiento (`registrarIndicacion`), en `transaccion`

1. **Alcance y alumno.** Si el rol es `PROFESOR`: `profesorPuedeRegistrarIndicacion(profesorEfectivo.id, alumnoId, materia_id)` (2.5.3; su `true` implica la segunda condición de `profesorPuedeVerHistorial`, así que no hace falta preguntar las dos). Si da `false`, o el usuario no tiene ficha de profesor: `403 SIN_PERMISO`, **antes** de consultar si el alumno existe. Esto cubre los criterios 2 y 3 de HU-E-04: el Profesor registra solo en la materia de la clase desde la que abrió el historial, para un alumno inscripto o que estuvo inscripto en una clase suya de esa materia, y **solo después de su primera clase propia dictada y no anulada con ese alumno** en esa materia; antes, `403`. La pantalla consulta el mismo helper para deshabilitar «Registrar indicación» con la leyenda «Vas a poder registrar indicaciones después de tu primera clase dictada de esta materia con este alumno.» (criterio 2); la pantalla y el servidor usan **la misma regla** (P-E9). Luego `verificarAlumnoActivo(alumnoId)` (Módulo B): `404 ALUMNO_NO_ENCONTRADO` / `409 ALUMNO_INACTIVO` (P-E2).
2. **Materia (criterio 2, «mismo criterio que HU-E-06»):** el alumno tiene que haber cursado la materia, es decir, figurar en al menos una clase dictada **no anulada** de esa materia (sin importar qué profesor la dictó). Si no: `409 MATERIA_NO_CURSADA` (el mismo `code` y criterio de 2.2 paso 2). No hay un chequeo de existencia de la materia ni de su estado: una materia dada de baja admite la indicación si el alumno la cursó.
3. **Clase dictada vinculada (opcional, P-E10):** si viene `clase_dictada_id`, tiene que existir y no estar anulada, ser de esa `materia_id` y tener al alumno en su registro. Si no existe o está anulada: `404 CLASE_DICTADA_NO_ENCONTRADA`; si existe pero no es de esa materia o no incluye al alumno: `409 CLASE_DICTADA_NO_CORRESPONDE`.
4. **Alta.** Cada indicación es un **registro nuevo**; un alumno puede tener varias para la misma materia (criterio 4). Se guarda con `createdAtIndicacion` (fecha y hora) y `creadoPorUsuarioId` (usuario).

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "alumno_id": "cuid", "materia_id": "cuid", "indicacion": "Reforzar funciones cuadráticas",
            "clase_dictada_id": "cuid", "registrada_en": "2026-09-27T15:30:00Z", "registrada_por": "prof@centro.test" }, "error": null }
```
`clase_dictada_id` es `null` si no se vinculó.

**Errores esperados:** `400` (validación) · `403 SIN_PERMISO` · `404 ALUMNO_NO_ENCONTRADO` · `404 CLASE_DICTADA_NO_ENCONTRADA` · `409 ALUMNO_INACTIVO` · `409 MATERIA_NO_CURSADA` · `409 CLASE_DICTADA_NO_CORRESPONDE` · `409 TRANSACCION_OCUPADA`.

#### 2.9.2. Dónde se ven

- **Historial académico (2.3):** ítem `INDICACION` con fecha, materia, texto, usuario que la registró y, si lo tiene y la clase sigue vigente, `clase_dictada_id` (criterio 5). El Profesor las ve en la materia de su clase aunque las haya cargado otro profesor (convención 8 g).
- **«Mi historial» (2.12):** fecha, materia e indicación (criterio 5).
- **Clase dictada anulada (2.11):** las indicaciones **se conservan**; si estaban vinculadas a esa clase, se devuelven sin el vínculo (`clase_dictada_id: null`) (HU-E-11 criterio 4). El `clase_dictada_id` guardado no se borra (Regla N.° 8): se oculta al leer.
- **Limitación aceptada del producto final** (criterio 6): no se modifican, eliminan ni marcan como cumplidas.
- **Fecha que se muestra:** la de registro en `America/Argentina/Buenos_Aires`; el orden dentro del mismo día usa la hora de registro.

**Diferidos:** el criterio 5 en «Mi historial», al mergear HU-E-08; la exclusión de clases dictadas anuladas de los criterios 2 y 3, al mergear HU-E-11.

---

### 2.10. Corregir o anular un resultado de examen (HU-E-10) — NUEVA en Revisión 2

> **Regla N.° 8.** El `ResultadoExamen` original **no se modifica nunca**: la corrección y la anulación son **registros nuevos que lo referencian** (2.5.1), con valor anterior, valor nuevo, motivo, usuario y fecha (criterio 3). Lo que se muestra, se suma y se cuenta es el **valor vigente** (3.6). Esto cumple Q7e y reemplaza la frase «no hay corrección desde la aplicación» de 3.1.

**Rutas:**
- `POST /api/alumnos/[id]/examenes/[examenId]/correccion` (corregir)
- `POST /api/alumnos/[id]/examenes/[examenId]/anulacion` (anular)

**Server Action equivalente:** — (solo Route Handlers)
**Servicio:** `src/server/historial/resultado-examen.service.ts` → `corregirResultadoExamen()`, `anularResultadoExamen()` (el mismo archivo de 2.2)
**Permiso requerido:** `examenes:corregir` (Mesa de Entrada y Profesor; propuesto, P-E12). El Gerente no lo tiene.
**Presentación:** modal M-23, abierto desde cada resultado de examen del tab «Historial académico», que ofrece «Corregir» y «Anular» según `puede_corregir` (2.3). Confirmación de HU-C-25 (con el valor anterior y el nuevo al corregir; irreversible al anular). Mensajes «Resultado corregido correctamente» / «Resultado anulado» (criterio 6).

```typescript
// src/server/historial/resultado-examen.schema.ts  (los esquemas de campo son los de RegistrarResultadoExamenSchema, extraídos sin cambiarlos)
export const CorregirResultadoExamenSchema = z.object({
  fecha_examen: FechaExamenSchema.optional(),   // fechaCalendarioValidaSchema, igual que 2.2
  nota: NotaExamenSchema.optional(),            // /^\d{1,3}(\.\d)?$/ como string, igual que 2.2
  motivo: z.string().trim().min(1, "El motivo es obligatorio").max(300, "Máximo 300 caracteres"),
}).strict().refine((b) => b.fecha_examen !== undefined || b.nota !== undefined, {
  message: "Indicá la fecha o la nota a corregir", path: ["nota"],
});

export const AnularResultadoExamenSchema = z.object({
  motivo: z.string().trim().min(1, "El motivo es obligatorio").max(300, "Máximo 300 caracteres"),
}).strict();
```
La **materia no se cambia** (criterio 2): no es un campo de la corrección; para cambiarla se anula y se registra un resultado nuevo (2.2). La pantalla manda la fecha y la nota precargadas; el servidor acepta una sola de las dos o las dos.

#### 2.10.1. Comportamiento común (corregir y anular), en `transaccion`

1. **Resultado.** Se lee con `SELECT … FROM resultados_examen WHERE "idResultadoExamen" = $examenId AND "alumnoId" = $id FOR UPDATE`. Es el **único** bloqueo de la transacción (no se combina con otros, así que no participa del orden canónico de 3.11) y serializa dos correcciones del mismo resultado. El `examenId` no se valida como CUID: uno inexistente responde igual que uno de otro alumno.
2. **Alcance por rol** (criterio 5):
   - **Mesa de Entrada:** sin recorte. Si el resultado no existe (o es de otro alumno): `404 RESULTADO_NO_ENCONTRADO`.
   - **Profesor:** solo resultados que **él mismo registró** (`creadoPorUsuarioId` = su cuenta) y **hasta 7 días desde que los registró** (3.9, fecha base: `createdAtResultadoExamen`). Si el resultado no existe, o lo registró otra persona: `403 SIN_PERMISO` (no revela si existe). Si es suyo pero pasaron más de 7 días: `403 PLAZO_CORRECCION_VENCIDO`. Pasado el plazo, solo Mesa de Entrada. Un Profesor sin ficha de profesor: `403 SIN_PERMISO`.
   - El alumno **no** necesita estar activo (P-E2).
3. **Ya anulado.** Si el resultado ya tiene una anulación: `409 RESULTADO_ANULADO` (no se corrige ni se anula dos veces, P-E11).

#### 2.10.2. Corregir

4. **Validaciones** (las de HU-E-06, criterio 2): `fecha_examen` no futura respecto de hoy en `America/Argentina/Buenos_Aires`: `400 FECHA_EXAMEN_FUTURA`; `nota` dentro de `[nota_minima, nota_maxima]` de `ParametroSistema`: `422 NOTA_FUERA_DE_RANGO`, con el mismo mensaje de 2.2.
5. **Valor vigente anterior:** el de la última corrección o, si no hay, el del resultado original (3.6). El valor nuevo es lo que viene en el pedido y, para el campo que no viene, el vigente. Si el valor nuevo es igual al vigente en los dos campos: `409 CORRECCION_SIN_CAMBIOS` (P-E4).
6. **Alta** de `CorreccionResultadoExamen` con `fechaAnterior`, `notaAnterior`, `fechaNueva`, `notaNueva`, `motivo`, `creadoPorUsuarioId` y la fecha de registro (Regla N.° 2, opción a: el registro es la traza). El original queda intacto.

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "resultado_id": "cuid", "alumno_id": "cuid", "materia_id": "cuid",
            "fecha_examen": "2026-09-27", "nota": "9.0",
            "fecha_anterior": "2026-09-27", "nota_anterior": "8.5",
            "motivo": "Se cargó mal la nota", "registrada_en": "2026-09-28T13:00:00Z", "registrada_por": "mesa@centro.test" },
  "error": null }
```
`fecha_examen` y `nota` son los valores vigentes después de corregir.

**Errores esperados:** `400` (validación) · `400 FECHA_EXAMEN_FUTURA` · `403 SIN_PERMISO` · `403 PLAZO_CORRECCION_VENCIDO` · `404 RESULTADO_NO_ENCONTRADO` · `409 RESULTADO_ANULADO` · `409 CORRECCION_SIN_CAMBIOS` · `409 TRANSACCION_OCUPADA` · `422 NOTA_FUERA_DE_RANGO` (la excepción de convención de 2.2).

#### 2.10.3. Anular

4. **Alta** de `AnulacionResultadoExamen` con `motivo`, usuario y fecha. La unicidad por `resultadoExamenId` es la última defensa; con el bloqueo del paso 1, el segundo intento ya ve la anulación y responde `409 RESULTADO_ANULADO`.
5. El resultado **no se borra**: deja de mostrarse en el historial del alumno (2.3), en «Mi historial» (2.12) y en cualquier lectura para el Profesor y el alumno; queda visible **solo para Mesa de Entrada y el Gerente** con `anulado: true` («Anulado», criterio 4).

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "resultado_id": "cuid", "motivo": "Se cargó al alumno equivocado",
            "registrada_en": "2026-09-28T13:00:00Z", "registrada_por": "mesa@centro.test" }, "error": null }
```

**Errores esperados:** `400` (validación) · `403 SIN_PERMISO` · `403 PLAZO_CORRECCION_VENCIDO` · `404 RESULTADO_NO_ENCONTRADO` · `409 RESULTADO_ANULADO` · `409 TRANSACCION_OCUPADA`.

#### 2.10.4. Qué cambia en las lecturas

- **Historial (2.3):** cada examen se devuelve con su valor vigente (`fecha`, `nota`), `corregido` (hay al menos una corrección), `anulado` y `puede_corregir`. El orden usa la fecha vigente.
- **Opciones del formulario de 2.2:** no cambian (dependen de las clases dictadas, no de los exámenes).
- **Diferido:** la parte de «Mi historial» del criterio 4, al mergear HU-E-08.

---

### 2.11. Corregir la asistencia y anular el registro de clase dictada (HU-E-11) — NUEVA en Revisión 2

> **Regla N.° 8.** La **corrección de asistencia** es un registro nuevo que no toca al original (2.5.1, `CorreccionAsistencia`). La **anulación** es la marca `anuladaEl` / `anuladaPor` / `motivoAnulacion` de `ClaseDictada`, que `PR-0.md` §2.8 fija como la **única excepción documentada** a la Regla N.° 8 de este módulo (T3): se escribe una sola vez, con condición atómica, y el registro conserva todos sus datos. Ambas dejan valor anterior, valor nuevo, usuario, fecha y motivo (criterio 5).

**Rutas:**
- `POST /api/turnos/[id]/clase-dictada/correccion-asistencia` (HU-E-11, criterios 1 y 2)
- `POST /api/turnos/[id]/clase-dictada/anulacion` (criterios 1 y 3)

**Server Action equivalente:** — (solo Route Handlers)
**Servicio:** `src/server/historial/clase-dictada.service.ts` → `corregirAsistenciaClaseDictada()`, `anularClaseDictada()` (el mismo archivo de 2.1)
**Permiso requerido:** `clases:corregir` (Mesa de Entrada y Profesor; propuesto, P-E12). El Gerente no lo tiene.
**Presentación:** en el detalle de la clase con clase dictada registrada, «Corregir asistencia» (en la lista de inscriptos) y «Anular registro de clase dictada», según `acciones.corregir_asistencia` / `acciones.anular_registro` de 2.6.3. «Corregir asistencia» vuelve a mostrar Presente / Ausente con los valores guardados y pide el motivo; anular exige confirmación irreversible y motivo (criterios 2 y 3). Mensajes «Asistencia corregida correctamente» / «Registro de clase dictada anulado» (criterio 7).

```typescript
// src/server/historial/clase-dictada.schema.ts
export const CorregirAsistenciaSchema = z.object({
  asistencias: z.array(z.object({
    alumno_id: z.string().trim().min(1),
    estado: EstadoAsistenciaSchema,
  }).strict()).max(500),
  motivo: z.string().trim().min(1, "El motivo es obligatorio").max(300, "Máximo 300 caracteres"),
}).strict();

export const AnularClaseDictadaSchema = z.object({
  motivo: z.string().trim().min(1, "El motivo es obligatorio").max(300, "Máximo 300 caracteres"),
}).strict();
```

#### 2.11.1. Comportamiento común, en `transaccion`

1. **Bloqueo y clase.** `bloquear(tx, { clases: [turnoId] })` y se busca la clase dictada **no anulada** del turno. Si el turno no existe o no tiene clase dictada vigente: `404 CLASE_NO_REGISTRADA` (el mismo `code` del `GET` de 2.1). Bloquear la clase serializa estas operaciones entre sí y contra un registro nuevo (3.11).
2. **Alcance por rol** (criterio 6): el Profesor solo opera **sus propias clases** (`ClaseDictada.profesorId` = su ficha; si no, o sin ficha de profesor, `403 SIN_PERMISO`) y **hasta 7 días después de la fecha de la clase** (3.9, fecha base: `fechaClaseDictada`, porque la asistencia se registra ese día); pasado el plazo, `403 PLAZO_CORRECCION_VENCIDO` y solo Mesa de Entrada puede hacerlo. Mesa de Entrada no tiene recorte ni límite de antigüedad.
3. El alumno **no** necesita estar activo (P-E2) y la corrección o la anulación no mueven inscripciones ni pagos (3.12).

#### 2.11.2. Corregir asistencia

4. **Conjunto de alumnos.** `asistencias` tiene que cubrir **exactamente** a los alumnos que figuran en el registro de la clase dictada (`ClaseDictadaAlumno`): ni faltantes, ni sobrantes, ni repetidos; si no, `400 ASISTENCIA_INCOMPLETA` con `detalles` (como en 2.6.2 paso 6). La corrección no agrega ni quita alumnos del registro (eso es un hecho consumado de la clase).
5. **Valor vigente anterior** de cada alumno (3.6). Si la clase **ya tenía control** y ningún estado cambia: `409 ASISTENCIA_SIN_CAMBIOS` (P-E4). En una clase «sin control de asistencia» (registrada antes de HU-E-09 o sin cuerpo), la corrección **la carga por primera vez** (criterio 2): la pantalla propone todos en Presente y no puede ser un «sin cambios», porque la clase pasa de sin control a con control.
6. **Alta** de `CorreccionAsistencia` (motivo, usuario, fecha, `conControlAsistencia = true`) y una fila `CorreccionAsistenciaAlumno` por alumno con `estadoAnterior` (el vigente, `NULL` si no había control) y `estadoNuevo`. El registro original y sus filas quedan intactos. «Con control» pasa a ser la marca de la última corrección (3.6).
7. A partir de ese momento el historial (2.3), la pestaña Clases (2.7), «Mi historial» (2.12), los porcentajes y las lecturas de 2.13 usan el valor nuevo (criterio 2: «se actualizan el historial y los porcentajes»).

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "clase_dictada_id": "cuid", "con_control_asistencia": true,
            "totales": { "presentes": 6, "ausentes": 2 }, "motivo": "Se cargó mal a Pérez",
            "registrada_en": "2026-09-27T14:10:00Z", "registrada_por": "mesa@centro.test" }, "error": null }
```

**Errores esperados:** `400` (validación) · `400 ASISTENCIA_INCOMPLETA` · `403 SIN_PERMISO` · `403 PLAZO_CORRECCION_VENCIDO` · `404 CLASE_NO_REGISTRADA` · `409 ASISTENCIA_SIN_CAMBIOS` · `409 TRANSACCION_OCUPADA`.

#### 2.11.3. Anular el registro de clase dictada

4. **Marca atómica** (Regla N.° 7), sin leer-y-escribir por separado:
   ```sql
   UPDATE clases_dictadas
      SET "anuladaEl" = $ahora, "anuladaPor" = $usuarioId, "motivoAnulacion" = $motivo
    WHERE "idClaseDictada" = $id AND "anuladaEl" IS NULL;   -- $executeRaw parametrizado
   ```
   Si afectó 0 filas (otra persona la anuló en el mismo instante): `409 CLASE_DICTADA_YA_ANULADA`.
5. **Efectos** (criterio 4 y 3):
   - La clase **vuelve a «Sin registrar como dictada»** y puede registrarse de nuevo si corresponde (2.1, 2.6): el índice único parcial ya no la cuenta, y la clase nueva es otro registro con otro id. Para el `POST` de registro, las condiciones (b) y (c) de 2.1 paso 4 se evalúan sobre la clase **vigente**: `obtenerClaseDictadaDeTurno` devuelve `null`.
   - **Deja de aparecer** en el historial académico de los alumnos (2.3), en «Mi historial» (2.12), en la pestaña Clases (donde la inscripción pasa a «Sin registrar como dictada», 2.7.3) y **no se cuenta** en los indicadores de clases dictadas ni en la asistencia (2.13, HU-H-07; `asistenciaDeAlumno` y `contarAsistenciasPorMes` la excluyen).
   - Las **observaciones** (2.8) quedan ocultas junto con el registro: están colgadas del id anulado.
   - Los **resultados de examen** ya cargados **no se modifican**.
   - Las **indicaciones** (2.9) se conservan; las que estaban vinculadas a esa clase se muestran sin el vínculo (P-E10).
   - «Materia cursada» (2.2, 2.9) deja de contar esa clase.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "turno_id": "seed-turno-26", "anulada_en": "2026-09-27T14:30:00Z",
            "anulada_por": "mesa@centro.test", "motivo": "La clase no se dio" }, "error": null }
```

**Errores esperados:** `400` (validación) · `403 SIN_PERMISO` · `403 PLAZO_CORRECCION_VENCIDO` · `404 CLASE_NO_REGISTRADA` · `409 CLASE_DICTADA_YA_ANULADA` · `409 TRANSACCION_OCUPADA`.

#### 2.11.4. Criterios de HU-E-11 y dónde se cubren

| Criterio | Dónde |
|---|---|
| 1 (acciones en el detalle) | `acciones` de 2.6.3 |
| 2 (corregir; primera carga de una clase sin control) | 2.11.2 |
| 3 (anular con confirmación y motivo; vuelve a «Sin registrar») | 2.11.3 |
| 4 (efectos sobre historial, indicadores, observaciones, exámenes, indicaciones) | 2.11.3 paso 5; 3.7 |
| 5 (registro de valor anterior, nuevo, usuario, fecha y motivo; Regla N.° 8) | 2.5.1, 2.11.2 paso 6, 2.11.3 paso 4 |
| 6 (Profesor: propias y hasta 7 días desde la fecha de la clase) | 2.11.1 paso 2; 3.9 |
| 7 (mensajes) | Presentación |
| Diferido | La exclusión de clases anuladas de HU-H-07 (criterio 4), al mergear esta HU |

---

### 2.12. Historial académico ampliado (HU-E-05) y «Mi historial» (HU-E-08) — NUEVA en Revisión 2

> **Qué es esta sección.** 2.12.1 es el detalle de la ampliación de `GET /api/alumnos/[id]/historial` (2.3): conserva todo lo de Sprint 2 y agrega campos, un tipo de ítem y el alcance del Profesor. 2.12.2 es la ruta nueva de «Mi historial», que **reutiliza el mismo servicio** en modo alumno (la justificación de secuencia de HU-E-08 dice que reutiliza la vista de HU-E-05 en modo alumno). Una sola consulta unificada sirve a los tres modos (3.10).

#### 2.12.1. Ampliación de `GET /api/alumnos/[id]/historial` (2.3)

**Contrato que no cambia:** ruta, método, permiso `historial:leer`, `HistorialQuerySchema` (`materia_id`, `pagina`, `por_pagina` con máximo 10), consulta única con `UNION ALL` paginada, orden por fecha descendente, `materias_disponibles` calculadas **sin** aplicar `materia_id`, paginación de a 10 que se calcula sobre el resultado filtrado, `alumno` y los `code` (`400`, `403 SIN_PERMISO`, `404 ALUMNO_NO_ENCONTRADO`). Un alumno inactivo sí tiene historial visible.

**Qué ve cada rol** (3.10 resume las reglas):

| | Mesa de Entrada | Gerente (consulta) | Profesor (convención 8 g) |
|---|---|---|---|
| Materias | Todas; filtro opcional por `materia_id` | Todas; filtro opcional | **Solo la de `materia_id`**, que es obligatorio: `profesorPuedeVerHistorial` (2.5.3); `materias_disponibles` trae únicamente esa materia |
| Registros de otros profesores | Sí | Sí | Sí, **dentro de esa materia**: clases dictadas, asistencia, temas vistos, exámenes e indicaciones aunque los haya cargado otro profesor |
| `observaciones_internas` | Todas | Todas | Solo las de clases suyas (`ClaseDictada.profesorId` = su ficha) |
| Exámenes anulados | Sí, con `anulado: true` | Sí, con `anulado: true` | No existen para él |
| `puede_corregir` de cada examen | `true` si no está anulado | `false` | `true` solo si lo registró él y sigue dentro de los 7 días (3.9) |

**Qué trae la consulta unificada** (`$queryRaw` parametrizado; orden `fecha DESC`, `createdAt DESC` y, para que sea determinista, el tipo y el id como último desempate):
- **Clases dictadas** del alumno (`ClaseDictadaAlumno`) con `anuladaEl IS NULL` (3.7), con su asistencia vigente (3.6).
- **Resultados de examen** del alumno con su valor vigente (3.6): la `fecha` y la `nota` de la última corrección o, si no hay, las del original. Los anulados se excluyen salvo que el rol sea Mesa de Entrada o Gerente.
- **Indicaciones** del alumno (nuevo, HU-E-04 criterio 5): su `fecha` es la de registro en `America/Argentina/Buenos_Aires`.
- `materia_id` filtra los tres tipos **dentro** de la consulta, antes de paginar.

**Ítems** (los campos de Sprint 2 no cambian; los nuevos están marcados):

```json
{
  "data": {
    "alumno": { "id": "cuid", "nombre_completo": "Pérez, Ana" },
    "materias_disponibles": [{ "id": "cuid", "nombre": "Matemática" }],
    "asistencia_por_materia": [ { "materia_id": "cuid", "presentes": 4, "ausentes": 1, "sin_control": 2, "porcentaje": 80 } ],
    "items": [
      { "tipo": "EXAMEN", "id": "cuid", "fecha": "2026-09-27", "materia": { "id": "cuid", "nombre": "Matemática" },
        "nota": "8.5", "observaciones": "Parcial de funciones",
        "corregido": false, "anulado": false, "puede_corregir": true },
      { "tipo": "INDICACION", "id": "cuid", "fecha": "2026-09-27", "materia": { "id": "cuid", "nombre": "Matemática" },
        "indicacion": "Reforzar funciones cuadráticas", "registrada_en": "2026-09-27T15:30:00Z",
        "registrada_por": "prof@centro.test", "clase_dictada_id": "cuid" },
      { "tipo": "CLASE_DICTADA", "id": "cuid", "fecha": "2026-09-25", "materia": { "id": "cuid", "nombre": "Matemática" },
        "profesor": "Giménez, Laura", "turno_id": "seed-turno-26", "asistencia": "ASISTIO",
        "observacion": { "temas_vistos": "Funciones lineales", "observaciones_internas": null,
                         "registrada_en": "2026-09-25T21:00:00Z", "registrada_por": "prof@centro.test" } }
    ],
    "paginacion": { "total": 3, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 10 }
  },
  "error": null
}
```
- **`tipo`** pasa a `"CLASE_DICTADA" | "EXAMEN" | "INDICACION"`. La pantalla distingue los tipos **con texto o ícono, no solo color**. Un cliente de Sprint 2 que solo conoce los dos primeros ignora el tercero.
- **`id`** (nuevo en todos los tipos): id del registro (de la clase dictada, del resultado o de la indicación); es la clave estable para renderizar y el `examenId` de 2.10.
- **Clase dictada:** `asistencia` (nuevo) es `"ASISTIO"`, `"AUSENTE"` o `"ASISTIO_SIN_CONTROL"` (HU-E-09, criterios 3 y 4); la pantalla muestra «Asistió» (verde), «Ausente» (rojo) o «Asistió (sin control de asistencia)», siempre con texto. `observacion` (nuevo) es `null` si la clase no tiene observaciones; `observaciones_internas` solo viene para quien puede verlas (la tabla de arriba) y **la clave se omite** para los demás. `registrada_por` es el email de la cuenta; para resolver los de una página se llama a `obtenerEmailDeUsuario()` por cada usuario distinto (a lo sumo 10 ítems).
- **Examen:** `nota` y `observaciones` conservan su forma. `corregido` (nuevo) indica que hay al menos una corrección; `anulado` (nuevo) es `true` solo para Mesa de Entrada y Gerente; `puede_corregir` (nuevo) lo calcula el servidor para el rol que consulta, así la pantalla no repite la regla de alcance ni la de plazo. Un examen anulado trae además `anulacion: { motivo, anulada_en, anulada_por }`.
- **Indicación:** `clase_dictada_id` es `null` si no se vinculó o si la clase vinculada está anulada (P-E10).
- **`asistencia_por_materia`** (nuevo, HU-E-09 criterio 3): una fila por materia con clases dictadas del alumno, con `asistenciaDeAlumno` (2.13). Es del **historial completo** del alumno y **no depende** de `materia_id` ni de la página, igual que `materias_disponibles`. Para el Profesor trae solo la materia de su clase. `porcentaje` es `null` si no hay clases con control (P-E6).
- Sin registros: `200` con `items: []`; la pantalla muestra «Este alumno todavía no tiene historial académico» (AC4 de Sprint 2).

**Errores esperados (los de 2.3):** `400` · `403 SIN_PERMISO` (incluido el Profesor sin `materia_id` o fuera de alcance, antes de consultar si el alumno existe) · `404 ALUMNO_NO_ENCONTRADO`.

**Acceso a la pantalla (Q13).** Sin cambios para quien tiene solo `historial:leer`. El **Profesor** llega por la ruta propia del mapa (DEC-20, `/turnos/[turnoId]/alumnos/[alumnoId]/historial`): la pantalla verifica con el detalle que la clase es suya (`obtenerClasesBasicas`, módulo C), toma de ahí la materia y la manda como `materia_id`; la API valida de todos modos con el helper de 2.5.3. El **Gerente**, que ahora tiene `alumnos:leer`, ve la ficha completa en modo consulta; el enlace de HU-H-07 a «Historial académico» usa la ruta de la ficha.

#### 2.12.2. «Mi historial» (HU-E-08)

**Ruta:** `GET /api/mi-historial`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `src/server/historial/historial.service.ts` → `obtenerMiHistorial()` (llama a la misma consulta unificada de 2.12.1 en modo alumno)
**Permiso requerido:** `historial:leer_propio` (ALUMNO; propuesto, P-E12)
**Presentación:** pantalla «Mi historial» (`/mi-historial`, mapa P-12): título, porcentaje de asistencia por materia, filtro por Materia, línea de tiempo y paginación. Es de solo lectura: no pide confirmación (HU-C-25, criterio 5).

```typescript
// src/server/historial/historial.schema.ts
export const MiHistorialQuerySchema = z.object({
  materia_id: z.string().trim().min(1).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(10).default(10),   // criterio 4: de a 10
}).strict();
```

**Comportamiento:**
1. **El alumno se resuelve de la sesión** (criterio 6): `obtenerAlumnoDeUsuario(session.sub)` (Módulo B). Si la cuenta no tiene ficha vinculada: `403 SIN_PERMISO`. **Ninguna** parte de la solicitud lleva un identificador de alumno: si el pedido trae `alumno_id` (o `alumnoId`) en la query, el Route Handler responde `403 SIN_PERMISO` **antes** de validar (es un intento de consultar otro historial); cualquier otro parámetro desconocido es `400` por el `.strict()`. No hay ruta con `[id]`.
2. La misma consulta unificada de 2.12.1 con el alumno de la sesión y el modo alumno: se excluyen las observaciones internas, los datos de otros alumnos, los resultados de examen anulados y las clases dictadas anuladas (criterio 5). Se devuelve **solo** lo que enumera el criterio 1 (P-E8).
3. Los tres tipos conviven en una sola línea de tiempo por fecha descendente (criterio 3). Filtro por Materia (criterio 4): al filtrar la pantalla vuelve a `pagina=1`, igual que en 2.3.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "materias_disponibles": [{ "id": "cuid", "nombre": "Matemática" }],
    "asistencia_por_materia": [ { "materia_id": "cuid", "presentes": 4, "ausentes": 1, "sin_control": 2, "porcentaje": 80 } ],
    "items": [
      { "tipo": "CLASE_DICTADA", "id": "cuid", "fecha": "2026-09-25", "materia": { "id": "cuid", "nombre": "Matemática" },
        "profesor": "Giménez, Laura", "temas_vistos": "Funciones lineales", "asistencia": "AUSENTE" },
      { "tipo": "EXAMEN", "id": "cuid", "fecha": "2026-09-27", "materia": { "id": "cuid", "nombre": "Matemática" }, "nota": "8.5" },
      { "tipo": "INDICACION", "id": "cuid", "fecha": "2026-09-27", "materia": { "id": "cuid", "nombre": "Matemática" },
        "indicacion": "Reforzar funciones cuadráticas" }
    ],
    "paginacion": { "total": 3, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 10 }
  },
  "error": null
}
```
- `temas_vistos` es `null` si la clase no tiene observaciones. No se devuelven `turno_id`, `observacion`, `observaciones` del examen, `registrada_por`, `puede_corregir` ni `anulado`.
- `asistencia_por_materia` es el porcentaje de la parte superior de la pantalla: clases presentes / clases dictadas en las que estaba inscripto, sin contar las «sin control» (criterio 2).
- Sin registros: `200` con `items: []`; la pantalla muestra «Todavía no tenés historial académico» (criterio 7).

**Errores esperados:** `400` (validación) · `403 SIN_PERMISO`.

#### 2.12.3. Criterios de HU-E-08 y dónde se cubren

| Criterio | Dónde |
|---|---|
| 1 (clases, exámenes e indicaciones con sus campos) | 2.12.2 |
| 2 (asistencia por clase y % por materia) | `asistencia` e `asistencia_por_materia` |
| 3 (línea de tiempo única, tipos distinguibles) | 2.12.1 y 2.12.2 |
| 4 (filtro por Materia, de a 10) | `MiHistorialQuerySchema` |
| 5 (qué no se muestra) | 2.12.2 paso 2; 3.10 |
| 6 (alumno desde la sesión, 403) | 2.12.2 paso 1 |
| 7 (sin registros) | 2.12.2 |
| Diferidos que se verifican con esta HU | HU-E-09 criterio 3, HU-E-07 criterio 5, HU-E-04 criterio 5 y HU-E-10 criterio 4 (la parte de «Mi historial») |

---

### 2.13. Servicios públicos nuevos del módulo — NUEVA en Revisión 2

Conforme a la Regla N.° 3, se declaran en `src/server/historial/historial.publico.ts`, junto a las dos funciones de 2.4 (que **conservan firma y forma del resultado**). El archivo **no importa nada de otros módulos**. El parámetro opcional `db` acepta un `Prisma.TransactionClient` del llamador; sin él, usa `prisma`. Son lecturas: no validan permisos (los valida la ruta del consumidor) y no bloquean.

| Función | Devuelve | Consumidores |
|---|---|---|
| `asistenciaDeAlumno(alumnoId, materiaId?, db?)` | `{ materia_id, presentes, ausentes, sin_control, porcentaje }[]`, una fila por materia con clases dictadas **no anuladas** del alumno (o solo la de `materiaId`; `[]` si no tiene). `presentes` y `ausentes` cuentan las clases con control, con el estado vigente (3.6); `sin_control` cuenta las registradas sin control; `porcentaje` = `presentes / (presentes + ausentes)` entero redondeado (mitades hacia arriba, P-E6), o `null` si `presentes + ausentes` es 0. Ordenada por `materia_id` | 2.12 (`asistencia_por_materia`); HU-H-07 (asistencia de un alumno, p. ej. la tabla de presentismo bajo); el servicio de E la usa también internamente |
| `contarAsistenciasPorMes(rango, { porMateria? }, db?)` | `rango = { desde: "AAAA-MM", hasta: "AAAA-MM" }` con límites **inclusivos** (el mismo criterio de meses que `promediarOcupacionTurnosPorMes`, `spec_modulo_C.md` §2.15). Devuelve `{ mes: "AAAA-MM", materia_id?, presentes, ausentes, sin_control }[]`: filas de `ClaseDictadaAlumno` de clases dictadas **no anuladas**, agrupadas por el mes de `ClaseDictada.fechaClaseDictada` (y por `materia_id` si `porMateria`), con el estado vigente (3.6). Solo los meses con datos, en orden cronológico. `sin_control` se informa aparte para que quien calcula asistentes contra inscriptos pueda **excluir** las clases sin control | HU-H-07 (`spec_modulo_H.md` 2.6: presentes y ausentes; los **inscriptos** de una clase dictada son `presentes + ausentes`, no salen de C) |
| `profesorPuedeRegistrarIndicacion(profesorId, alumnoId, materiaId, db?)` | `boolean`: `true` si existe al menos una clase dictada **no anulada** de `profesorId` y `materiaId` en la que `alumnoId` figura en el registro (presente, ausente o sin control; P-E9) | 2.9 y, dentro de E, `profesorPuedeVerHistorial` (2.5.3). La pantalla del historial la consulta para habilitar «Registrar indicación» |
| `contarClasesDictadasSinControl(rango, db?)` y `listarAlumnosConPresentismoBajo(rango, { umbral, minimoClases, limite, desplazamiento }, db?)` | **Las agrega HU-H-07** en esta fachada (DEC-41); su contrato está en `spec_modulo_H.md` 2.8.3. Aplican el valor vigente (3.6) y el predicado de clase no anulada (3.7) con `valor-vigente.ts`. Las dos de arriba no cambian | HU-H-07 (`spec_modulo_H.md` 2.6) |
| `alumnoTieneRegistros(alumnoId, db?)` y `profesorTieneRegistros(profesorId, db?)` | `boolean`, solo lectura (existencia, `LIMIT 1`). **Alumno:** figura en alguna clase dictada (`ClaseDictadaAlumno`, también de una clase anulada), tiene algún resultado de examen o alguna indicación académica. **Profesor:** figura como quien dictó alguna clase —también una anulada— o tiene alguna indicación, resultado de examen u observación atribuida a él (por su ficha o por el usuario de su cuenta). Ante la duda, `true`: el motivo de la baja se pide de más, nunca de menos (Regla N.° 1). **Las agregan HU-B-07 y HU-D-08** en esta fachada (`PR-0.md` §2.13: la HU agrega la lectura que le falta en la fachada del dueño); los criterios exactos los fija E según su modelo, a confirmar contra el código | `spec_modulo_B.md` 2.10.2 (motivo obligatorio de la baja del alumno); `spec_modulo_D.md` 2.10.1 (motivo obligatorio de la baja del profesor) |

**Funciones existentes (2.4), con su nota de Revisión 2:**
- `obtenerClaseDictadaDeTurno(turnoId, db?)` → `{ id, registrada_en, alumnos_registrados } | null`. Considera solo la clase dictada **no anulada**: tras una anulación (2.11) devuelve `null`, como si nunca se hubiera registrado. Consumidor: el detalle de la clase de C (condición (c) de 2.1 paso 4) y «Mis clases» (`clase_dictada` de HU-C-13).
- `profesorAtendioAlumno(profesorId, alumnoId, db?)` → `boolean`. **Se conserva** exportada y con su firma y sus tests; ignora las clases anuladas. Ya no decide ningún alcance (2.5.3).

**Lo que E no expone** (lo resuelve cada módulo con sus datos): la condición de `registrar_clase` (es del turno y la tiene C, 2.1 paso 4); `puede_ver_historial` del Profesor en el detalle de la clase (lo calcula C, 2.5.3); y `profesorPuedeVerHistorial`, que necesita a C y a E a la vez y vive en el servicio de E.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/historial/*.service.ts` (`clase-dictada.service.ts`, `resultado-examen.service.ts`, `historial.service.ts`). Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. Inmutabilidad de los registros de hecho consumado (Regla N.° 8)

> **Revisión 2.** La inmutabilidad **se mantiene**: `ClaseDictada`, `ClaseDictadaAlumno` y `ResultadoExamen` siguen sin admitir `UPDATE` ni `DELETE` de sus datos. Quedan superadas las frases «no hay corrección desde la aplicación» y «una HU que el PO planificó para Sprint 3 (Q7e, a definir)»: HU-E-10 y HU-E-11 agregan las rutas de 2.10 y 2.11, que crean el **registro compensatorio** que esta sección anticipaba. La **única** escritura sobre un registro de hecho es la marca de anulación de la clase dictada (`anuladaEl`, `anuladaPor`, `motivoAnulacion`), la excepción documentada de `PR-0.md` §2.8 (T3). El valor que se muestra es el vigente (3.6).

`ClaseDictada`, `ClaseDictadaAlumno` y `ResultadoExamen` **no admiten `UPDATE` ni `DELETE`** una vez insertados: ningún servicio ni ruta los modifica. Un error de carga se corregirá con un registro compensatorio que referencie al original, en una HU que el PO planificó para Sprint 3 (Q7e, a definir). Hasta entonces **no hay corrección desde la aplicación**; hay que saberlo antes de la demo.

### 3.2. La clase dictada es una fotografía, no una vista viva

> **Revisión 2.** Se mantiene. La asistencia de cada alumno se copia al registrar (2.6.2 paso 8); corregirla agrega un registro nuevo y no altera la fotografía original (3.6).

La lista de alumnos, la fecha, la materia y el profesor se copian al registrar. Cambios posteriores en el turno (que ya está vencido y por lo tanto congelado, `spec_modulo_C.md` §3.8) o en las fichas no alteran el historial.

### 3.3. Un turno, una clase dictada

> **Revisión 2.** Se mantiene **como regla**: una sola clase dictada **no anulada** por turno, garantizada por el índice único parcial y por el `INSERT … ON CONFLICT ("turnoId") WHERE "anuladaEl" IS NULL DO NOTHING` (T3). Repetir la acción no duplica ni falla. Tras anular el registro (2.11), el turno vuelve a poder registrarse; el registro nuevo es otra fila.

Garantizado por el constraint `UNIQUE` sobre `turnoId` y por el `INSERT … ON CONFLICT DO NOTHING` de 2.1. Repetir la acción no duplica ni falla: devuelve el registro existente.

### 3.4. Sin asistencia individual

> **Revisión 2.** Superada por HU-E-09 **para los registros nuevos con cuerpo** (2.6): cada alumno queda `PRESENTE` o `AUSENTE`. Se conserva para los registros hechos **sin cuerpo** y para las clases de Sprint 2 (T4): figuran «Asistió (sin control de asistencia)» y no cuentan para el porcentaje. «Todos presentes» deja de ser una suposición del sistema: es el valor con el que la pantalla arranca la lista.

Todos los inscriptos al momento de dictarse la clase se consideran presentes (HU-E-01 AC5).

### 3.5. Aislamiento de dominio

> **Revisión 2.** Sigue valiendo. Las funciones que se suman de otros módulos y cómo se compone C con E están en 3.13.

Este módulo no lee `turnos`, `alumnos`, `profesores` ni `materias`: usa `bloquearTurnoParaOperacion()` (C); `verificarAlumnoActivo()` (alta de examen y opciones, con los códigos `ALUMNO_NO_ENCONTRADO` / `ALUMNO_INACTIVO`), `obtenerAlumnoBasico()` (historial) y `obtenerAlumnosBasicos()` (`GET` de la clase dictada) (B); `obtenerMateriasPorIds()` (historial y opciones) (L); `obtenerNombresProfesores()` y `obtenerOpcionProfesorDeUsuario()` (2.1, 2.2, 2.3) (D); y `obtenerEmailDeUsuario()` (A). Estas funciones se agregan a los módulos correspondientes en sus revisiones de Sprint 2.

### 3.6. El valor vigente: las correcciones no modifican el original (Regla N.° 8) — NUEVA en Revisión 2
Una corrección o una anulación **nunca** actualiza el registro que corrige: se guarda un registro nuevo que lo referencia (2.5.1). Lo que se muestra, se suma y se cuenta es el **valor vigente**:
- **Estado de asistencia de un alumno en una clase dictada:** el `estadoNuevo` de la corrección **más reciente** (por fecha de registro y, de empate, por id) que incluya al alumno; si no hay ninguna, el `estadoAsistencia` de `ClaseDictadaAlumno` (`NULL` = sin control).
- **Marca «con control» de la clase:** la de la última corrección (siempre `true`) o, si no hay, `ClaseDictada.conControlAsistencia`. Así cargar la asistencia por primera vez (HU-E-11, criterio 2) no edita la fila original.
- **Fecha y nota de un examen:** `fechaNueva` y `notaNueva` de la última corrección o, si no hay, las del `ResultadoExamen`. Un examen con anulación está **anulado**: no tiene valor vigente para quien no es Mesa de Entrada ni Gerente.
- **Una sola implementación** de la regla: `src/server/historial/valor-vigente.ts` expone los fragmentos SQL (`sqlAsistenciaVigente(alias)`, `sqlExamenVigente(alias)`, `sqlClaseDictadaVigente(alias)`) y las funciones equivalentes en TypeScript. Ninguna consulta ni función del módulo (historial, pestaña Clases, «Mi historial», lecturas de 2.13) la reimplementa. Si la regla cambia, cambia ahí.
  ```sql
  -- estado de asistencia vigente del alumno en la clase dictada (sqlAsistenciaVigente)
  COALESCE(
    (SELECT caa."estadoNuevo"
       FROM correcciones_asistencia_alumnos caa
       JOIN correcciones_asistencia ca ON ca."idCorreccionAsistencia" = caa."correccionId"
      WHERE ca."claseDictadaId" = cda."claseDictadaId" AND caa."alumnoId" = cda."alumnoId"
      ORDER BY ca."createdAtCorreccion" DESC, ca."idCorreccionAsistencia" DESC LIMIT 1),
    cda."estadoAsistencia")
  ```

### 3.7. Clase dictada anulada — NUEVA en Revisión 2
Una clase dictada con `anuladaEl` no vacío **no existe** para el resto del sistema. El predicado `anuladaEl IS NULL` es único (`sqlClaseDictadaVigente`) y lo aplican, sin excepción: el historial de los tres modos (2.12), la pestaña Clases (2.7), «Mi historial», `asistenciaDeAlumno` y `contarAsistenciasPorMes` (2.13), `obtenerClaseDictadaDeTurno` y `profesorAtendioAlumno` (2.4), «materia cursada» (2.2 y 2.9), `profesorPuedeRegistrarIndicacion` (2.5.3) y el `GET` de 2.1/2.6. Las observaciones, que cuelgan del id anulado, quedan ocultas; las indicaciones y los exámenes **no** se modifican (2.11.3).

### 3.8. Alcance del Profesor y respuesta que no revela existencia — NUEVA en Revisión 2
- Todo alcance del Profesor se resuelve en el servidor con la ficha de la sesión (`obtenerOpcionProfesorDeUsuario()`), nunca por parámetro (2.5.3).
- **Historial, exámenes e indicaciones:** `profesorPuedeVerHistorial(profesorId, alumnoId, materiaId)`; en indicaciones, además la primera clase propia dictada (`profesorPuedeRegistrarIndicacion`). Sin `materia_id`, o fuera de alcance: `403 SIN_PERMISO`, **antes** de consultar si el alumno existe.
- **Observaciones, corregir asistencia y anular la clase:** solo clases suyas (`ClaseDictada.profesorId`).
- **Corregir o anular un examen:** solo los que registró él.
- Un resultado o una clase que **no existe** y uno **ajeno** responden lo mismo al Profesor (`403 SIN_PERMISO`); Mesa de Entrada recibe el `404` que corresponda.
- El Gerente no tiene ningún permiso de escritura de este módulo: `403 SIN_PERMISO`.

### 3.9. Plazo de corrección del Profesor — NUEVA en Revisión 2
`DIAS_PLAZO_CORRECCION_PROFESOR = 7` (constante del módulo, P-E3). `dentroDePlazoDeCorreccion(fechaBase, hoy)` es `true` si la diferencia en **días de calendario**, en `America/Argentina/Buenos_Aires`, entre `hoy` (de `ahora()`) y `fechaBase` es de **7 o menos**: una base del 20/09 admite hasta el 27/09 inclusive y rechaza desde el 28/09. La fecha base es `ClaseDictada.fechaClaseDictada` para corregir asistencia y anular una clase (HU-E-11, criterio 6) y la **fecha de registro** de `ResultadoExamen` (`createdAtResultadoExamen`) para corregir o anular un examen (HU-E-10, criterio 5). Fuera de plazo: `403 PLAZO_CORRECCION_VENCIDO`. Mesa de Entrada no tiene plazo.

### 3.10. Qué ve cada rol (una sola tabla, un solo servicio) — NUEVA en Revisión 2
La consulta unificada recibe un **modo** (`PERSONAL` para Mesa de Entrada y Gerente, `PROFESOR` con su `profesorId` y la materia, `ALUMNO`) y aplica estas reglas en el servicio, nunca en la pantalla:

| Dato | Mesa de Entrada | Gerente | Profesor | Alumno («Mi historial») |
|---|---|---|---|---|
| Materias del historial | Todas | Todas | Solo la de la clase | Todas las suyas |
| Temas vistos | Sí | Sí | Sí | Sí |
| Observaciones internas | Sí | Sí | Solo de clases suyas | No |
| Asistencia por clase y % | Sí | Sí | Sí, de su materia | Sí |
| Exámenes anulados | Sí («Anulado») | Sí («Anulado») | No | No |
| Observaciones del examen (`observaciones`) | Sí | Sí | Sí | No |
| Quién registró cada cosa | Sí | Sí | Sí | No |
| Datos de otros alumnos | No | No | No (solo de la clase, en el detalle de la clase) | No |

### 3.11. Concurrencia y bloqueos — NUEVA en Revisión 2
- **Orden canónico** (`PR-0.md` §2.10): las operaciones de E que combinan recursos toman primero la clase con `bloquear(tx, { clases: [turnoId] })` (`FOR UPDATE`); si hay que tocar inscripciones (`marcarVencidas`), eso lo hace el servicio de inscripción **después**, en su orden. Las escrituras que solo dependen de su propia fila (observación, indicación, corrección y anulación de examen) no combinan bloqueos.
- **Registrar, corregir, anular** una clase dictada de un mismo turno se serializan entre sí con el bloqueo de la clase. Un registro nuevo posterior a una anulación es otro registro (índice único parcial, T3).
- **Condiciones atómicas** (Regla N.° 7): la unicidad de la clase dictada es `INSERT … ON CONFLICT ("turnoId") WHERE "anuladaEl" IS NULL DO NOTHING`; la de la observación, `ON CONFLICT ("claseDictadaId") DO NOTHING`; la anulación de la clase, `UPDATE … WHERE "anuladaEl" IS NULL` con conteo de filas; la anulación de un examen, el bloqueo de su fila más el `UNIQUE` por resultado. Nunca captura de `P2002` dentro de la transacción.
- Todas las transacciones usan `transaccion` del PR 0 (`maxWait` 2000 ms, `timeout` 8000 ms, `lock_timeout` 5 s); un bloqueo que no se obtiene responde `409 TRANSACCION_OCUPADA`. Los registros de hecho consumado no necesitan eventos posteriores al commit (§4).

### 3.12. La asistencia no mueve pagos ni inscripciones — NUEVA en Revisión 2
Marcar a un alumno **Ausente**, corregir la asistencia o anular el registro de la clase no cambia su inscripción, su estado de pago, su precio ni sus pagos, y no genera reintegro (HU-E-09, criterio 5; HU-E-11). E no escribe en las tablas de C ni de I y no llama a sus servicios de escritura (salvo `marcarVencidas`, que solo marca reservas ya vencidas, 2.6.2 paso 6).

### 3.13. Aislamiento de dominio (ampliación de 3.5) — NUEVA en Revisión 2
Este módulo sigue sin leer `turnos`, `turno_alumno`, `alumnos`, `profesores`, `materias`, `usuarios` ni `pagos`. Las funciones de otros módulos que usa la Revisión 2:
- **C** (`turno.publico.ts` e `inscripcion.publico.ts`): `bloquearTurnoParaOperacion`, `bloquear` (compartido), `inscripcionesVigentes`, `marcarVencidas`, `listarInscripcionesDeAlumno`, `existeInscripcionVigenteConProfesor`, `obtenerClasesBasicas` (R2-PR0-3).
- **B**: `obtenerAlumnoDeUsuario`, `obtenerAlumnoBasico`, `obtenerAlumnosBasicos`, `verificarAlumnoActivo`.
- **D**: `obtenerOpcionProfesorDeUsuario`, `obtenerNombresProfesores`.
- **L**: `obtenerMateriasPorIds`.
- **A**: `obtenerEmailDeUsuario`.

`historial.publico.ts` no importa nada. La composición entre C y E ocurre en el **servicio de E** (2.5.3, 2.7), nunca en una fachada. Los módulos H y C consumen las funciones de 2.4 y 2.13.

### 3.14. Pruebas obligatorias (módulo E) — NUEVA en Revisión 2
1. **Los tests de Sprint 2 de 2.1 a 2.4 siguen pasando.** Solo se tocan los mocks de persistencia; las aserciones de respuesta, `code` y regla se mantienen (`PR-0.md` §1.1, regla 3). La única aserción que cambia es el alcance del Profesor (T1), y se anota en «Decisiones tomadas».
2. **Contrato de 2.1 sin cuerpo:** un `POST` sin cuerpo registra la clase sin control y responde lo mismo que en Sprint 2 (más los tres campos nuevos).
3. **Registro con asistencia:** guarda la clase y los estados en una transacción; un `asistencias` incompleto, con sobrantes o repetidos responde `400 ASISTENCIA_INCOMPLETA` y no escribe nada; un alumno Ausente no cambia su pago.
4. **`ON CONFLICT` parcial con PostgreSQL real:** registrar, anular, registrar de nuevo; dos registros simultáneos (uno gana, el otro `ya_existia`); una anulación y un registro simultáneos.
5. **Valor vigente:** la asistencia y el examen corregidos se leen con el valor nuevo en el historial, la pestaña Clases, «Mi historial» y las lecturas de 2.13, y esas cuatro dan los mismos números (prueba de equivalencia).
6. **Clasificación de 2.7.3:** una prueba por cada fila de la tabla, incluidos la reserva vencida sin marcar, la clase en curso (no es «Próxima»), la inscripción cancelada y vuelta a hacer en la misma clase (dos filas), la inscripción finalizada antes y después de la cancelación de la clase, y «Asistió (sin control)».
7. **Alcance del Profesor:** `profesorPuedeVerHistorial` con la condición 1 sola, la 2 sola, ninguna, y una clase dictada anulada; `403` antes de la existencia; `materia_id` obligatorio; indicación antes y después de la primera clase propia (con el alumno ausente); exámenes solo en la materia; observaciones internas solo de clases suyas.
8. **Plazo de 7 días:** el día 7 entra, el 8 no, para exámenes (fecha de registro) y para clases (fecha de la clase); Mesa de Entrada sin plazo.
9. **Anulación:** la clase vuelve a «Sin registrar», las observaciones desaparecen, las indicaciones se conservan sin vínculo, los exámenes no cambian y `obtenerClaseDictadaDeTurno` devuelve `null`.
10. **«Mi historial»:** el alumno sale de la sesión; un `alumno_id` en la query da `403`; no aparecen observaciones internas, exámenes anulados, clases anuladas ni datos de otros alumnos.
11. **Cada permiso nuevo** contra la matriz del PR 0, y el Gerente con `403` en toda escritura.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Conforme a `docs/RULES.md` Regla N.° 2, este módulo usa la **opción (a) — columnas de auditoría en la propia entidad**, que se persisten en la misma operación: la trazabilidad (qué, cuándo, quién) queda en las columnas de la propia fila (`createdAtClaseDictada` / `createdAtResultadoExamen` y `creadoPorUsuarioId`). Al ser registros inmutables de un solo evento por fila, no se necesita tabla de eventos ni se emiten eventos de dominio en este sprint.

> **Revisión 2.** El módulo sigue en la **opción (a)**: cada registro nuevo es su propia traza (qué, cuándo y quién) en sus columnas de auditoría y se persiste en la misma operación. Valen para las correcciones de asistencia, las observaciones, las indicaciones, las correcciones y anulaciones de exámenes (`createdAt…` y `creadoPorUsuarioId`) y para la anulación de la clase dictada (`anuladaEl`, `anuladaPor`, `motivoAnulacion`). Como cada fila tiene un solo evento, no se necesita tabla de eventos ni se emiten eventos de dominio. Que una clase dictada se registre, se corrija o se anule **no** es un cambio de estado de la inscripción y no escribe en el historial de estados de C (3.12).

---

## 5. Decisiones del PO (todas resueltas el 29/09/2026)

| # | Punto | Dónde impacta | Quién resuelve | Decisión contractualizada |
|---|---|---|---|---|
| Q7a | El borrador de los PO pedía "indicaciones académicas" en HU-E-01; el backlog final no lo incluye | 2.1 | PO | No se incluye — **ratificado 29/09/2026** (HU-E-04, Sprint 3) |
| Q7b | ¿El profesor ve y registra solo alumnos que atendió? | Convenciones, 2.2, 2.3 | PO | Ver historial: solo los que atendió — **ratificado 29/09/2026**. Registrar exámenes: solo los que atendió — **ratificado 29/09/2026** |
| Q7c | ¿"Ya pasó" es el inicio o el fin del turno? | 2.1 paso 4 | PO | El fin — **ratificado 29/09/2026**. Diverge de la letra del AC1 de HU-E-01 ("cuya fecha/hora ya pasó"); ver 2.1 paso 4 |
| Q7d | Escala y decimales de la nota | 2.2 | PO | 1 a 10, hasta 1 decimal, parametrizable — **ratificado 29/09/2026** |
| Q7e | Sin corrección de un registro cargado por error | 3.1 | PO | Sin corrección hasta la HU de corrección que el PO planificó para Sprint 3 (Regla N.° 8) — **resuelto 29/09/2026** |
| Q13 | Gerente y Profesor no pueden abrir la ficha del alumno | 2.3 | PO | `historial:leer` + entrada desde el Detalle de turno — **aprobado 29/09/2026** |

> **Revisión 2.** Estado de cada decisión del PO de Sprint 2 después del backlog del Sprint 3: **Q7a** (indicaciones académicas): cumplida por HU-E-04 (2.9). **Q7b** (el Profesor ve y registra solo alumnos que atendió): **reemplazada** por la convención 8 (g) del backlog (alcance por materia y por clase, 2.5.3); es el único cambio de comportamiento sobre lo existente (T1). **Q7c** (la clase se registra al terminar): **se conserva** (T2, P-E1). **Q7d** (escala de la nota): sin cambios. **Q7e** (sin corrección hasta la HU de Sprint 3): cumplida por HU-E-10 y HU-E-11 (2.10 y 2.11). **Q13** (Gerente y Profesor no abren la ficha): vigente para quien tiene solo `historial:leer`; el Gerente pasa a ver la ficha en modo consulta (convención 8 d) y el Profesor entra por la ruta propia de DEC-20.
>
> Los puntos nuevos de la Revisión 2 (P-E1 a P-E13) los resolvió el Scrum Master el 08/10/2026; están en el encabezado de la Revisión 2, con a quién se informa cada uno.
```
