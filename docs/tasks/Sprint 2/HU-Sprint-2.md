# Historias de Usuario — Sprint 2 — Noctium

Backlog completo de Sprint 2, redactado por el PO (28/09/2026). Orden de prioridad de arriba hacia abajo (no es el orden de módulo). Formato espejo de `Historias_de_Usuario_-_Sprint_2.xlsx`.

**Total: 25 Historias de Usuario — 48 SP**

> Nota de proceso (SDD): este documento es un backlog a nivel de PO (Como/Necesito/Para/Criterios/SP/Justificación). Las specs (`docs/specs/spec_modulo_X.md`) y los tasks (`docs/tasks/HU-X-NN.md`) de cada historia los redacta el Scrum Master o el developer al iniciar la HU — este archivo no los reemplaza. Para la pantalla/presentación (modal vs. página) de cada acción, ver `docs/adicionales/mapa-pantallas-sprint-2.md`.

---

## Índice de prioridad

1. HU-L-03 - Modificar datos de materia — 1 SP
2. HU-K-03 - Modificar datos del aula — 2 SP
3. HU-D-06 - Modificar datos del profesor — 1 SP
4. HU-D-07 - Modificar materias asociadas al profesor — 2 SP
5. HU-I-03 - Registrar forma de pago disponible en el centro — 1 SP
6. HU-B-05 - Búsqueda inteligente de alumno — 2 SP
7. HU-C-02 - Búsqueda inteligente de turnos — 2 SP
8. HU-C-07 - Mostrar horarios disponibles del profesor — 3 SP
9. HU-C-16 - Mostrar aulas disponibles según horario — 1 SP
10. HU-C-18 - Reordenar el flujo de registro de turno según el nuevo orden aprobado — 3 SP
11. HU-C-17 - Generar turnos a partir del horario del profesor — 5 SP
12. HU-C-09 - Consultar detalles del turno — 1 SP
13. HU-C-05 - Cambiar estado del turno a cancelado — 1 SP
14. HU-C-06 - Cambiar fecha y hora del turno — 2 SP
15. HU-C-10 - Asignar prioridad/urgencia al turno — 1 SP
16. HU-I-01 - Registrar pago — 3 SP
17. HU-C-08 - Consultar turnos asociados al profesor — 2 SP
18. HU-J-03 - Visualizar calendario por día/semana/mes — 2 SP
19. HU-C-12 - Solicitar turno propio — 3 SP
20. HU-C-13 - Consultar turnos propios — 2 SP
21. HU-E-01 - Registrar clase dictada — 2 SP
22. HU-E-06 - Registrar resultados de exámenes — 2 SP
23. HU-E-05 - Ver historial académico del alumno — 2 SP
24. HU-H-01 - Ver cantidad de turnos por mes — 1 SP
25. HU-H-02 - Ver cantidad de alumnos por mes — 1 SP

---

## 1. HU-L-03 - Modificar datos de materia

**Módulo:** Gestionar materias  
**SP:** 1

**Como** Gerente,
**necesito** Modificar el nombre y código de una materia registrada,
**para** Corregir datos cargados o actualizar su código sin dar de baja la materia.

**Criterios de aceptación:**

1. Desde el detalle de la materia (HU-L-02) se abre un formulario precargado con Nombre y Código actuales, con las mismas reglas de validación que el alta (HU-L-01).
2. El nombre y el código se validan y normalizan igual que en el alta; no se permite dejarlo repetido con otra materia activa o inactiva (excluyendo la propia).
   - La comparación no distingue mayúsculas ni acentos, mismo criterio que HU-L-01.
3. Al guardar se actualizan solo los campos modificados, se registra la fecha de última modificación y se muestra "Materia actualizada correctamente".
   - Si no hubo cambios, el botón Guardar permanece deshabilitado.
4. Cancelar vuelve al detalle sin guardar; si hay cambios sin guardar, solicita confirmación (mismo patrón que HU-L-01).
5. Esta historia no permite cambiar el estado activo/inactivo de la materia ni configurar una duración por materia (fuera de alcance, igual que en Sprint 1).

**Justificación de secuencia:** Depende de HU-L-01/HU-L-02. Extiende la ficha de materia ya existente (ver docs/adicionales/mapa-pantallas-sprint-2.md §1); no bloquea a ninguna otra historia del sprint.

---

## 2. HU-K-03 - Modificar datos del aula

**Módulo:** Gestionar aulas  
**SP:** 2

**Como** Gerente,
**necesito** Modificar el nombre/número y la capacidad de un aula registrada,
**para** Corregir sus datos o ajustar su capacidad real sin dar de baja el aula.

**Criterios de aceptación:**

1. Desde el detalle del aula (HU-K-02) se abre un formulario precargado, con las mismas reglas de HU-K-01 para nombre/número y capacidad.
2. Si se reduce la capacidad por debajo de la cantidad de alumnos ya inscriptos en algún turno futuro (Disponible o Completo) que usa esa aula, se rechaza con "La nueva capacidad es menor a la cantidad de alumnos ya inscriptos en turnos que usan esta aula" y no se guarda.
   - La validación es contra turnos con fecha futura únicamente; los turnos pasados no bloquean el cambio.
3. Al guardar exitosamente se actualiza el aula, se informa "Aula actualizada correctamente", y los turnos futuros que ya tenían esta aula asignada actualizan su cupo máximo si la capacidad cambió (mismo criterio de HU-C-15: cupo = capacidad del aula).
4. Cancelar vuelve al detalle sin guardar, con confirmación si hay cambios.
5. Esta historia no permite desactivar el aula (HU-K-04, Sprint 3).

**Justificación de secuencia:** Depende de HU-K-01/HU-K-02. El impacto sobre el cupo de turnos ya asignados (criterio 3) la hace algo más compleja que HU-L-03, por eso 2 SP en vez de 1.

---

## 3. HU-D-06 - Modificar datos del profesor

**Módulo:** Gestionar profesores  
**SP:** 1

**Como** Personal de mesa de entrada,
**necesito** Modificar los datos de identidad y contacto de un profesor,
**para** Mantener actualizada su ficha.

**Criterios de aceptación:**

1. Desde el detalle del profesor (HU-D-05) se abre un formulario precargado con identidad (HU-D-01) y contacto (HU-D-02), con las mismas validaciones que el alta.
2. Si se cambia el DNI, se valida unicidad contra profesores activos e inactivos, excluyendo la propia ficha (mismo criterio que HU-B-06 aplicó para alumno).
3. Al guardar se actualizan solo los campos modificados y se muestra "Profesor actualizado correctamente".
4. Cancelar vuelve al detalle sin guardar, con confirmación si hay cambios sin guardar.
5. Esta historia no permite modificar las materias asociadas (HU-D-07) ni el horario de atención, ni desactivar al profesor (HU-D-08, Sprint 3).

**Justificación de secuencia:** Depende de HU-D-01/HU-D-02/HU-D-05. Mismo patrón ya resuelto por HU-B-06 en Sprint 1 — bajo riesgo, se puede resolver temprano.

---

## 4. HU-D-07 - Modificar materias asociadas al profesor

**Módulo:** Gestionar profesores  
**SP:** 2

**Como** Personal de mesa de entrada,
**necesito** Agregar o quitar materias asociadas a un profesor,
**para** Mantener actualizado qué materias puede dictar.

**Criterios de aceptación:**

1. Desde la ficha del profesor se muestran las materias ya asociadas (marcadas) y las materias activas disponibles para agregar, mismo selector de HU-D-03.
2. Se puede agregar una o varias materias nuevas en la misma operación, con las mismas validaciones de HU-D-03 (no duplicar, solo materias activas).
3. Se puede quitar una materia ya asociada, siempre que el profesor no tenga ningún turno futuro (Disponible o Completo) de esa materia. Los turnos pasados o cancelados no bloquean la desasociación.
   - Si los tiene, la operación se rechaza y la materia sigue asociada (la casilla queda tildada). Debajo de esa materia se muestra un aviso corto: "No se puede quitar: el profesor tiene N turnos futuros de esta materia", con el link "Ver turnos".
   - "Ver turnos" abre un modal con el mensaje "El profesor tiene N turnos futuros de esta materia. Cancelá o resolvé estos turnos y volvé a intentar." y la lista de esos turnos con fecha, hora, aula, cupo ocupado (por ejemplo, 3/5) y estado, paginada de a 10.
   - Esa lista sale del listado de turnos existente (HU-C-01), filtrado por ese profesor, esa materia y fecha futura. No es una pantalla ni una historia nueva.
   - Cada turno de la lista enlaza a su Detalle de turno, que se abre en una pestaña nueva para no perder los cambios de la ficha, y donde Mesa de Entrada puede cancelarlo (HU-C-05). Una vez resueltos todos, reintenta quitar la materia.
   - (Corregido 28/09/2026 — decisión del PO en respuesta a una consulta del equipo de desarrollo: se evaluó permitir la desasociación igual y dejar el turno "esperando profesor", pero implica un estado nuevo de Turno y una reasignación de profesor sobre un turno ya confirmado que hoy no existe en ninguna HU (ver HU-C-06 criterio 5) — se prefiere resolver con las herramientas que ya existen antes de sumar ese alcance. Presentación revisada el 28/09 tras revisar el prototipo: aviso corto + modal con la lista paginada, en vez de la tabla incrustada en la ficha.)
4. Al guardar se muestra "Materias del profesor actualizadas", mismo mensaje que el de la asociación inicial.
5. Los horarios de atención del profesor (HU-D-04) no están asociados a ninguna materia en particular — son un patrón semanal general e independiente de qué dicte (`HorarioProfesor` no tiene materia, spec_modulo_D.md §2.4/§3.5). Por eso, quitar una materia asociada no afecta ni modifica ningún horario: quedan intactos.

**Justificación de secuencia:** Depende de HU-D-03 y de los turnos ya existentes (HU-C-04) para la validación del criterio 3, y del listado de turnos (HU-C-01) para mostrar los turnos que bloquean. Al ser Profesores y Turnos módulos distintos, la consulta pasa por el servicio público de Turnos, no por su tabla (Regla N.° 3 de `docs/RULES.md`). Algo más compleja que HU-D-06 por esa validación cruzada con Turno.

**Nota (28/09/2026):** el actor de HU-D-06 y HU-D-07 se corrige de "Gerente" a "Personal de mesa de entrada" — decisión del PO en respuesta a consulta del Scrum Master (Q12): el Gerente no administra Profesores, eso queda exclusivamente en Mesa de Entrada. `profesores:crear` (HU-D-01, Sprint 1) sigue siendo exclusivo del Gerente — esa parte no cambia, ver `spec_modulo_D.md` §2.1.

**Nota (28/09/2026):** el criterio 5 original decía que los horarios "ya registrados para una materia que se quita" quedaban huérfanos — redactado sobre el mismo malentendido que corrigió el Q1 del Scrum Master: `HorarioProfesor` no tiene materia, así que no existe un horario "de" una materia. Corregido para reflejar que los horarios son independientes de las materias asociadas y no se ven afectados por esta operación.

---

## 5. HU-I-03 - Registrar forma de pago disponible en el centro

**Módulo:** Gestionar pagos  
**SP:** 1

**Como** Gerente,
**necesito** Registrar y listar las formas de pago que el centro admite,
**para** Que estén disponibles para asociarlas a alumnos (HU-B-03) y usarlas al registrar un pago (HU-I-01).

**Criterios de aceptación:**

1. La opción Nueva forma de pago solicita un Nombre obligatorio (por ejemplo "Efectivo", "Transferencia", "Tarjeta de débito", "Mercado Pago").
   - No se solicita ni almacena ningún dato financiero sensible, mismo criterio que HU-B-03.
2. El nombre se normaliza y no puede repetirse entre formas de pago activas o inactivas (mismo criterio de unicidad que Materias y Aulas).
3. Con datos válidos se crea la forma de pago en estado Activa y se informa "Forma de pago registrada correctamente".
4. El listado muestra Nombre y Estado (Activa/Inactiva), ordenado alfabéticamente, con paginación si corresponde — mismo patrón de listado que Materias/Aulas.
5. Esta historia no incluye modificación ni baja de una forma de pago (quedan para una historia futura).

**Justificación de secuencia:** No depende de otra historia de Sprint 2. Es prerrequisito de HU-I-01 (registrar pago) — conviene resolverla temprano para no bloquearla.

---

## 6. HU-B-05 - Búsqueda inteligente de alumno

**Módulo:** Gestionar alumnos  
**SP:** 2

**Como** Personal de mesa de entrada,
**necesito** Buscar un alumno por nombre, apellido o DNI desde el listado,
**para** Encontrarlo rápido sin recorrer todas las páginas del listado.

**Criterios de aceptación:**

1. El listado de alumnos (HU-B-04) incorpora un campo de búsqueda que filtra por Apellido, Nombre o DNI combinados.
   - Se activa a partir de 2 caracteres ingresados — mismo umbral ya usado en el selector de HU-C-04.
   - Admite coincidencias parciales y no distingue mayúsculas ni acentos (misma utilidad normalizarTexto() que ya usa el orden del listado, spec_modulo_B.md §2.4).
2. Buscar con dos o más palabras (ej. "juan perez") encuentra coincidencias que combinen nombre y apellido, en cualquier orden.
3. Los resultados se actualizan sin recargar la pantalla completa y conservan el mismo formato de fila del listado original.
4. La búsqueda se combina con la paginación existente: al escribir, la vista vuelve a la página 1 y pagina sobre el resultado filtrado, no sobre el total.
5. Si no hay coincidencias, se muestra "No se encontraron alumnos para «texto buscado»", conservando el acceso a "Nuevo alumno".
6. Al borrar el texto de búsqueda, se vuelve al listado completo sin filtro, con el orden original (Apellido, Nombre ascendente).
7. Entre los resultados coincidentes se mantiene el orden alfabético — esta historia no introduce ranking por relevancia.
8. Esta historia no incluye filtros combinados por estado, forma de pago u otro criterio adicional; eso queda para una historia futura.

**Justificación de secuencia:** Depende de HU-B-04 (extiende el mismo listado, no crea pantalla nueva). No bloquea a otras historias del sprint. Se ubica temprano porque el criterio de "búsqueda inteligente" que fija acá (umbral de 2 caracteres, normalización) lo reutiliza HU-C-02.

---

## 7. HU-C-02 - Búsqueda inteligente de turnos

**Módulo:** Gestionar turnos  
**SP:** 2

**Como** Personal de mesa de entrada,
**necesito** Buscar turnos por alumno, profesor, materia o aula desde el listado,
**para** Encontrar un turno puntual sin recorrer todo el listado.

**Criterios de aceptación:**

1. El listado de turnos (HU-C-01) incorpora un campo de búsqueda que filtra por nombre/apellido de alumno, nombre/apellido de profesor, nombre de materia o nombre/número de aula.
   - Se activa desde 2 caracteres, coincidencia parcial, sin distinguir mayúsculas ni acentos — mismo criterio que HU-B-05.
2. Buscar por un valor que coincide con más de un campo (ej. "Ana" coincide con una alumna y con una profesora) devuelve los turnos que matchean cualquiera de los campos.
3. Los resultados se actualizan sin recargar la pantalla, se combinan con la paginación (vuelve a página 1 al buscar) y conservan el formato de fila del listado original.
4. Sin coincidencias: "No se encontraron turnos para «texto buscado»".
5. Al borrar la búsqueda, vuelve al listado completo con el orden original (fecha/hora ascendente).
6. Esta historia no incluye filtros combinados por estado, rango de fechas u otro criterio adicional (queda para una historia futura).

**Justificación de secuencia:** Depende de HU-C-01. Mismo patrón ya resuelto por HU-B-05 — se ubica justo después para reutilizar el mismo componente de búsqueda.

---

## 8. HU-C-07 - Mostrar horarios disponibles del profesor

**Módulo:** Gestionar turnos  
**SP:** 3

**Como** Personal de mesa de entrada,
**necesito** Ver qué franjas y fechas están disponibles para el profesor ya elegido, dentro del flujo de configuración de turno,
**para** Elegir fecha y horario sin arriesgarme a elegir un momento en que el profesor no está disponible.

**Criterios de aceptación:**

1. Una vez elegidos Materia y Profesor en /turnos/nuevo (nuevo orden del flujo, ver docs/adicionales/propuesta-cambio-orden-flujo-turno.md), el paso "Elegir Fecha y Horario" ofrece únicamente franjas dentro del horario de atención de ese profesor (HU-D-04) — corrección de redacción (28/09/2026, respuesta del PO a Q1 del Scrum Master): la materia ya filtró qué profesor se eligió en el paso anterior, pero `HorarioProfesor` no distingue por materia (spec_modulo_D.md §2.4/§3.5) — es el mismo horario recurrente para todo lo que ese profesor dicta.
2. Dentro de cada franja, se excluyen los horarios que ya se superponen con otro turno Disponible/Completo que el profesor ya tiene confirmado — mismo criterio de superposición que ya usa HU-C-04.
   - Los turnos Pendiente no reservan recursos y no excluyen ninguna franja (regla de negocio ya vigente, spec_modulo_C.md §3.2).
3. Si el profesor no tiene ninguna franja libre dentro de la anticipación máxima configurada, se informa "Este profesor no tiene horarios disponibles para esta materia en este momento" y se ofrece volver a elegir profesor.
4. La fecha y hora elegidas se revalidan al confirmar el turno (defensa de buena fe, igual que ya hace HU-C-04, con reservas_turno como defensa final de motor).
5. Esta historia no incluye la vista de calendario (HU-J-01/HU-J-02) ni el flujo de generación masiva (HU-C-17), que reutiliza el mismo cálculo de franjas pero en su propia pantalla.

**Justificación de secuencia:** Depende de HU-D-04 y del cambio de orden de flujo aprobado por el PO (docs/adicionales/propuesta-cambio-orden-flujo-turno.md). Es el mecanismo central del nuevo paso 3 del wizard — debe resolverse antes de poder cerrar la reapertura de HU-C-03/HU-C-04.

---

## 9. HU-C-16 - Mostrar aulas disponibles según horario

**Módulo:** Gestionar turnos  
**SP:** 1

**Como** Personal de mesa de entrada,
**necesito** Ver qué aulas están libres para la fecha y horario ya elegidos,
**para** Elegir un aula sin arriesgarme a un conflicto de horario.

**Criterios de aceptación:**

1. Una vez elegida la fecha y horario (paso anterior del wizard), el paso "Elegir Aula" ofrece solo aulas activas sin otro turno Disponible/Completo superpuesto en ese horario — mismo criterio ya implementado en HU-C-15 (GET /api/turnos/aula/opciones).
2. Cada opción muestra Nombre/Número y Capacidad, para poder elegir con criterio si hay más de una libre.
3. Si no hay ninguna aula libre en ese horario: "No hay aulas disponibles para este horario", y se ofrece volver a elegir fecha/horario.
4. Al confirmar, se revalida la disponibilidad (mecanismo ya implementado en HU-C-15).
5. Sin cambios de contenido respecto a lo ya implementado en Sprint 1 — esta historia documenta el comportamiento en su nueva posición (4to paso del wizard en vez del 2do).

**Justificación de secuencia:** Depende de HU-K-01 y del mecanismo ya implementado en HU-C-15. Prácticamente reconfirma un comportamiento existente en su nueva posición — bajo esfuerzo.

---

## 10. HU-C-18 - Reordenar el flujo de registro de turno según el nuevo orden aprobado

**Módulo:** Gestionar turnos  
**SP:** 3

**Como** Personal de mesa de entrada,
**necesito** que el wizard de "Nuevo turno" siga el orden Materia → Profesor → Fecha y Horario → Aula → Alumnos,
**para** no poder llegar a elegir fecha/horario sin saber antes si hay profesor disponible para esa materia.

**Criterios de aceptación:**

1. El wizard de `/turnos/nuevo` (modo Turno individual) presenta los pasos en el orden: Materia → Profesor (filtrado por quienes dictan la materia) → Fecha y Horario (HU-C-07) → Aula (HU-C-16) → Alumnos. Reemplaza por completo el orden de la Revisión 4 — ver `docs/adicionales/propuesta-cambio-orden-flujo-turno.md`.
2. Los campos que antes pedía HU-C-03 (Fecha, Hora) y HU-C-15 (Aula) se redistribuyen en los pasos correspondientes del nuevo orden, sin tocar las validaciones ya implementadas (superposición, cupo, duración) — solo cambia dónde y cuándo se piden.
3. Los campos que antes pedía HU-C-04 (Profesor, Alumnos) se separan: Profesor pasa al paso 2, Alumnos queda como último paso.
4. "Atrás" conserva los valores de los pasos siguientes salvo que el cambio los invalide (ej. cambiar de profesor limpia el horario ya elegido y lo recalcula).
5. Esta historia no cambia ninguna regla de negocio de C-03/C-04/C-15 — solo el orden de los pasos. Esas tres HU permanecen Done de Sprint 1; esta historia es la que absorbe el trabajo de reordenamiento.
6. El modo "Generar varios turnos" (HU-C-17) ya nace con este orden — no depende de esta historia, pero comparte los componentes de Materia y Profesor.

**Justificación de secuencia:** Depende de HU-C-07 y HU-C-16 (tienen que existir para calcular los pasos 3 y 4 en el nuevo orden). No bloquea al resto de historias de Turno.

---

## 11. HU-C-17 - Generar turnos a partir del horario del profesor

**Módulo:** Gestionar turnos  
**SP:** 5

**Como** Personal de mesa de entrada,
**necesito** Generar automáticamente los turnos de un profesor para un rango de fechas, a partir de su horario recurrente,
**para** Crear en un solo paso las clases repetidas de un cuatrimestre sin configurarlas una por una.

**Criterios de aceptación:**

1. El flujo solicita, en orden, Materia, Profesor (filtrado por quienes dictan esa materia), una franja disponible de ese profesor, la duración del turno (1, 2 o 3 horas — corregido respecto al pedido original de los PO anteriores, que decía "1 o 2 horas": debe usar el mismo conjunto DURACIONES_PERMITIDAS_TURNO_MIN vigente desde spec_modulo_C.md Revisión 4), la hora de inicio dentro de la franja, un aula y un rango de fechas (desde–hasta).
   - Las franjas ofrecidas provienen de los horarios registrados en HU-D-04 para ese profesor (corrección de redacción, 28/09/2026 — ver nota de HU-C-07: `HorarioProfesor` no tiene materia, la materia ya se usó para filtrar qué profesor se eligió, no filtra la franja en sí).
   - La hora de inicio no está fijada al comienzo de la franja: el usuario puede elegir cualquier inicio dentro de ella.
2. La hora de inicio elegida más la duración elegida deben caber dentro de la franja seleccionada.
   - No se permite un inicio o una duración que exceda el horario de fin de la franja.
3. El tramo de la franja no utilizado por el turno generado permanece disponible para otra generación posterior, en la misma corrida o en una futura.
4. El aula seleccionada se aplica a todas las instancias de turno que se generen en el rango elegido; no se admite un aula distinta por semana dentro de una misma generación.
5. Antes de generar, el sistema calcula todas las fechas puntuales del rango que caen en el día de la semana de la franja elegida, y valida la disponibilidad del aula seleccionada en cada una de esas fechas puntuales.
   - La validación es por fecha concreta, no una validación general del día de la semana: dos lunes distintos se validan por separado.
   - Como el profesor no puede tener dos materias en la misma franja (validado en HU-D-04), el único solapamiento que se valida en este paso es el de aula. (Aclarado el 01/10/2026 — este supuesto no es correcto, ver nota más abajo.)
6. El sistema muestra una vista previa con la cantidad de turnos a crear, sus fechas, y señala explícitamente cualquier fecha en conflicto por aula ocupada, antes de pedir confirmación.
   - Si existe al menos un conflicto, no se genera ningún turno hasta que el usuario lo resuelva (cambiando el aula para todo el rango, nunca por fecha individual — ver criterio 4, o acotando el rango) y vuelva a solicitar la vista previa.
   - No se generan los turnos sin conflicto salteando los conflictivos: la generación es todo o nada por corrida.
7. Al confirmar sin conflictos pendientes, se crea una instancia de turno por cada fecha puntual calculada, **en estado Disponible, con 0 alumnos inscriptos (0/N según el cupo del aula elegida)**, cada una con su materia, profesor, aula, fecha y horario ya completos (corregido el 28/09/2026 — decisión del PO en respuesta a Q11 del Scrum Master, ver justificación más abajo).
   - **A diferencia de un turno creado individualmente (HU-C-03), este flujo no pasa por el estado Pendiente:** materia, profesor, aula, fecha y horario ya quedan completos y reservados (vía `reservas_turno`) en el mismo paso de confirmación, así que no hay ningún dato "a completar después" que justifique el estado Pendiente.
   - Desde el momento en que se crea, cada turno generado admite inscripción individual de alumnos por el mecanismo ya existente para turnos Disponible/Completo (HU-C-04 §2.5, mesa de entrada) o el autoservicio de HU-C-12 (alumno) — pasa a Completo automáticamente al alcanzar el cupo, mismo criterio que cualquier otro turno.
   - La operación registra fecha de creación y usuario para cada turno generado.
   - Se informa la cantidad de turnos creados al finalizar.
8. No existen excepciones de disponibilidad del profesor para una fecha puntual dentro de este flujo (por ejemplo, licencias).
   - Si el profesor no puede dar una clase ya generada, mesa de entrada cancela ese turno puntual de forma manual (HU-C-05), sin afectar el horario recurrente ni el resto de los turnos generados.
9. La generación se dispara manualmente desde esta pantalla; no existe un proceso automático de fondo que genere turnos sin que un usuario lo confirme.
10. Se accede desde /turnos/nuevo mediante un control que alterna entre "Turno individual" y "Generar varios turnos" (decisión de PO, 27/09/2026) — no es una pantalla ni un ítem de menú aparte; los pasos Materia y Profesor son los mismos componentes que el modo individual.

**Justificación de secuencia:** Depende de HU-D-04, HU-K-01 y del concepto de turno individual (HU-C-03). HU dejada por los PO anteriores para este sprint; se ubica después de HU-C-07/HU-C-16 porque reutiliza el mismo cálculo de franjas y de disponibilidad de aula ya resueltos ahí.

**Nota (28/09/2026) — por qué el criterio 7 cambió de Pendiente a Disponible:** el Scrum Master marcó que un turno Pendiente no admite inscripción de alumnos, ni de mesa ni del propio alumno (decisión resuelta, spec_modulo_C.md §2.5) — contradecía el criterio 7 original y la fila de HU-C-17 del mapa de pantallas, que suponían inscripción posterior sobre esos turnos. El PO resuelve a favor de Disponible: si materia, profesor, aula, fecha y horario ya están completos al generarse (criterios 1-6), no hay ninguna razón de negocio para pasar por un estado intermedio — y exigir que Mesa confirme turno por turno no agregaría ninguna validación real, porque las validaciones (superposición de aula/profesor) ya ocurren antes de confirmar la generación.

**Nota (01/10/2026) — por qué el criterio 5 no se limita al solapamiento de aula:** la tercera viñeta del criterio 5 supone que el único solapamiento posible es el de aula porque HU-D-04 impide que el profesor tenga dos materias en la misma franja. Ese supuesto no es correcto: HU-D-04 solo impide registrar franjas superpuestas, no turnos del profesor ya creados por otras vías (por ejemplo, un turno individual de HU-C-03) ni una corrida de generación repetida sobre las mismas fechas. Por eso, además de `AULA_OCUPADA`, la implementación valida por fecha puntual `PROFESOR_OCUPADO` (el profesor ya tiene un turno Disponible/Completo superpuesto — R5-4) y `TURNO_EXISTENTE` (ya existe un turno no cancelado del mismo profesor y materia superpuesto — R5-8c), según spec_modulo_C.md §2.9, paso 5. Ambos se informan en la vista previa como conflicto de esa fecha y bloquean la confirmación igual que el aula ocupada (todo o nada, criterio 6). Se conserva la viñeta original para mantener la trazabilidad de la decisión.

---

## 12. HU-C-09 - Consultar detalles del turno

**Módulo:** Gestionar turnos  
**SP:** 1

**Como** Usuario autorizado (mesa de entrada, gerente o profesor sobre sus propios turnos),
**necesito** Ver el detalle completo de un turno, incluidos los datos que se agregan este sprint,
**para** Contar con toda la información antes de modificar o cancelar.

**Criterios de aceptación:**

1. El detalle (/turnos/[id]) muestra Materia, Profesor, Fecha, Hora de inicio–fin, Duración, Aula, Cupo máximo, listado completo de alumnos inscriptos (no solo ocupación), Estado, Prioridad (HU-C-10), listado de pagos registrados (HU-I-01), fecha de creación y usuario que lo creó.
2. Un profesor que consulta el detalle de un turno que no es suyo recibe 403 — mismo criterio de alcance por rol ya usado en el calendario (HU-J-01).
3. Si el turno está Pendiente, los datos no asignados todavía se muestran como "Sin asignar" — mismo criterio ya usado en el listado (HU-C-01).
4. Desde el detalle se accede a las acciones habilitadas para el estado y el rol: Cancelar (HU-C-05), Reprogramar (HU-C-06), Asignar prioridad (HU-C-10), Registrar pago (HU-I-01) y Registrar clase dictada (HU-E-01, cuando corresponda).
5. Esta historia formaliza y completa la vista que ya existía parcialmente desde HU-C-01 (criterio 4) y HU-C-15 — no crea una pantalla nueva (ver docs/adicionales/mapa-pantallas-sprint-2.md §1).

**Justificación de secuencia:** Depende de HU-C-01 y HU-C-15. Es la base sobre la que se apoyan las demás historias del bloque "Detalle de turno" (C-05, C-06, C-10, I-01) — conviene resolverla primero dentro de ese bloque.

---

## 13. HU-C-05 - Cambiar estado del turno a cancelado

**Módulo:** Gestionar turnos  
**SP:** 1

**Como** Personal de mesa de entrada,
**necesito** Cancelar un turno ya confirmado,
**para** Liberar el aula, el profesor y a los alumnos inscriptos cuando la clase no va a dictarse.

**Criterios de aceptación:**

1. Desde el detalle de un turno Disponible o Completo, la acción "Cancelar turno" solicita confirmación: "¿Confirmás cancelar este turno? Esta acción no se puede deshacer."
2. Un turno Pendiente no tiene esta acción — se descarta simplemente sin guardar (ya cubierto por el flujo de configuración, HU-C-03).
3. Al confirmar, el turno pasa a estado Cancelado (nuevo valor del enum EstadoTurno), deja de reservar profesor/aula/alumnos (se eliminan sus filas de reservas_turno) y se informa "Turno cancelado correctamente".
   - Un turno Cancelado no vuelve a ningún otro estado.
4. Un turno Cancelado deja de aparecer en los calendarios (HU-J-01/HU-J-02) y en las franjas ocupadas que consultan HU-C-07/HU-C-16, igual que ya sucede con Pendiente.
5. El listado (HU-C-01) y el detalle siguen mostrando el turno cancelado con su historial completo (no se borra), con la etiqueta "Cancelado".
6. Esta historia no incluye la cancelación de un turno propio por el alumno (HU-C-14, Sprint 3).

**Justificación de secuencia:** Depende de HU-C-09. Agrega un cuarto valor al enum de estado, ya modificado tres veces este sprint (Revisiones 3 y 4 de spec_modulo_C.md) — coordinar con el Scrum Master antes de sumarlo.

---

## 14. HU-C-06 - Cambiar fecha y hora del turno

**Módulo:** Gestionar turnos  
**SP:** 2

**Como** Personal de mesa de entrada,
**necesito** Reprogramar la fecha y hora de un turno ya confirmado,
**para** Reagendar una clase sin tener que cancelarla y crear una nueva.

**Criterios de aceptación:**

1. Desde el detalle de un turno Disponible o Completo, "Reprogramar" abre un formulario con Fecha y Hora de inicio (la Duración y el Profesor no cambian en esta operación).
2. La nueva fecha/hora se valida contra la disponibilidad del profesor (su horario de atención y sus otros turnos confirmados), del aula ya asignada y de todos los alumnos ya inscriptos — mismos criterios de superposición que HU-C-04.
   - Si cualquiera de los tres tiene conflicto, se informa cuál y no se guarda el cambio.
3. Si la nueva fecha/hora es válida, se actualiza el turno manteniendo su estado (Disponible o Completo) y se informa "Turno reprogramado correctamente".
4. Cambiar la fecha/hora de un turno no reinicia sus inscripciones ni su historial de clases dictadas (HU-E-01) si ya las tuviera.
5. Esta historia no permite cambiar Materia, Profesor ni Duración de un turno ya confirmado — eso implicaría reconstruir el turno, fuera de alcance.

**Justificación de secuencia:** Depende de HU-C-09 y de las validaciones de disponibilidad ya implementadas en HU-C-04 (las reutiliza). Algo más compleja que HU-C-05 por la triple validación (profesor, aula, alumnos).

---

## 15. HU-C-10 - Asignar prioridad/urgencia al turno

**Módulo:** Gestionar turnos  
**SP:** 1

**Como** Personal de mesa de entrada,
**necesito** Marcar un turno con un nivel de prioridad,
**para** Identificar visualmente qué turnos requieren atención preferente.

**Criterios de aceptación:**

1. El detalle del turno permite elegir una Prioridad entre Normal, Alta y Urgente (Normal por defecto al crearse; no se elige en el wizard de creación).
2. El listado de turnos (HU-C-01) y el calendario (HU-J-01/HU-J-02) muestran un indicador visual de prioridad cuando es Alta o Urgente (texto o ícono, no solo color, mismo criterio de accesibilidad que el resto del sistema).
3. Cambiar la prioridad no dispara ninguna notificación (fuera de alcance este sprint) ni afecta el orden por defecto del listado (que sigue siendo por fecha/hora).
4. Al guardar se informa "Prioridad actualizada" y se registra el cambio en el evento de dominio correspondiente.
5. Disponible para turnos en cualquier estado excepto Cancelado.

**Justificación de secuencia:** Depende de HU-C-09. Campo simple sin lógica de validación cruzada — bajo esfuerzo, se puede resolver en paralelo con otras historias del bloque.

---

## 16. HU-I-01 - Registrar pago

**Módulo:** Gestionar pagos  
**SP:** 3

**Como** Personal de mesa de entrada,
**necesito** Registrar el pago de un turno, indicando qué alumno paga, cuánto, con qué forma de pago y cuándo,
**para** Dejar constancia de que el turno fue abonado y por quién.

**Criterios de aceptación:**

1. Desde el detalle del turno, la acción "Registrar pago" solicita: Alumno (entre los inscriptos en ese turno, con buscador — preseleccionado automáticamente si hay uno solo), Monto, Forma de pago entre las activas (HU-I-03; por defecto la preferida del alumno elegido, HU-B-03, sin obligarla) y Fecha de pago (por defecto hoy).
2. El monto debe ser un número positivo; no se valida contra ningún precio de lista (Noctium no modela precios por materia este sprint) — es un dato que ingresa Mesa de Entrada.
3. Un turno puede tener más de un pago registrado — por ejemplo, pagos parciales de un mismo alumno o pagos de distintos alumnos inscriptos — cada registro queda como una entrada independiente, con su propio alumno, monto, forma de pago y fecha; no se agrega una validación de "monto total esperado" este sprint.
4. Al guardar se informa "Pago registrado correctamente" y el pago queda visible en el detalle del turno (lista "Pagos registrados"), mostrando alumno, fecha, monto y forma de pago de cada uno.
5. Esta historia no incluye historial de pagos por alumno (HU-I-04, Sprint 3) ni estado de cuenta (HU-I-02, Sprint 3) — solo el registro puntual asociado al turno.

**Justificación de secuencia:** Depende de HU-I-03 y de HU-C-09 (detalle del turno, de donde toma la lista de alumnos inscriptos). Vive en el Detalle de turno.

**Nota (28/09/2026):** se retira **HU-C-11 (Asociar forma de pago al turno)** del backlog — decisión del PO a partir de una consulta del equipo de desarrollo: el campo "forma de pago acordada" a nivel de turno resultaba ambiguo, porque la forma de pago se termina definiendo igual al registrar el pago en sí (criterio 1 de esta historia). Se aprovecha para agregar lo que faltaba: quién de los alumnos inscriptos está pagando, reflejado en cada entrada de "Pagos registrados" — completa algo que ya estaba implícito en el criterio 3 original ("pagos parciales de **distintos alumnos**") pero nunca se capturaba explícitamente. El backlog pasa de 26 a 25 Historias de Usuario — ver índice de prioridad e Total actualizados al inicio del documento.

---

## 17. HU-C-08 - Consultar turnos asociados al profesor

**Módulo:** Gestionar turnos  
**SP:** 2

**Como** Gerente o el propio profesor,
**necesito** Consultar el listado de turnos de un profesor determinado,
**para** Revisar su carga de trabajo en formato de lista, no solo de calendario.

**Criterios de aceptación:**

1. Reutiliza el listado de turnos (HU-C-01/HU-C-02) con un filtro por Profesor — no es una pantalla nueva.
   - Un Gerente elige el profesor desde un selector; un Profesor ve automáticamente sus propios turnos, sin selector, mismo criterio de alcance por rol que ya usa el calendario (HU-J-01).
2. El filtro se puede combinar con la búsqueda inteligente (HU-C-02) y con la paginación existente.
3. Incluye turnos en cualquier estado (Pendiente, Disponible, Completo, Cancelado), a diferencia del calendario que solo muestra Disponible/Completo — esta es la diferencia principal frente a HU-J-01, y lo que la justifica como historia separada.
4. Si el profesor no tiene turnos: "Este profesor no tiene turnos registrados".

**Justificación de secuencia:** Depende de HU-C-01/HU-C-02 y HU-D-05. Resuelve el punto abierto del mapa de pantallas: es el mismo listado con un filtro, no una pantalla nueva ni el calendario de HU-J-01.

---

## 18. HU-J-03 - Visualizar calendario por día/semana/mes

**Módulo:** Visualizar calendario  
**SP:** 2

**Como** Usuario autorizado,
**necesito** Cambiar la vista del calendario entre día, semana y mes,
**para** Elegir el nivel de detalle según lo que necesito revisar.

**Criterios de aceptación:**

1. Las pantallas de calendario (HU-J-01, HU-J-02) agregan un control de vista con tres opciones: Día, Semana (vista actual, por defecto) y Mes.
2. La vista Mes muestra los turnos como indicadores compactos por día (cantidad y estado predominante), sin el detalle hora a hora; al hacer clic en un día se pasa a la vista Día de esa fecha.
3. La vista Día muestra el mismo nivel de detalle que la vista Semana actual, pero para un único día.
4. Cambiar de vista conserva el profesor o materia seleccionados (HU-J-01/HU-J-02) y navega dentro del rango relativo correspondiente (hoy en Día, esta semana en Semana, este mes en Mes).
5. La acción "Hoy" vuelve al día/semana/mes actual según la vista activa.

**Justificación de secuencia:** Depende de HU-J-01 y HU-J-02, que ya dejaron esto como "incremento posterior" (criterio 8 de HU-J-01, Sprint 1). No depende de ninguna otra historia de este sprint.

---

## 19. HU-C-12 - Solicitar turno propio

**Módulo:** Gestionar turnos  
**SP:** 3

**Como** Alumno,
**necesito** Inscribirme a un turno ya existente eligiendo materia, profesor y horario,
**para** Reservar mi lugar en una clase sin depender de mesa de entrada.

**Criterios de aceptación:**

1. La pantalla "Solicitar turno" ofrece elegir Materia, luego Profesor (filtrado por quienes dictan esa materia y tienen al menos un turno con inscripción abierta) y luego un Horario entre los turnos Disponibles ya existentes con cupo libre para esa combinación.
   - El alumno no crea turnos ni elige aula — ambos ya vienen definidos por el turno existente que está eligiendo (ver docs/adicionales/propuesta-cambio-orden-flujo-turno.md §4).
2. Si no existe ningún turno con cupo libre para la combinación elegida, se informa "No hay turnos disponibles para esta combinación" y se ofrece elegir otra materia/profesor.
3. Al confirmar, se verifica que el alumno no tenga ya otro turno superpuesto en ese horario y que el turno elegido siga teniendo cupo libre (revalidación al confirmar, igual criterio que el resto del sistema).
4. Si la inscripción es válida, se agrega al alumno al turno (mismo mecanismo que HU-C-04, alta individual, §2.5) y se informa "Te inscribiste correctamente".
5. Si el turno alcanza su cupo máximo con esta inscripción, pasa a Completo automáticamente (regla ya vigente).
6. En este sprint la inscripción propia no exige pago previo ni integra ninguna pasarela: el pago lo registra Mesa de Entrada (HU-I-01). Por eso, junto con "Te inscribiste correctamente", se le informa al alumno "El pago se abona en el centro".

**Justificación de secuencia:** Depende de HU-B-08 (cuenta de alumno), HU-C-01 y del mecanismo de alta individual ya implementado en HU-C-04 (2.5). Más compleja que una consulta simple por el triple filtro y la revalidación de cupo.

**Nota (28/09/2026):** consulta del equipo de desarrollo: un alumno que se inscribe desde su casa no debería poder reservar sin pagar antes, y la única forma online debería ser Mercado Pago (efectivo y transferencia serían presenciales). Decisión del PO: **el cobro online queda fuera de Sprint 2** y pasa a Sprint 3. Motivo: hoy Noctium no modela precios por materia (HU-I-01 criterio 2), así que no hay un monto que cobrar; además exige una integración externa (checkout, confirmación de pago por webhook, reserva temporal del cupo, reembolsos si el turno se cancela). En Sprint 2 HU-C-12 queda como reserva sin cobro (criterio 6). Historias a definir para Sprint 3, sin escribirlas todavía: precio por materia, pago online con Mercado Pago previo a la inscripción, y qué pasa con el cupo si el pago no se completa.

---

## 20. HU-C-13 - Consultar turnos propios

**Módulo:** Gestionar turnos  
**SP:** 2

**Como** Alumno,
**necesito** Ver el listado de mis propios turnos,
**para** Saber cuándo y con quién tengo clase.

**Criterios de aceptación:**

1. La pantalla "Mis turnos" muestra los turnos donde el alumno autenticado está inscripto, en cualquier estado — **incluidos los Cancelados** (corregido 28/09/2026: antes los excluía; el alumno necesita enterarse de que su clase se canceló, la cancele Mesa de Entrada o se dé de baja por cualquier otro motivo, por ejemplo la situación de un profesor que deja de estar disponible).
2. Cada ítem muestra Fecha, Hora, Materia, Profesor, Aula y, si el turno está Cancelado, la etiqueta correspondiente (mismo tratamiento visual que la etiqueta "Cancelado" del listado de Mesa de Entrada, ver `docs/DESIGN.md` §6) — sin el dato de "alumnos inscriptos" (no es relevante desde la perspectiva del alumno).
3. La pantalla se organiza en dos pestañas — **resuelto el 28/09/2026, cierra el punto que había quedado abierto ("a definir con el equipo al redactar el task")**:
   - **Próximos:** turnos (Cancelados o no) cuya fecha y hora todavía no llegaron, orden ascendente. Un turno Cancelado se ve acá, destacado, mientras su fecha y hora originales sigan sin llegar — así el alumno lo tiene presente como aviso.
   - **Anteriores:** turnos cuya fecha y hora ya pasaron, cualquiera sea su estado, orden descendente (más reciente primero).
   - El pase de una pestaña a la otra es automático y se resuelve solo comparando fecha/hora del turno contra el momento de la consulta — no es una operación que mueva datos ni un proceso en segundo plano.
4. Si el alumno no tiene turnos en la pestaña activa: "Todavía no tenés turnos" en Próximos (con acceso directo a HU-C-12) o "No tenés turnos anteriores" en Anteriores.
5. Esta historia no incluye cancelar un turno propio (HU-C-14, Sprint 3) — solo consulta.
6. Cada pestaña (Próximos y Anteriores) muestra los turnos de a 10 por página, con paginación. El contador de la pestaña muestra el total, no el de la página. Al cambiar de pestaña vuelve a la página 1. Si hay 10 turnos o menos, no se muestra la paginación.

**Justificación de secuencia:** Depende de HU-C-12 (para que tenga sentido tener turnos propios) y de HU-B-08. Consulta simple, similar a HU-B-04/HU-C-01 pero acotada al propio alumno.

---

## 21. HU-E-01 - Registrar clase dictada

**Módulo:** Atención académica / Historial  
**SP:** 2

**Como** Personal de mesa de entrada o el propio profesor,
**necesito** Registrar que una clase efectivamente se dictó,
**para** Dejar constancia en el historial académico del alumno.

**Criterios de aceptación:**

1. Desde el detalle de un turno Disponible o Completo cuya fecha/hora ya pasó, aparece la acción "Registrar clase dictada" (no disponible antes de esa fecha/hora, ni para turnos Pendiente o Cancelado).
2. Al confirmar, se crea un registro de "Clase dictada" vinculado al turno, con fecha, materia, profesor y la lista de alumnos que estaban inscriptos en ese momento.
3. Un turno solo puede tener una clase dictada registrada — repetir la acción sobre el mismo turno no crea un duplicado, muestra el registro ya existente.
4. El registro queda visible en el historial académico de cada alumno que estaba inscripto (HU-E-05).
5. Esta historia no registra asistencia individual (quién faltó) — se asume que todos los inscriptos al momento de dictarse la clase asistieron, salvo que una historia futura lo refine.

**Justificación de secuencia:** Depende de HU-C-04 (inscripciones) y de que el turno ya haya pasado su fecha/hora. Es la base de HU-E-05 (no hay historial que mostrar sin esto) — conviene resolverla antes.

---

## 22. HU-E-06 - Registrar resultados de exámenes

**Módulo:** Atención académica / Historial  
**SP:** 2

**Como** Personal de mesa de entrada o el propio profesor,
**necesito** Registrar la nota de un examen para un alumno en una materia,
**para** Dejar constancia del resultado en su historial académico.

**Criterios de aceptación:**

1. Desde la ficha del alumno (sección Historial académico), "Registrar resultado de examen" solicita Materia (entre las que el alumno cursó, con al menos una clase dictada registrada), Fecha del examen, Nota (dentro de la escala configurada por el centro) y permite ingresar Observaciones opcionales.
2. La nota se valida contra el rango configurado (por ejemplo, 1 a 10); un valor fuera de rango se rechaza con un mensaje específico.
3. Un alumno puede tener varios resultados de examen para la misma materia (recuperatorios, distintos parciales) — no se reemplaza el anterior, se agrega como un registro nuevo.
4. Al guardar se informa "Resultado registrado correctamente" y aparece en el historial académico del alumno (HU-E-05).
5. Esta historia no calcula un promedio ni una condición de aprobado/desaprobado — solo registra el dato tal como se ingresa.

**Justificación de secuencia:** Depende de HU-E-01 (debe existir al menos una clase dictada de esa materia) y de HU-B-01 (ficha del alumno). Se resuelve junto con HU-E-01 y antes de HU-E-05, que necesita datos para mostrar.

---

## 23. HU-E-05 - Ver historial académico del alumno

**Módulo:** Atención académica / Historial  
**SP:** 2

**Como** Personal de mesa de entrada, gerente o profesor,
**necesito** Ver las clases dictadas y los resultados de examen de un alumno,
**para** Tener una vista completa de su recorrido académico.

**Criterios de aceptación:**

1. Dentro de la ficha del alumno, una sección/tab "Historial académico" lista las clases dictadas (HU-E-01) y los resultados de examen (HU-E-06) del alumno, ordenados por fecha descendente (más reciente primero).
2. Cada clase dictada muestra Fecha, Materia y Profesor; cada resultado de examen muestra Fecha, Materia y Nota, con las Observaciones si existen — ambos tipos de registro conviven en la misma línea de tiempo, distinguidos visualmente.
3. Se puede filtrar la vista por Materia.
4. Si el alumno no tiene ningún registro: "Este alumno todavía no tiene historial académico".
5. Esta historia es de solo consulta — las acciones de alta (HU-E-01, HU-E-06) viven en sus propias pantallas/puntos de entrada, no acá.
6. La lista se muestra de a 10 registros por página, con paginación. Al cambiar el filtro por Materia vuelve a la página 1 y se pagina sobre el resultado filtrado. Si hay 10 registros o menos, no se muestra la paginación.

**Justificación de secuencia:** Depende de HU-E-01 y HU-E-06 (necesita que existan datos para mostrar) y de HU-B-04 (ficha del alumno). Se resuelve al final del bloque de Historial académico.

---

## 24. HU-H-01 - Ver cantidad de turnos por mes

**Módulo:** Indicadores  
**SP:** 1

**Como** Gerente,
**necesito** Ver cuántos turnos se registraron por mes,
**para** Evaluar el volumen de actividad del centro.

**Criterios de aceptación:**

1. La pantalla "Indicadores" muestra la cantidad de turnos por mes, agrupados por el mes de la fecha del turno (no la fecha de creación), para los últimos 6 meses incluyendo el actual.
2. Se cuentan los turnos en estado Disponible, Completo o Cancelado — los turnos Pendiente no se cuentan (todavía no representan una clase real).
3. El rango de meses mostrado se puede ajustar a un período distinto al de los últimos 6.
4. Si no hay turnos en un mes del rango, se muestra igual con valor 0 (no se omite el mes).
5. Esta historia no distingue por materia (HU-H-03) ni por profesor (HU-H-04) — eso queda para Sprint 3.

**Justificación de secuencia:** No depende de otra historia de este sprint más allá de tener turnos cargados (Sprint 1). Convive con HU-H-02 en la misma pantalla — se resuelven juntas.

---

## 25. HU-H-02 - Ver cantidad de alumnos por mes

**Módulo:** Indicadores  
**SP:** 1

**Como** Gerente,
**necesito** Ver cuántos alumnos nuevos se registraron por mes,
**para** Evaluar el crecimiento de la base de alumnos del centro.

**Criterios de aceptación:**

1. La misma pantalla "Indicadores" (HU-H-01) muestra, junto al gráfico de turnos, la cantidad de alumnos nuevos registrados por mes (por fecha de alta de la ficha, HU-B-01/HU-B-08), mismo rango de los últimos 6 meses.
2. Se cuentan todas las fichas de alumno dadas de alta en el mes, tengan o no cuenta de acceso vinculada.
3. Si no hay altas en un mes del rango, se muestra con valor 0.
4. El rango de meses es el mismo que se elige para HU-H-01 (un solo selector de rango para ambos indicadores, ya que están en la misma pantalla).
5. Esta historia no distingue por rol de referencia ni por otro criterio — es un conteo simple.

**Justificación de secuencia:** No depende de otra historia de Sprint 2 más allá de HU-B-01/HU-B-08 (Sprint 1). Va en la misma pantalla que HU-H-01, por lo que conviene desarrollarlas juntas para no duplicar el layout del dashboard.

---
